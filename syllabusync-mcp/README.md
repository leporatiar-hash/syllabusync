# SyllabuSync MCP Server

MCP server that exposes SyllabuSync (Classmate)'s student study assistant functionality as AI-ready tools for the Crow widget.

## Available Tools (31 total)

| Tool | Description |
|------|-------------|
| `get_profile` | Get student's profile, school, major, and subscription tier |
| `update_profile` | Update name, school, major, academic year |
| `get_subscription` | Check AI generation usage and subscription limits |
| `get_referral_code` | Get the student's referral code |
| `list_courses` | List all courses with deadline/flashcard counts |
| `get_course` | Get full course details (deadlines, study materials) |
| `create_course` | Create a new course |
| `update_course` | Update course name, code, semester, or dates |
| `delete_course` | Delete a course and all its data ⚠️ |
| `list_deadlines` | List deadlines with optional course/date filters |
| `create_deadline` | Add a new deadline or assignment |
| `update_deadline` | Update a deadline's title, date, or course |
| `toggle_deadline_complete` | Mark a deadline as done or undone |
| `delete_deadline` | Delete a deadline ⚠️ |
| `get_summary` | Read an AI-generated study summary |
| `delete_summary` | Delete a summary ⚠️ |
| `get_flashcard_set` | Get all flashcards in a set (Q&A pairs) |
| `delete_flashcard_set` | Delete a flashcard set ⚠️ |
| `list_quizzes` | List quizzes for a course |
| `get_quiz` | Get quiz questions (answers hidden) |
| `submit_quiz` | Submit answers and get scored results |
| `delete_quiz` | Delete a quiz ⚠️ |
| `list_lms_connections` | List Canvas / iCal integrations |
| `sync_lms` | Manually sync deadlines from Canvas/iCal |
| `disconnect_lms` | Remove an LMS connection ⚠️ |
| `list_conversations` | List AI chat conversations |
| `create_conversation` | Start a new chat conversation |
| `get_conversation_messages` | Read messages in a conversation |
| `send_message` | Send a message and get AI response (Pro only) |
| `delete_conversation` | Delete a conversation ⚠️ |
| `submit_feedback` | Submit bug reports or feature requests |

> ⚠️ = destructive, irreversible action

## Limitations

The following are **not** available via MCP (require file uploads):
- Generating AI summaries from PDFs/DOCX
- Generating flashcards from uploaded notes
- Generating quizzes from study materials
- Uploading a course syllabus

Students must use the SyllabuSync app to generate these — the MCP server can then read and interact with the generated content.

---

## Setup

### 1. Required Backend Change — Service Key Auth

The SyllabuSync backend validates Supabase JWTs. The MCP server can't produce these — it needs a **service key bypass** added to `main.py`.

Add the following to `main.py`:

**Step 1:** Add the import and env var (near the top, after existing imports):
```python
import hmac

MCP_SERVICE_KEY = os.environ.get("MCP_SERVICE_KEY", "")
```

**Step 2:** Modify `_get_current_user()` to check for the service key BEFORE the JWT check:
```python
def _get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
    db,
) -> User:
    # --- NEW: Service key path (for Crow MCP server) ---
    service_key = request.headers.get("x-service-key", "")
    if service_key and MCP_SERVICE_KEY and hmac.compare_digest(service_key, MCP_SERVICE_KEY):
        user_id = request.headers.get("x-user-id", "")
        if not user_id:
            raise HTTPException(status_code=400, detail="X-User-ID header required with service key auth")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        return user
    # --- END NEW ---

    # Existing auth logic (unchanged below)
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # ... rest of the existing function ...
```

**Step 3:** Add `MCP_SERVICE_KEY` to the SyllabuSync backend's `.env`:
```
MCP_SERVICE_KEY=<generate-a-strong-random-key>
```
Generate with: `python -c "import secrets; print(secrets.token_hex(32))"`

### 2. Identity Verification JWT

The Crow widget uses an Identity Verification JWT to identify students. You need a backend endpoint that mints this token for authenticated students.

Add this endpoint to your SyllabuSync backend:
```python
import jwt as pyjwt
import time

CROW_VERIFICATION_SECRET = os.environ.get("CROW_VERIFICATION_SECRET", "")

@app.post("/crow/identity-token")
def get_crow_identity_token(current_user: User = Depends(get_current_user)):
    """Mint a Crow Identity Verification JWT for the authenticated student."""
    if not CROW_VERIFICATION_SECRET:
        raise HTTPException(status_code=500, detail="Crow verification secret not configured")
    payload = {
        "user_id": current_user.id,   # Supabase user UUID — REQUIRED
        "exp": int(time.time()) + 3600,
    }
    token = pyjwt.encode(payload, CROW_VERIFICATION_SECRET, algorithm="HS256")
    return {"token": token}
```

Get `CROW_VERIFICATION_SECRET` from your Crow dashboard → Product Settings → Identity Verification.

The frontend should call this endpoint after login and pass the token to the Crow widget:
```javascript
const { data } = await fetch('/crow/identity-token', { headers: { Authorization: `Bearer ${supabaseJwt}` } }).then(r => r.json())
crow.setIdentityToken(data.token)
```

### 3. Install MCP server dependencies

```bash
cd syllabusync-mcp
pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
# Edit .env and set:
#   API_BASE_URL = your SyllabuSync backend URL
#   SERVICE_KEY  = same value as MCP_SERVICE_KEY in the backend
```

### 5. Run locally

```bash
# Dev mode with Inspector (recommended for testing):
fastmcp dev server.py

# HTTP mode (for connecting to Crow locally):
fastmcp run server.py --transport streamable-http --port 8080
```

---

## Scoping Configuration

| Header | Source | Description |
|--------|--------|-------------|
| X-User-ID | identity.user_id | Supabase user UUID from the Identity Verification JWT |

The student's `user_id` is extracted from the Crow Identity Verification JWT and passed automatically as `X-User-ID` on every tool call. No manual configuration needed.

## Header Mappings (Crow Dashboard)

When deploying to Crow, configure this header mapping:

```
X-User-ID ← identity.user_id
```

---

## Deploying to Crow

After generating or updating the MCP server, save it via the Crow API, then deploy:

```bash
npx @usecrow/envoy deploy
```

The deploy step auto-wires the MCP server to the dashboard — no manual configuration needed.
View status at: https://app.usecrow.com → Tools

---

## Testing

### Inspector (recommended)
```bash
fastmcp dev server.py
```
Open http://localhost:6274 to browse and call tools interactively.

### Manual curl test (requires running backend + service key configured)
```bash
# Test get_profile via HTTP transport
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "X-User-ID: <your-supabase-user-id>" \
  -d '{"method": "tools/call", "params": {"name": "get_profile", "arguments": {}}}'
```

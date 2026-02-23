# AI Chat Tab — Implementation Plan

## Overview
Add a Chat tab to Study Studio with AI-powered academic chat. Pro-only feature with 50 messages/month limit for Pro users. Grandfathered users get unlimited.

---

## Phase 1: Backend — Models & Migration

**File: `Backend/main.py`**

### 1a. New SQLAlchemy models (after existing models ~line 565)

- **ChatConversation**: `id`, `user_id`, `title`, `created_at`, `updated_at`
  - Relationship: `messages` → ChatMessage (cascade delete)
- **ChatMessage**: `id`, `user_id`, `conversation_id` (FK), `role` (user/assistant), `content`, `created_at`
  - Relationship: `conversation` → ChatConversation

### 1b. New columns on UserProfile (after `ai_generations_reset_at`)

- `chat_messages_used` — INTEGER DEFAULT 0
- `chat_messages_reset_at` — TIMESTAMP nullable

### 1c. Migration function `ensure_chat_columns()`

- Add the two new columns to `user_profiles` (same try/except pattern as `ensure_subscription_columns`)
- Call in startup after `ensure_subscription_columns()`

### 1d. Add DB indexes

- `idx_chat_conversations_user_id` on `chat_conversations(user_id)`
- `idx_chat_messages_conversation_id` on `chat_messages(conversation_id)`

---

## Phase 2: Backend — Tier Check & Usage Tracking

**File: `Backend/main.py`**

### 2a. Constant
- `PRO_CHAT_MESSAGE_LIMIT = 50`

### 2b. `check_chat_limit(db, user_id)` function
- Free users → 403 with `"error": "pro_required"` (chat is Pro-only)
- Grandfathered → unlimited, return
- Pro → monthly reset logic (same pattern as `ai_generations`), then check if `chat_messages_used >= 50` → 429 with `"error": "chat_limit_reached"`, includes `resets_at` date and friendly message

### 2c. `increment_chat_message(db, user_id)` function
- Only increment for Pro users (grandfathered = unlimited)

### 2d. Update `GET /me/subscription` response
- Add `chat_messages_used` and `chat_messages_max` (50 for pro, None for grandfathered, 0 for free)

---

## Phase 3: Backend — Chat API Endpoints

**File: `Backend/main.py`**

### 3a. Pydantic model
- `SendChatMessageRequest`: `message: str`, `conversation_id: str | None = None`

### 3b. Shared helper `_process_chat_message(db, user_id, message_text, conversation_id)`
Core logic used by both text-only and file-upload endpoints:
1. Get or create conversation
2. Save user message
3. Build context (user's courses + upcoming deadlines)
4. System prompt: "You are a helpful AI study assistant..." + student context
5. Load last 20 messages for history
6. Call `client.chat.completions.create(model="gpt-4o-mini", temperature=0.7, max_tokens=1000)`
7. Save assistant message
8. Auto-title conversation from first user message (truncated to 60 chars)
9. Increment usage counter
10. Return response with conversation_id, message, usage stats

### 3c. Endpoints

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| GET | `/chat/conversations` | List user's conversations (ordered by updated_at desc) | — |
| GET | `/chat/conversations/{id}` | Get conversation with all messages | — |
| POST | `/chat/send` | Send text message, get AI response | 5/min |
| POST | `/chat/send-with-file` | Send message + file attachment (extract text, include in context) | 3/min |
| DELETE | `/chat/conversations/{id}` | Delete conversation + cascade messages | — |

### 3d. File upload in chat
- Accept PDF, DOCX, TXT (max 10MB)
- Extract text using existing `extract_text_from_pdf`/`extract_text_from_docx`
- Truncate to 8000 chars
- Prepend to user message as context
- Call shared `_process_chat_message` helper

### 3e. AI Context Building
- Query all user courses (name, code)
- Query upcoming incomplete deadlines (limit 20, ordered by date)
- System prompt tells model it's an academic assistant with knowledge of student's courses and deadlines
- Last 20 messages in conversation for history

---

## Phase 4: Frontend — Hook Updates

**File: `Frontend/hooks/useSubscription.ts`**

- Add to `SubscriptionInfo`: `chatMessagesUsed: number`, `chatMessagesMax: number | null`
- Add to `DEFAULT_SUB`: `chatMessagesUsed: 0, chatMessagesMax: 0`
- Map from API response in `refresh()`
- Add computed: `canChat = sub.isPro || sub.tier === 'grandfathered'`
- Return `canChat` from hook

---

## Phase 5: Frontend — Study Studio Page Tab

**File: `Frontend/app/study-studio/page.tsx`**

- Change state type: `'create' | 'library'` → `'create' | 'library' | 'chat'`
- Import `ChatTab` component
- Add third tab button "Chat" with same styling pattern
- Add conditional render: `activeTab === 'chat' && <ChatTab />`

---

## Phase 6: Frontend — ChatTab Component

**New file: `Frontend/app/study-studio/ChatTab.tsx`**

### Layout
- **Pro gate**: If `!canChat`, show full paywall (lock icon, "AI Chat is a Pro feature", upgrade CTA button)
- **Two-panel layout**: Conversation sidebar (left, ~280px) + Active chat (right, flex-1)

### Conversation Sidebar (left panel)
- "New Chat" button at top
- List of conversations from `GET /chat/conversations`
- Each shows title + relative time
- Click loads messages via `GET /chat/conversations/{id}`
- Delete button (trash icon) per conversation

### Chat Area (right panel)
- **Empty state**: When no conversation selected, show welcome message with suggested prompts ("Explain a concept from my course", "Help me plan my study schedule", "Quiz me on a topic")
- **Message bubbles**: User = right-aligned blue gradient, Assistant = left-aligned slate/white
- **Auto-scroll** to bottom on new messages
- **Typing indicator**: Three bouncing dots when waiting for response

### Input Area (bottom)
- Text input (rounded, full width) + Send button (gradient blue)
- File upload button (paperclip icon) → hidden file input (PDF, DOCX, TXT)
- Disabled when `sending` is true
- On send: optimistically add user message, POST to `/chat/send`, append assistant response
- On 429 (limit reached): show friendly message with reset date, disable input

### Usage Counter
- Show "X/50 messages this month" for Pro users below input
- When limit hit: replace input with styled message showing reset date

---

## Phase 7: Frontend — Upgrade Page Update

**File: `Frontend/app/upgrade/page.tsx`**

- Add to features array: `{ label: 'AI Course Chat', free: '—', pro: '50/month' }`

---

## Implementation Order

1. Backend models + migration + constant
2. Backend tier check + increment functions
3. Backend endpoints (all 5 routes)
4. Backend subscription endpoint update
5. Frontend useSubscription hook update
6. Frontend ChatTab.tsx (new component)
7. Frontend page.tsx tab update
8. Frontend upgrade page feature list
9. Build verification + test

---

## Files Changed

| File | Action |
|------|--------|
| `Backend/main.py` | Edit — models, migration, endpoints, tier logic |
| `Frontend/hooks/useSubscription.ts` | Edit — add chat fields + canChat |
| `Frontend/app/study-studio/page.tsx` | Edit — add Chat tab |
| `Frontend/app/study-studio/ChatTab.tsx` | **New** — chat UI component |
| `Frontend/app/upgrade/page.tsx` | Edit — add AI Chat to features |

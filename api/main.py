from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlalchemy import create_engine, Column, String, Boolean, Date, DateTime, ForeignKey, Text, JSON, Integer, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, date, timedelta
import PyPDF2
from docx import Document
import json
import uuid
import io
import os
import re
import base64
import hashlib
import secrets

# Load environment variables
load_dotenv()

# Auth configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)
ALLOW_ANON = os.getenv("ALLOW_ANON", "false").lower() == "true"
REQUIRE_AUTH_FOR_WRITE = os.getenv("REQUIRE_AUTH_FOR_WRITE", "true").lower() == "true"
DEMO_USER_ID = os.getenv("DEMO_USER_ID", "demo")

app = FastAPI()

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Auth helpers
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str) -> tuple[str, datetime]:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM), expire


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _verify_code(code: str, code_hash: str) -> bool:
    return _hash_code(code) == code_hash


_login_rate_limit: dict[str, list[datetime]] = {}


def _rate_limit_key(email: str, ip: str | None) -> str:
    return f"{email}|{ip or 'unknown'}"


def _check_rate_limit(email: str, ip: str | None, max_requests: int = 5, window_minutes: int = 10) -> None:
    now = datetime.utcnow()
    key = _rate_limit_key(email, ip)
    window_start = now - timedelta(minutes=window_minutes)
    timestamps = [t for t in _login_rate_limit.get(key, []) if t > window_start]
    if len(timestamps) >= max_requests:
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")
    timestamps.append(now)
    _login_rate_limit[key] = timestamps

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./railway.db")
# Handle Railway's postgres:// vs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Use String for UUID to support both SQLite and Postgres
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
def _safe_db_url(url: str) -> str:
    if "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    if "@" in rest:
        return f"{scheme}://****:****@{rest.split('@', 1)[1]}"
    return url


print(f"[DB] Using DATABASE_URL={_safe_db_url(DATABASE_URL)}")
print(f"[AUTH] ALLOW_ANON={ALLOW_ANON} REQUIRE_AUTH_FOR_WRITE={REQUIRE_AUTH_FOR_WRITE} DEMO_USER_ID={DEMO_USER_ID}")

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def generate_uuid():
    return str(uuid.uuid4())


def ensure_user_columns():
    if engine.dialect.name != "sqlite":
        return
    tables = [
        "courses",
        "deadlines",
        "flashcard_sets",
        "flashcards",
        "quizzes",
        "quiz_questions",
        "summaries",
        "calendar_entries",
        "user_profiles",
    ]
    with engine.begin() as conn:
        for table in tables:
            cols = [row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))]
            if not cols:
                continue
            if "user_id" not in cols:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id TEXT"))

        course_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(courses)"))]
        if course_cols and "course_info" not in course_cols:
            conn.execute(text("ALTER TABLE courses ADD COLUMN course_info TEXT"))

        profile_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(user_profiles)"))]
        if profile_cols:
            if "password_hash" not in profile_cols:
                conn.execute(text("ALTER TABLE user_profiles ADD COLUMN password_hash TEXT"))
            if "profile_picture" not in profile_cols:
                conn.execute(text("ALTER TABLE user_profiles ADD COLUMN profile_picture TEXT"))
            if "email" not in profile_cols:
                conn.execute(text("ALTER TABLE user_profiles ADD COLUMN email TEXT"))
            # Backfill defaults for legacy rows
            conn.execute(text(
                "UPDATE user_profiles SET email = user_id || '@legacy.local' WHERE email IS NULL"
            ))
            conn.execute(text(
                "UPDATE user_profiles SET password_hash = 'email-only' WHERE password_hash IS NULL"
            ))

        # Backfill user_id from parent relationships when possible
        conn.execute(text("UPDATE courses SET user_id = COALESCE(user_id, 'legacy') WHERE user_id IS NULL"))
        conn.execute(text(
            "UPDATE deadlines SET user_id = (SELECT user_id FROM courses WHERE courses.id = deadlines.course_id) "
            "WHERE user_id IS NULL"
        ))
        conn.execute(text(
            "UPDATE flashcard_sets SET user_id = (SELECT user_id FROM courses WHERE courses.id = flashcard_sets.course_id) "
            "WHERE user_id IS NULL"
        ))
        conn.execute(text(
            "UPDATE flashcards SET user_id = (SELECT user_id FROM flashcard_sets WHERE flashcard_sets.id = flashcards.flashcard_set_id) "
            "WHERE user_id IS NULL"
        ))
        conn.execute(text(
            "UPDATE summaries SET user_id = (SELECT user_id FROM courses WHERE courses.id = summaries.course_id) "
            "WHERE user_id IS NULL"
        ))
        conn.execute(text(
            "UPDATE quizzes SET user_id = (SELECT user_id FROM courses WHERE courses.id = quizzes.course_id) "
            "WHERE user_id IS NULL"
        ))
        conn.execute(text(
            "UPDATE quiz_questions SET user_id = (SELECT user_id FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id) "
            "WHERE user_id IS NULL"
        ))
        conn.execute(text(
            "UPDATE calendar_entries SET user_id = (SELECT user_id FROM deadlines WHERE deadlines.id = calendar_entries.deadline_id) "
            "WHERE user_id IS NULL"
        ))


# Database Models
class Course(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    code = Column(String)  # e.g., "FINC 313"
    semester = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    course_info = Column(JSON, nullable=True)  # Stores extracted syllabus details (instructor, policies, etc.)
    created_at = Column(DateTime, default=datetime.utcnow)

    deadlines = relationship("Deadline", back_populates="course", cascade="all, delete-orphan")
    flashcard_sets = relationship("FlashcardSet", back_populates="course", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="course", cascade="all, delete-orphan")
    summaries = relationship("Summary", back_populates="course", cascade="all, delete-orphan")


class Deadline(Base):
    __tablename__ = "deadlines"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    date = Column(String)  # YYYY-MM-DD
    time = Column(String)  # 11:59pm, etc.
    type = Column(String)  # exam, assignment, quiz, project, reading, deadline
    title = Column(String)
    description = Column(Text)
    recurring = Column(Boolean, default=False)
    frequency = Column(String)  # weekly, biweekly, monthly, null
    day_of_week = Column(String)  # Monday, Tuesday, etc.
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="deadlines")


class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="flashcard_sets")
    flashcards = relationship("Flashcard", back_populates="flashcard_set", cascade="all, delete-orphan")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False)
    flashcard_set_id = Column(String, ForeignKey("flashcard_sets.id"), nullable=False)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    flashcard_set = relationship("FlashcardSet", back_populates="flashcards")


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="summaries")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    school_name = Column(String, nullable=True)
    school_type = Column(String, nullable=True)
    academic_year = Column(String, nullable=True)
    major = Column(String, nullable=True)
    profile_picture = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LoginCode(Base):
    __tablename__ = "login_codes"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, nullable=False, index=True)
    code_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class CalendarEntry(Base):
    """Tracks which deadlines have been saved to the user's calendar."""
    __tablename__ = "calendar_entries"

    id = Column(String, primary_key=True, default=generate_uuid)
    deadline_id = Column(String, ForeignKey("deadlines.id"), nullable=False, unique=True)
    user_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    deadline = relationship("Deadline", backref="calendar_entry")


class Quiz(Base):
    """A quiz generated from study materials."""
    __tablename__ = "quizzes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="quizzes")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")


class QuizQuestion(Base):
    """A single question in a quiz."""
    __tablename__ = "quiz_questions"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False)
    quiz_id = Column(String, ForeignKey("quizzes.id"), nullable=False)
    question = Column(Text, nullable=False)
    options = Column(Text, nullable=False)  # JSON array stored as text
    correct_answer = Column(String, nullable=False)  # A, B, C, or D
    explanation = Column(Text)
    order_num = Column(String, default="0")

    quiz = relationship("Quiz", back_populates="questions")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    token = Column(Text, unique=True, nullable=False)
    user_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)


class EmailAuthRequest(BaseModel):
    email: str
    full_name: str | None = None


class VerifyCodeRequest(BaseModel):
    email: str
    code: str

class ProfilePictureRequest(BaseModel):
    image_data: str  # base64-encoded image

class CreateCourseRequest(BaseModel):
    name: str
    code: str | None = None
    semester: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class UpdateCourseRequest(BaseModel):
    name: str | None = None
    code: str | None = None
    semester: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    course_info: dict | None = None


class UpdateDeadlineRequest(BaseModel):
    date: str


class UserProfileRequest(BaseModel):
    email: str | None = None
    full_name: str | None = None
    school_name: str | None = None
    school_type: str | None = None
    academic_year: str | None = None
    major: str | None = None


class CreateDeadlineRequest(BaseModel):
    title: str
    date: str
    time: str | None = None
    type: str = "Deadline"
    description: str | None = None
    course_id: str | None = None


class QuizSubmission(BaseModel):
    answers: dict[str, str]  # question_id -> selected answer (A, B, C, D)


def generate_flashcards_fallback(text: str):
    sentences = [s.strip() for s in re.split(r"[.!?]\\s+", text) if len(s.strip()) > 20]
    cards = []
    for sentence in sentences:
        if len(cards) >= 10:
            break
        front = sentence[:80].rstrip(".?!") + "?"
        back = sentence[:200]
        cards.append({"front": front, "back": back})
    if not cards:
        cards = [{"front": "Key topic", "back": text[:200]}]
    return cards


def extract_text_from_pdf(content: bytes) -> str:
    pdf = PyPDF2.PdfReader(io.BytesIO(content))
    text = ""
    for page in pdf.pages:
        text += (page.extract_text() or "") + "\n"
    return text


def extract_text_from_docx(content: bytes) -> str:
    file_stream = io.BytesIO(content)
    doc = Document(file_stream)
    return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])


def generate_summary_from_text(text: str) -> str:
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    prompt = """You are a study assistant. Summarize the notes clearly and concisely.
Return 5-8 bullet points plus a short 1-2 sentence overview.
Focus on key concepts, definitions, and important facts.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": text[:15000]}
        ],
        temperature=0.3,
        max_tokens=900
    )

    return response.choices[0].message.content.strip()


def generate_summary_from_image(content: bytes, filename: str) -> str:
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    ext = filename.lower().split(".")[-1]
    if ext == "jpg":
        ext = "jpeg"
    data_url = f"data:image/{ext};base64,{base64.b64encode(content).decode('utf-8')}"

    prompt = "Summarize the handwritten notes or study material in this image. Return 5-8 bullet points plus a short 1-2 sentence overview."

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}}
                ],
            }
        ],
        temperature=0.3,
        max_tokens=900
    )

    return response.choices[0].message.content.strip()


def ensure_auth_columns():
    """Add auth columns to user_profiles if they don't exist (Postgres only)."""
    if engine.dialect.name == "sqlite":
        return
    with engine.begin() as conn:
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'user_profiles' AND column_name = 'password_hash'"
        ))
        if not result.fetchone():
            conn.execute(text("ALTER TABLE user_profiles ADD COLUMN password_hash TEXT"))
            conn.execute(text("ALTER TABLE user_profiles ADD COLUMN profile_picture TEXT"))
            # Backfill nulls so existing rows don't break NOT NULL constraint
            conn.execute(text(
                "UPDATE user_profiles SET email = user_id || '@legacy.local' WHERE email IS NULL"
            ))
            conn.execute(text(
                "UPDATE user_profiles SET password_hash = 'legacy-no-login' WHERE password_hash IS NULL"
            ))

# Create tables / migrations
# Ensure schema exists before running column updates
Base.metadata.create_all(bind=engine)
ensure_user_columns()
ensure_auth_columns()
Base.metadata.create_all(bind=engine)


def ensure_indexes():
    """Create minimal indexes/constraints for user isolation and lookup performance."""
    index_statements = [
        # user-owned tables
        "CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_deadlines_user_id ON deadlines(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_flashcard_sets_user_id ON flashcard_sets(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON flashcards(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON summaries(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_quiz_questions_user_id ON quiz_questions(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_calendar_entries_user_id ON calendar_entries(user_id)",
        # sessions
        "CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token)",
        # user email uniqueness
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)",
        "CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email)",
    ]
    with engine.begin() as conn:
        for stmt in index_statements:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                print(f"[WARN] Failed to apply index: {stmt} ({e})")


ensure_indexes()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
    db,
    allow_anon: bool,
) -> User:
    if credentials is None:
        if ALLOW_ANON and allow_anon:
            demo_user = db.query(User).filter(User.id == DEMO_USER_ID).first()
            if not demo_user:
                demo_user = User(id=DEMO_USER_ID, email="demo@local")
                db.add(demo_user)
                db.commit()
            return demo_user
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    session = db.query(AuthSession).filter(
        AuthSession.token == token,
        AuthSession.user_id == user_id,
        AuthSession.revoked_at.is_(None),
    ).first()
    if not session or session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Session expired")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db=Depends(get_db),
) -> User:
    return _get_current_user(request, credentials, db, allow_anon=False)


def get_demo_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db=Depends(get_db),
) -> User:
    return _get_current_user(request, credentials, db, allow_anon=True)


def parse_json_response(result: str):
    """Parse JSON from OpenAI response, handling markdown code blocks."""
    if result.startswith("```"):
        result = result.split("```")[1]
        if result.startswith("json"):
            result = result[4:]
    return json.loads(result.strip())


def extract_course_metadata(text: str):
    """PASS 1: Extract course metadata from syllabus."""
    print("[DEBUG] PASS 1: Extracting course metadata...")

    system_prompt = """You are a syllabus parser. Extract the course metadata AND detailed course information from this syllabus.

Return ONLY valid JSON with no additional text:
{
    "course_name": "Course code and name (e.g., 'FINC 313 - Corporate Finance')",
    "semester": "Semester name (e.g., 'Spring 2026')",
    "start_date": "First day of class in YYYY-MM-DD format (infer from semester if not explicit)",
    "end_date": "Last day of class/finals in YYYY-MM-DD format (infer from semester if not explicit)",
    "holidays": ["List of break dates or holidays mentioned"],
    "instructor": "Professor name if mentioned",
    "course_info": {
        "instructor": {
            "name": "Full name with title (e.g., 'Dr. John Smith')",
            "email": "Email address or null",
            "office": "Office location or null",
            "office_hours": "Office hours days/times or null",
            "phone": "Phone number or null"
        },
        "logistics": {
            "meeting_times": "Class meeting days/times (e.g., 'Mon/Wed 2:00-3:15 PM') or null",
            "location": "Classroom/building location or null",
            "attendance_policy": "Attendance policy summary or null",
            "late_work_policy": "Late work policy summary or null"
        },
        "grade_breakdown": [
            {"component": "Component name (e.g., 'Exams')", "weight": "Weight (e.g., '40%')"}
        ],
        "policies": {
            "participation": "Participation requirements or null",
            "extra_credit": "Extra credit opportunities or null",
            "academic_integrity": "Academic integrity policy summary or null",
            "prerequisites": "Prerequisite courses or null"
        },
        "materials": {
            "required_textbooks": ["List of required textbook titles"],
            "recommended_readings": ["List of recommended reading titles"],
            "course_portal": "Course website/portal URL or null",
            "ta_info": "TA name and contact info or null"
        }
    }
}

For semester dates, use these typical academic calendars:
- Spring semester: mid-January to mid-May
- Fall semester: late August to mid-December
- Summer: May to August

If the year is 2026 and semester is Spring, start_date would be around 2026-01-12 and end_date around 2026-05-08.

IMPORTANT: For any field where information is not found in the syllabus, use null (for strings) or empty arrays (for lists). Extract as much detail as possible."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract metadata from this syllabus:\n\n{text[:15000]}"}
            ],
            temperature=0.1,
            max_tokens=2000
        )

        result = response.choices[0].message.content
        print(f"[DEBUG] Metadata response: {result}")
        metadata = parse_json_response(result)
        print(f"[DEBUG] Parsed metadata: {metadata}")
        return metadata

    except Exception as e:
        print(f"[ERROR] Metadata extraction failed: {e}")
        return {
            "course_name": "Unknown Course",
            "semester": "Unknown",
            "start_date": None,
            "end_date": None,
            "holidays": [],
            "instructor": None,
            "course_info": None
        }


def extract_deadlines_with_context(text: str, metadata: dict):
    """PASS 2: Extract deadlines using course metadata for context."""
    print("[DEBUG] PASS 2: Extracting deadlines with context...")

    max_chars = 25000
    if len(text) > max_chars:
        text = text[:max_chars]
        print(f"[DEBUG] Truncated text to {max_chars} characters")

    start_date = metadata.get("start_date", "2026-01-12")
    end_date = metadata.get("end_date", "2026-05-08")
    semester = metadata.get("semester", "Spring 2026")

    system_prompt = f"""You are parsing a college course syllabus. The course runs from {start_date} to {end_date} ({semester}).

EXTRACT THESE TYPES OF DEADLINES:

1. EXAMS - Midterms, finals with SPECIFIC DATES
2. MAJOR ASSIGNMENTS - Papers, projects, case studies with DUE DATES
3. PRESENTATIONS - With specific dates
4. RECURRING ASSESSMENTS - Weekly quizzes, homework, reading checks (mark as recurring)
5. IMPORTANT ADMIN DATES - Add/drop deadline, final exam date

DO NOT EXTRACT:
- Regular class meeting times
- Office hours
- Reading assignments without assessments
- Topic lists without deliverables

HANDLING RECURRING ITEMS:
If you see patterns like "Quiz every Monday", "Weekly homework due Fridays", or "Reading quiz each Tuesday":
- Create ONE entry with recurring=true
- Set frequency="weekly" and day_of_week to the specific day
- Use the FIRST occurrence date (or first Monday/Tuesday/etc after semester start)

Return ONLY a valid JSON array. Each item must have:
{{
    "date": "YYYY-MM-DD (first occurrence for recurring, or specific date)",
    "type": "Exam|Assignment|Project|Quiz|Homework|Admin",
    "title": "Descriptive name (e.g., 'Midterm Exam', 'Weekly Quiz', 'Homework')",
    "context": "Brief description from syllabus",
    "time": "Due time if mentioned (e.g., '11:59pm'), or null",
    "recurring": true/false (true if it repeats weekly),
    "frequency": "weekly" or null,
    "day_of_week": "Monday|Tuesday|...|Sunday" or null
}}

Examples of GOOD entries:
- {{"date": "2026-02-15", "type": "Exam", "title": "Midterm Exam", "context": "Covers chapters 1-5", "time": "10:00am", "recurring": false}}
- {{"date": "2026-01-20", "type": "Quiz", "title": "Weekly Quiz", "context": "Online quiz on reading material", "time": "11:59pm", "recurring": true, "frequency": "weekly", "day_of_week": "Monday"}}
- {{"date": "2026-01-17", "type": "Homework", "title": "Problem Set", "context": "Weekly problem sets due every Friday", "time": "5:00pm", "recurring": true, "frequency": "weekly", "day_of_week": "Friday"}}

Return [] if no deadlines found."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract ONLY specific deadlines with real dates from this syllabus:\n\n{text}"}
            ],
            temperature=0.1,
            max_tokens=4000
        )

        result = response.choices[0].message.content
        print(f"[DEBUG] Deadlines response (first 1000 chars): {result[:1000]}...")

        deadlines = parse_json_response(result)
        print(f"[DEBUG] Parsed {len(deadlines)} deadlines before validation")

        # Validate and filter deadlines
        validated = validate_deadlines(deadlines)
        print(f"[DEBUG] {len(validated)} deadlines after validation")

        # Expand recurring deadlines into individual instances
        expanded = expand_recurring_deadlines(validated, start_date, end_date)
        print(f"[DEBUG] {len(expanded)} deadlines after recurring expansion")

        return expanded

    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse deadlines JSON: {e}")
        return []
    except Exception as e:
        print(f"[ERROR] Deadline extraction failed: {e}")
        raise


def expand_recurring_deadlines(deadlines: list, start_date_str: str, end_date_str: str) -> list:
    """Expand recurring deadlines into individual instances."""
    DAY_MAP = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
    }

    try:
        start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        print("[DEBUG] Invalid date range for recurring expansion, using defaults")
        start = date(2026, 1, 12)
        end = date(2026, 5, 8)

    expanded = []

    for d in deadlines:
        recurring = d.get("recurring", False)
        frequency = (d.get("frequency") or "").lower()
        day_of_week = (d.get("day_of_week") or "").lower()

        if recurring and frequency == "weekly" and day_of_week in DAY_MAP:
            # Expand weekly recurring deadline
            target_day = DAY_MAP[day_of_week]
            current = start
            instance_num = 1

            # Find first occurrence of the target day
            while current.weekday() != target_day:
                current += timedelta(days=1)

            # Generate all instances (skip first week usually just intro)
            current += timedelta(days=7)

            while current <= end:
                instance = {
                    "date": current.strftime("%Y-%m-%d"),
                    "time": d.get("time"),
                    "type": d.get("type", "Quiz"),
                    "title": f"{d.get('title', 'Weekly Item')} #{instance_num}",
                    "context": d.get("context") or d.get("description"),
                    "recurring": True,
                    "frequency": "weekly",
                    "day_of_week": d.get("day_of_week")
                }
                expanded.append(instance)
                instance_num += 1
                current += timedelta(days=7)

                # Limit to 15 instances max
                if instance_num > 15:
                    break

            print(f"[DEBUG] Expanded recurring '{d.get('title')}' into {instance_num - 1} instances")
        else:
            # Not recurring, keep as-is
            expanded.append(d)

    return expanded


def validate_deadlines(deadlines: list) -> list:
    """Filter out low-quality or duplicate deadlines."""
    validated = []
    seen_titles = set()

    # Generic titles to reject (but allow if marked as recurring with specific day)
    generic_patterns = [
        "class meeting",
        "office hours",
        "lecture",
    ]

    # Week patterns to reject
    week_patterns = ["week 1", "week 2", "week 3", "week 4", "week 5"]

    for d in deadlines:
        title = (d.get("title") or "").lower().strip()
        date_str = d.get("date") or ""

        # Skip if no date
        if not date_str or date_str == "null":
            print(f"[DEBUG] Skipping deadline with no date: {title}")
            continue

        # Skip class meetings, office hours, lectures
        if any(pattern in title for pattern in generic_patterns):
            print(f"[DEBUG] Skipping generic deadline: {title}")
            continue

        # Skip plain "Week X" entries
        if any(pattern in title for pattern in week_patterns):
            print(f"[DEBUG] Skipping week entry: {title}")
            continue

        # Skip duplicates (same title + same date)
        title_key = f"{title[:30]}_{date_str}"
        if title_key in seen_titles:
            print(f"[DEBUG] Skipping duplicate: {title}")
            continue
        seen_titles.add(title_key)

        validated.append(d)

    return validated


@app.get("/")
def health():
    return {"status": "ok"}


@app.get("/health")
def healthcheck():
    return {"ok": True}


# ============= Auth Endpoints =============

def _normalize_email(raw: str) -> str:
    return raw.lower().strip()


def _email_auth_response(user: User, profile: UserProfile | None) -> dict:
    return {
        "token_type": "bearer",
        "user_id": user.id,
        "profile": {
            "email": user.email,
            "full_name": profile.full_name if profile else None,
            "school_name": profile.school_name if profile else None,
            "school_type": profile.school_type if profile else None,
            "academic_year": profile.academic_year if profile else None,
            "major": profile.major if profile else None,
            "profile_picture": profile.profile_picture if profile else None,
        }
    }


def _get_or_create_email_user(db, email: str, full_name: str | None, allow_name_update: bool) -> tuple[User, UserProfile]:
    normalized = _normalize_email(email)
    user = db.query(User).filter(User.email == normalized).first()
    profile = db.query(UserProfile).filter(UserProfile.email == normalized).first()

    if user:
        if profile and allow_name_update and full_name and not profile.full_name:
            profile.full_name = full_name
            db.commit()
        return user, profile

    user = User(id=generate_uuid(), email=normalized)
    db.add(user)
    db.flush()

    profile = UserProfile(
        user_id=user.id,
        email=normalized,
        password_hash="otp",
        full_name=full_name,
    )
    db.add(profile)
    db.commit()
    return user, profile


def _create_session(db, user_id: str) -> str:
    token, expires_at = create_access_token(user_id)
    session = AuthSession(
        token=token,
        user_id=user_id,
        expires_at=expires_at,
        revoked_at=None,
    )
    db.add(session)
    db.commit()
    return token


@app.post("/auth/register")
def register_legacy():
    raise HTTPException(status_code=410, detail="Use /auth/request-code and /auth/verify-code")


@app.post("/auth/login")
def login_legacy():
    raise HTTPException(status_code=410, detail="Use /auth/request-code and /auth/verify-code")


@app.post("/auth/request-code")
def request_code(payload: EmailAuthRequest, request: Request, db=Depends(get_db)):
    if not payload.email or "@" not in payload.email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    email = _normalize_email(payload.email)
    _check_rate_limit(email, request.client.host if request.client else None)

    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash = _hash_code(code)
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    login_code = LoginCode(
        email=email,
        code_hash=code_hash,
        expires_at=expires_at,
        attempts=0,
    )
    db.add(login_code)
    db.commit()

    # Dev fallback (replace with provider later)
    print(f"[DEV] Login code for {email}: {code}")
    return {"ok": True}


@app.post("/auth/verify-code")
def verify_code(payload: VerifyCodeRequest, db=Depends(get_db)):
    if not payload.email or "@" not in payload.email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    email = _normalize_email(payload.email)
    record = (
        db.query(LoginCode)
        .filter(LoginCode.email == email)
        .order_by(LoginCode.created_at.desc())
        .first()
    )
    if not record or record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Code expired or invalid")
    if record.attempts >= 5:
        raise HTTPException(status_code=401, detail="Too many attempts")
    if not _verify_code(payload.code, record.code_hash):
        record.attempts += 1
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid code")

    user, profile = _get_or_create_email_user(db, email, None, allow_name_update=False)
    token = _create_session(db, user.id)
    response = _email_auth_response(user, profile)
    response["access_token"] = token
    return response


@app.get("/auth/session")
def get_session(current_user: User = Depends(get_current_user), db=Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "created_at": current_user.created_at,
            "full_name": profile.full_name if profile else None,
        }
    }


@app.get("/auth/me")
def get_me_auth(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "created_at": current_user.created_at}


@app.post("/auth/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db=Depends(get_db),
):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    session = db.query(AuthSession).filter(AuthSession.token == token, AuthSession.revoked_at.is_(None)).first()
    if session:
        session.revoked_at = datetime.utcnow()
        db.commit()
    return {"ok": True}


@app.post("/courses")
def create_course(payload: CreateCourseRequest, current_user: User = Depends(get_current_user)):
    """Create a course manually."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        if not payload.name:
            raise HTTPException(status_code=400, detail="Course name is required")

        start_date = None
        end_date = None
        if payload.start_date:
            try:
                start_date = date.fromisoformat(payload.start_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format")
        if payload.end_date:
            try:
                end_date = date.fromisoformat(payload.end_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format")

        course = Course(
            user_id=user_id,
            name=payload.name.strip(),
            code=payload.code.strip() if payload.code else None,
            semester=payload.semester.strip() if payload.semester else "Term TBD",
            start_date=start_date,
            end_date=end_date,
        )
        db.add(course)
        db.commit()
        db.refresh(course)

        return {
            "id": course.id,
            "name": course.name,
            "code": course.code,
            "semester": course.semester,
            "start_date": str(course.start_date) if course.start_date else None,
            "end_date": str(course.end_date) if course.end_date else None,
            "course_info": course.course_info,
            "deadline_count": 0,
            "flashcard_set_count": 0,
            "created_at": course.created_at.isoformat(),
        }
    finally:
        db.close()


@app.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        user_id = current_user.id
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            return {"user_id": user_id, "profile": None}
        return {
            "user_id": user_id,
            "profile": {
                "email": profile.email,
                "full_name": profile.full_name,
                "school_name": profile.school_name,
                "school_type": profile.school_type,
                "academic_year": profile.academic_year,
                "major": profile.major,
                "profile_picture": profile.profile_picture,
            }
        }
    finally:
        db.close()


@app.post("/me/profile")
def upsert_profile(payload: UserProfileRequest, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        user_id = current_user.id
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        profile.full_name = payload.full_name or profile.full_name
        profile.school_name = payload.school_name or profile.school_name
        profile.school_type = payload.school_type or profile.school_type
        profile.academic_year = payload.academic_year or profile.academic_year
        profile.major = payload.major or profile.major

        db.commit()
        return {
            "message": "Profile saved",
            "profile": {
                "email": profile.email,
                "full_name": profile.full_name,
                "school_name": profile.school_name,
                "school_type": profile.school_type,
                "academic_year": profile.academic_year,
                "major": profile.major,
                "profile_picture": profile.profile_picture,
            }
        }
    finally:
        db.close()


@app.post("/me/profile-picture")
def upload_profile_picture(payload: ProfilePictureRequest, current_user: User = Depends(get_current_user)):
    """Upload a profile picture as base64."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        if len(payload.image_data) > 500_000:
            raise HTTPException(status_code=400, detail="Image too large (max ~375KB)")

        profile.profile_picture = payload.image_data
        db.commit()
        return {"message": "Profile picture updated", "profile_picture": profile.profile_picture}
    finally:
        db.close()


@app.get("/courses")
def list_courses(current_user: User = Depends(get_current_user)):
    """List all courses."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        courses = db.query(Course).filter(Course.user_id == user_id).order_by(Course.created_at.desc()).all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "semester": c.semester,
                "start_date": str(c.start_date) if c.start_date else None,
                "end_date": str(c.end_date) if c.end_date else None,
                "course_info": c.course_info,
                "deadline_count": len(c.deadlines),
                "flashcard_set_count": len(c.flashcard_sets),
                "created_at": c.created_at.isoformat()
            }
            for c in courses
        ]
    finally:
        db.close()


@app.get("/courses/{course_id}")
def get_course(course_id: str, current_user: User = Depends(get_current_user)):
    """Get a course with its deadlines and flashcard sets."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        course = db.query(Course).filter(Course.id == course_id, Course.user_id == user_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        # Get calendar entries for this course's deadlines
        deadline_ids = [d.id for d in course.deadlines]
        calendar_entries = db.query(CalendarEntry).filter(
            CalendarEntry.deadline_id.in_(deadline_ids),
            CalendarEntry.user_id == user_id
        ).all()
        saved_deadline_ids = {e.deadline_id for e in calendar_entries}

        return {
            "id": course.id,
            "name": course.name,
            "code": course.code,
            "semester": course.semester,
            "start_date": str(course.start_date) if course.start_date else None,
            "end_date": str(course.end_date) if course.end_date else None,
            "course_info": course.course_info,
            "deadlines": [
                {
                    "id": d.id,
                    "date": d.date,
                    "time": d.time,
                    "type": d.type,
                    "title": d.title,
                    "description": d.description,
                    "recurring": d.recurring,
                    "frequency": d.frequency,
                    "day_of_week": d.day_of_week,
                    "completed": d.completed,
                    "saved_to_calendar": d.id in saved_deadline_ids
                }
                for d in sorted(course.deadlines, key=lambda x: x.date or "9999")
            ],
            "flashcard_sets": [
                {
                    "id": fs.id,
                    "name": fs.name,
                    "card_count": len(fs.flashcards),
                    "created_at": fs.created_at.isoformat()
                }
                for fs in course.flashcard_sets
            ],
            "summaries": [
                {
                    "id": s.id,
                    "title": s.title,
                    "content": s.content,
                    "created_at": s.created_at.isoformat()
                }
                for s in sorted(course.summaries, key=lambda x: x.created_at, reverse=True)
            ],
            "quizzes": [
                {
                    "id": q.id,
                    "name": q.name,
                    "question_count": len(q.questions),
                    "created_at": q.created_at.isoformat()
                }
                for q in course.quizzes
            ]
        }
    finally:
        db.close()


@app.get("/courses/{course_id}/deadlines")
def list_course_deadlines(course_id: str, current_user: User = Depends(get_current_user)):
    """List deadlines for a specific course."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        deadlines = db.query(Deadline).filter(Deadline.course_id == course_id, Deadline.user_id == user_id).all()
        return [
            {
                "id": d.id,
                "course_id": d.course_id,
                "date": d.date,
                "time": d.time,
                "type": d.type,
                "title": d.title,
                "description": d.description,
                "recurring": d.recurring,
                "frequency": d.frequency,
                "day_of_week": d.day_of_week,
                "completed": d.completed
            }
            for d in sorted(deadlines, key=lambda x: x.date or "9999")
        ]
    finally:
        db.close()


@app.get("/deadlines")
def list_all_deadlines(
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    course_id: str | None = None,
    current_user: User = Depends(get_current_user),
):
    """Get all deadlines from all courses (for calendar view)."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        print(f"[DEBUG] /deadlines request from={from_date} to={to_date} course_id={course_id}")
        query = db.query(Deadline).join(Course).filter(Deadline.user_id == user_id)
        if course_id:
            query = query.filter(Deadline.course_id == course_id)
        if from_date:
            query = query.filter(Deadline.date >= from_date)
        if to_date:
            query = query.filter(Deadline.date <= to_date)
        deadlines = query.all()
        return [
            {
                "id": d.id,
                "course_id": d.course_id,
                "course_name": d.course.name,
                "course_code": d.course.code,
                "date": d.date,
                "time": d.time,
                "type": d.type,
                "title": d.title,
                "description": d.description,
                "recurring": d.recurring,
                "frequency": d.frequency,
                "day_of_week": d.day_of_week,
                "completed": d.completed
            }
            for d in sorted(deadlines, key=lambda x: x.date or "9999")
        ]
    finally:
        db.close()


@app.post("/deadlines")
def create_deadline(payload: CreateDeadlineRequest, current_user: User = Depends(get_current_user)):
    """Create a custom deadline (user-generated, not from syllabus)."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        if not payload.course_id:
            raise HTTPException(status_code=400, detail="course_id is required")

        course = db.query(Course).filter(Course.id == payload.course_id, Course.user_id == user_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        deadline = Deadline(
            user_id=user_id,
            course_id=payload.course_id,
            date=payload.date,
            time=payload.time,
            type=payload.type or "Deadline",
            title=payload.title,
            description=payload.description,
            recurring=False,
        )
        db.add(deadline)
        db.commit()
        db.refresh(deadline)

        return {
            "id": deadline.id,
            "course_id": deadline.course_id,
            "course_name": course.name if course else None,
            "course_code": course.code if course else None,
            "date": deadline.date,
            "time": deadline.time,
            "type": deadline.type,
            "title": deadline.title,
            "description": deadline.description,
            "completed": deadline.completed,
        }
    finally:
        db.close()


@app.delete("/deadlines/{deadline_id}")
def delete_deadline(deadline_id: str, current_user: User = Depends(get_current_user)):
    """Delete a deadline."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        deadline = db.query(Deadline).filter(Deadline.id == deadline_id, Deadline.user_id == user_id).first()
        if not deadline:
            raise HTTPException(status_code=404, detail="Deadline not found")

        # Also remove calendar entry if exists
        calendar_entry = db.query(CalendarEntry).filter(
            CalendarEntry.deadline_id == deadline_id,
            CalendarEntry.user_id == user_id
        ).first()
        if calendar_entry:
            db.delete(calendar_entry)

        db.delete(deadline)
        db.commit()
        return {"message": "Deadline deleted"}
    finally:
        db.close()


@app.patch("/deadlines/{deadline_id}/complete")
def toggle_deadline_complete(deadline_id: str, current_user: User = Depends(get_current_user)):
    """Toggle a deadline's completed status."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        deadline = db.query(Deadline).filter(Deadline.id == deadline_id, Deadline.user_id == user_id).first()
        if not deadline:
            raise HTTPException(status_code=404, detail="Deadline not found")

        deadline.completed = not deadline.completed
        db.commit()
        return {"id": deadline.id, "completed": deadline.completed}
    finally:
        db.close()


@app.patch("/deadlines/{deadline_id}")
def update_deadline(deadline_id: str, payload: UpdateDeadlineRequest, current_user: User = Depends(get_current_user)):
    """Update deadline fields (currently supports date only)."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        deadline = db.query(Deadline).filter(Deadline.id == deadline_id, Deadline.user_id == user_id).first()
        if not deadline:
            raise HTTPException(status_code=404, detail="Deadline not found")

        if payload.date:
            deadline.date = payload.date

        db.commit()
        return {"id": deadline.id, "date": deadline.date}
    finally:
        db.close()

@app.post("/deadlines/{deadline_id}/save-to-calendar")
def save_deadline_to_calendar(deadline_id: str, current_user: User = Depends(get_current_user)):
    """Save a deadline to the user's calendar."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        deadline = db.query(Deadline).filter(Deadline.id == deadline_id, Deadline.user_id == user_id).first()
        if not deadline:
            raise HTTPException(status_code=404, detail="Deadline not found")

        # Check if already saved
        existing = db.query(CalendarEntry).filter(
            CalendarEntry.deadline_id == deadline_id,
            CalendarEntry.user_id == user_id
        ).first()
        if existing:
            return {"id": existing.id, "deadline_id": deadline_id, "already_saved": True}

        # Create calendar entry
        entry = CalendarEntry(deadline_id=deadline_id, user_id=user_id)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        return {
            "id": entry.id,
            "deadline_id": deadline_id,
            "created_at": entry.created_at.isoformat(),
            "already_saved": False
        }
    finally:
        db.close()


@app.delete("/deadlines/{deadline_id}/save-to-calendar")
def remove_deadline_from_calendar(deadline_id: str, current_user: User = Depends(get_current_user)):
    """Remove a deadline from the user's calendar."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        entry = db.query(CalendarEntry).filter(
            CalendarEntry.deadline_id == deadline_id,
            CalendarEntry.user_id == user_id
        ).first()
        if not entry:
            raise HTTPException(status_code=404, detail="Calendar entry not found")

        db.delete(entry)
        db.commit()
        return {"message": "Removed from calendar"}
    finally:
        db.close()


@app.get("/calendar-entries")
def list_calendar_entries(current_user: User = Depends(get_current_user)):
    """Get all deadlines that have been saved to calendar."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        entries = db.query(CalendarEntry).filter(CalendarEntry.user_id == user_id).all()
        result = []
        for entry in entries:
            deadline = entry.deadline
            if deadline:
                result.append({
                    "id": entry.id,
                    "deadline_id": deadline.id,
                    "course_id": deadline.course_id,
                    "course_name": deadline.course.name if deadline.course else None,
                    "course_code": deadline.course.code if deadline.course else None,
                    "date": deadline.date,
                    "time": deadline.time,
                    "type": deadline.type,
                    "title": deadline.title,
                    "description": deadline.description,
                    "completed": deadline.completed,
                    "saved_at": entry.created_at.isoformat()
                })
        return result
    finally:
        db.close()


@app.delete("/courses/{course_id}")
def delete_course(course_id: str, current_user: User = Depends(get_current_user)):
    """Delete a course and all its deadlines."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        course = db.query(Course).filter(Course.id == course_id, Course.user_id == user_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        deadline_ids = [d.id for d in course.deadlines]
        if deadline_ids:
            db.query(CalendarEntry).filter(
                CalendarEntry.deadline_id.in_(deadline_ids),
                CalendarEntry.user_id == user_id
            ).delete(synchronize_session=False)

        db.delete(course)
        db.commit()
        return {"message": "Course deleted"}
    finally:
        db.close()


@app.patch("/courses/{course_id}")
def update_course(course_id: str, payload: UpdateCourseRequest, current_user: User = Depends(get_current_user)):
    """Update course fields."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        course = db.query(Course).filter(Course.id == course_id, Course.user_id == user_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        if payload.name is not None:
            course.name = payload.name.strip()
        if payload.code is not None:
            course.code = payload.code.strip() if payload.code else None
        if payload.semester is not None:
            course.semester = payload.semester.strip() if payload.semester else None
        if payload.start_date:
            course.start_date = date.fromisoformat(payload.start_date)
        if payload.end_date:
            course.end_date = date.fromisoformat(payload.end_date)
        if payload.course_info is not None:
            course.course_info = payload.course_info

        db.commit()
        db.refresh(course)
        return {
            "id": course.id,
            "name": course.name,
            "code": course.code,
            "semester": course.semester,
            "start_date": str(course.start_date) if course.start_date else None,
            "end_date": str(course.end_date) if course.end_date else None,
            "course_info": course.course_info,
        }
    finally:
        db.close()


@app.post("/courses/{course_id}/syllabus")
async def upload_course_syllabus(course_id: str, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload a syllabus PDF and attach extracted deadlines to an existing course."""
    print(f"[DEBUG] /courses/{course_id}/syllabus request received")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    content = await file.read()
    pdf = PyPDF2.PdfReader(io.BytesIO(content))

    text = ""
    for i, page in enumerate(pdf.pages):
        page_text = page.extract_text() or ""
        print(f"[DEBUG] Page {i+1}: {len(page_text)} characters extracted")
        text += page_text + "\n"

    print(f"[DEBUG] Total text extracted: {len(text)} characters")

    if len(text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")

    metadata = extract_course_metadata(text)
    deadlines_data = extract_deadlines_with_context(text, metadata)
    print(f"[DEBUG] Deadline extraction returned {len(deadlines_data)} items")

    db = SessionLocal()
    try:
        user_id = current_user.id
        course = db.query(Course).filter(Course.id == course_id, Course.user_id == user_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        # Update course_info from parsed metadata
        course_info = metadata.get("course_info")
        if course_info:
            course.course_info = course_info

        for d in deadlines_data:
            deadline = Deadline(
                user_id=user_id,
                course_id=course_id,
                date=d.get("date"),
                time=d.get("time"),
                type=d.get("type"),
                title=d.get("title"),
                description=d.get("context") or d.get("description"),
                recurring=d.get("recurring", False),
                frequency=d.get("frequency"),
                day_of_week=d.get("day_of_week")
            )
            db.add(deadline)

        db.commit()
        print(f"[DEBUG] Inserted {len(deadlines_data)} deadlines for course {course_id}")

        return {
            "course_id": course_id,
            "deadlines_created": len(deadlines_data),
            "deadlines": deadlines_data,
            "course_info": course.course_info
        }
    finally:
        db.close()


@app.post("/courses/{course_id}/summaries")
async def generate_summary(course_id: str, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload notes and generate a study summary attached to a course."""
    print(f"[DEBUG] /courses/{course_id}/summaries request received")
    db = SessionLocal()
    try:
        user_id = current_user.id
        course = db.query(Course).filter(Course.id == course_id, Course.user_id == user_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        content = await file.read()
        filename = file.filename.lower()

        if filename.endswith(".pdf"):
            text = extract_text_from_pdf(content)
            print(f"[DEBUG] Summary PDF text length: {len(text)}")
            summary_text = generate_summary_from_text(text)
        elif filename.endswith(".txt"):
            text = content.decode("utf-8", errors="ignore")
            print(f"[DEBUG] Summary TXT length: {len(text)}")
            summary_text = generate_summary_from_text(text)
        elif filename.endswith(".docx"):
            text = extract_text_from_docx(content)
            print(f"[DEBUG] Summary DOCX length: {len(text)}")
            summary_text = generate_summary_from_text(text)
        elif filename.endswith((".png", ".jpg", ".jpeg")):
            print(f"[DEBUG] Summary image size: {len(content)} bytes")
            summary_text = generate_summary_from_image(content, filename)
        else:
            raise HTTPException(status_code=400, detail="Supported formats: PDF, DOCX, TXT, PNG, JPG")

        summary = Summary(
            user_id=user_id,
            course_id=course_id,
            title=file.filename.rsplit(".", 1)[0],
            content=summary_text
        )
        db.add(summary)
        db.commit()
        db.refresh(summary)

        print(f"[DEBUG] Summary created {summary.id}")
        return {
            "id": summary.id,
            "course_id": course_id,
            "title": summary.title,
            "content": summary.content,
            "created_at": summary.created_at.isoformat()
        }
    finally:
        db.close()


@app.delete("/summaries/{summary_id}")
def delete_summary(summary_id: str, current_user: User = Depends(get_current_user)):
    """Delete a summary."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        summary = db.query(Summary).filter(Summary.id == summary_id, Summary.user_id == user_id).first()
        if not summary:
            raise HTTPException(status_code=404, detail="Summary not found")
        db.delete(summary)
        db.commit()
        return {"message": "Summary deleted"}
    finally:
        db.close()


@app.get("/summaries/{summary_id}")
def get_summary(summary_id: str, current_user: User = Depends(get_current_user)):
    """Get a summary with course info."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        summary = db.query(Summary).filter(Summary.id == summary_id, Summary.user_id == user_id).first()
        if not summary:
            raise HTTPException(status_code=404, detail="Summary not found")
        course = db.query(Course).filter(Course.id == summary.course_id, Course.user_id == user_id).first()
        return {
            "id": summary.id,
            "title": summary.title,
            "content": summary.content,
            "created_at": summary.created_at.isoformat(),
            "course_id": summary.course_id,
            "course_name": course.name if course else None,
            "course_code": course.code if course else None
        }
    finally:
        db.close()


# Flashcard endpoints
@app.post("/courses/{course_id}/flashcards")
async def generate_flashcards(course_id: str, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload study material and generate flashcards using AI."""
    print(f"[DEBUG] /courses/{course_id}/flashcards request received")
    db = SessionLocal()
    try:
        user_id = current_user.id
        course = db.query(Course).filter(Course.id == course_id, Course.user_id == user_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        # Extract text from file
        content = await file.read()
        filename = file.filename.lower()

        if filename.endswith('.pdf'):
            pdf = PyPDF2.PdfReader(io.BytesIO(content))
            text = ""
            for page in pdf.pages:
                text += (page.extract_text() or "") + "\n"
        elif filename.endswith('.txt'):
            text = content.decode('utf-8')
        else:
            raise HTTPException(status_code=400, detail="Supported formats: PDF, TXT")

        print(f"[DEBUG] Extracted {len(text)} characters from study material")

        if len(text.strip()) < 100:
            raise HTTPException(status_code=400, detail="Could not extract enough text from file")

        print(f"[DEBUG] Generating flashcards from {len(text)} characters")

        # Truncate if too long
        max_chars = 15000
        if len(text) > max_chars:
            text = text[:max_chars]

        flashcards_data = []
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            # Generate flashcards with OpenAI
            system_prompt = """You are a study assistant. Generate flashcards from the provided study material.

Return ONLY a valid JSON array with 10-20 flashcards:
[
    {"front": "Question or term", "back": "Answer or definition"},
    ...
]

Focus on:
- Key concepts and definitions
- Important facts and dates
- Formulas and their applications
- Cause and effect relationships
- Compare and contrast items

Make questions clear and answers concise but complete."""

            try:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Generate flashcards from this material:\n\n{text}"}
                    ],
                    temperature=0.3,
                    max_tokens=4000
                )

                result = response.choices[0].message.content
                print(f"[DEBUG] Flashcard response: {result[:500]}...")

                flashcards_data = parse_json_response(result)
                print(f"[DEBUG] Generated {len(flashcards_data)} flashcards")
            except Exception as e:
                print(f"[WARN] OpenAI flashcard generation failed: {e}")
                flashcards_data = generate_flashcards_fallback(text)
        else:
            print("[WARN] OPENAI_API_KEY not set; using fallback flashcard generator")
            flashcards_data = generate_flashcards_fallback(text)

        # Create flashcard set
        flashcard_set = FlashcardSet(
            user_id=user_id,
            course_id=course_id,
            name=file.filename.rsplit('.', 1)[0]  # Use filename without extension
        )
        db.add(flashcard_set)
        db.flush()

        # Create flashcards
        for fc in flashcards_data:
            flashcard = Flashcard(
                user_id=user_id,
                flashcard_set_id=flashcard_set.id,
                front=fc.get("front", ""),
                back=fc.get("back", "")
            )
            db.add(flashcard)

        db.commit()
        print(f"[DEBUG] Inserted {len(flashcards_data)} flashcards for course {course_id}")

        return {
            "flashcard_set": {
                "id": flashcard_set.id,
                "name": flashcard_set.name,
                "card_count": len(flashcards_data)
            },
            "flashcards": flashcards_data
        }

    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse flashcards JSON: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate flashcards")
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating flashcards: {str(e)}")
    finally:
        db.close()


@app.get("/flashcard-sets/{set_id}")
def get_flashcard_set(set_id: str, current_user: User = Depends(get_current_user)):
    """Get a flashcard set with all its cards."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        flashcard_set = db.query(FlashcardSet).filter(FlashcardSet.id == set_id, FlashcardSet.user_id == user_id).first()
        if not flashcard_set:
            raise HTTPException(status_code=404, detail="Flashcard set not found")

        return {
            "id": flashcard_set.id,
            "name": flashcard_set.name,
            "course_id": flashcard_set.course_id,
            "flashcards": [
                {"id": fc.id, "front": fc.front, "back": fc.back}
                for fc in flashcard_set.flashcards
            ]
        }
    finally:
        db.close()


@app.delete("/flashcard-sets/{set_id}")
def delete_flashcard_set(set_id: str, current_user: User = Depends(get_current_user)):
    """Delete a flashcard set."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        flashcard_set = db.query(FlashcardSet).filter(FlashcardSet.id == set_id, FlashcardSet.user_id == user_id).first()
        if not flashcard_set:
            raise HTTPException(status_code=404, detail="Flashcard set not found")

        db.delete(flashcard_set)
        db.commit()
        return {"message": "Flashcard set deleted"}
    finally:
        db.close()


@app.post("/upload")
async def upload_syllabus(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    print("[DEBUG] /upload request received")
    user_id = current_user.id
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        print(f"[DEBUG] Processing file: {file.filename}")
        content = await file.read()
        pdf = PyPDF2.PdfReader(io.BytesIO(content))

        text = ""
        for i, page in enumerate(pdf.pages):
            page_text = page.extract_text() or ""
            print(f"[DEBUG] Page {i+1}: {len(page_text)} characters extracted")
            text += page_text + "\n"

        print(f"[DEBUG] Total text extracted: {len(text)} characters")

        if len(text.strip()) < 50:
            return {
                "course": None,
                "deadlines": [],
                "debug": {
                    "text_length": len(text),
                    "dates_found": 0,
                    "message": "Could not extract text from PDF. The PDF might be scanned/image-based."
                }
            }

        # PASS 1: Extract course metadata
        metadata = extract_course_metadata(text)

        # PASS 2: Extract deadlines with context
        deadlines_data = extract_deadlines_with_context(text, metadata)

        # Save to database
        db = SessionLocal()
        try:
            # Parse course code from name (e.g., "FINC 313 - Corporate Finance" -> "FINC 313")
            course_name = metadata.get("course_name", "Unknown Course")
            course_code = None
            if " - " in course_name:
                parts = course_name.split(" - ")
                course_code = parts[0].strip()
                course_name = parts[1].strip() if len(parts) > 1 else course_name

            # Create course
            course = Course(
                user_id=user_id,
                name=course_name,
                code=course_code,
                semester=metadata.get("semester"),
                start_date=datetime.strptime(metadata["start_date"], "%Y-%m-%d").date() if metadata.get("start_date") else None,
                end_date=datetime.strptime(metadata["end_date"], "%Y-%m-%d").date() if metadata.get("end_date") else None,
                course_info=metadata.get("course_info")
            )
            db.add(course)
            db.flush()  # Get the course ID

            # Create deadlines
            for d in deadlines_data:
                deadline = Deadline(
                    user_id=user_id,
                    course_id=course.id,
                    date=d.get("date"),
                    time=d.get("time"),
                    type=d.get("type"),
                    title=d.get("title"),
                    description=d.get("context") or d.get("description"),
                    recurring=d.get("recurring", False),
                    frequency=d.get("frequency"),
                    day_of_week=d.get("day_of_week")
                )
                db.add(deadline)

            db.commit()

            return {
                "course": {
                    "id": course.id,
                    "name": course.name,
                    "code": course.code,
                    "semester": course.semester,
                    "start_date": str(course.start_date) if course.start_date else None,
                    "end_date": str(course.end_date) if course.end_date else None,
                    "course_info": course.course_info
                },
                "deadlines": deadlines_data,
                "debug": {
                    "text_length": len(text),
                    "dates_found": len(deadlines_data),
                    "message": f"Found {len(deadlines_data)} deadlines using AI (2-pass extraction)"
                }
            }
        finally:
            db.close()

    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


# ============= Quiz Endpoints =============

@app.post("/courses/{course_id}/generate-quiz")
async def generate_quiz(course_id: str, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Generate a multiple-choice quiz from study materials."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        course = db.query(Course).filter(Course.id == course_id, Course.user_id == user_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        # Extract text from file
        content = await file.read()
        filename = file.filename.lower()

        if filename.endswith('.pdf'):
            pdf = PyPDF2.PdfReader(io.BytesIO(content))
            text = ""
            for page in pdf.pages:
                text += (page.extract_text() or "") + "\n"
        elif filename.endswith('.txt'):
            text = content.decode('utf-8')
        elif filename.endswith('.docx'):
            # For simplicity, treat as text; proper DOCX parsing would require python-docx
            text = content.decode('utf-8', errors='ignore')
        else:
            raise HTTPException(status_code=400, detail="Supported formats: PDF, TXT, DOCX")

        print(f"[DEBUG] Extracted {len(text)} characters for quiz generation")

        if len(text.strip()) < 100:
            raise HTTPException(status_code=400, detail="Could not extract enough text from file")

        # Truncate if too long
        max_chars = 15000
        if len(text) > max_chars:
            text = text[:max_chars]

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Quiz generation requires OpenAI API key")

        # Generate quiz with OpenAI
        system_prompt = """You are a study assistant. Generate a multiple-choice quiz from the provided study material.

Return ONLY a valid JSON object with this structure:
{
    "questions": [
        {
            "question": "Clear question text",
            "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"],
            "correct_answer": "B",
            "explanation": "Brief explanation of why this is correct"
        }
    ]
}

Guidelines:
- Generate 7 questions
- Each question should have exactly 4 options (A, B, C, D)
- Questions should test understanding, not just memorization
- Include a mix of difficulty levels
- Make distractors (wrong answers) plausible
- Keep explanations concise (1-2 sentences)"""

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Generate a quiz from this material:\n\n{text}"}
                ],
                temperature=0.4,
                max_tokens=4000
            )

            result = response.choices[0].message.content
            print(f"[DEBUG] Quiz response: {result[:500]}...")

            quiz_data = parse_json_response(result)

            # Handle both array and object responses
            if isinstance(quiz_data, list):
                questions = quiz_data
            elif isinstance(quiz_data, dict) and "questions" in quiz_data:
                questions = quiz_data["questions"]
            else:
                raise ValueError("Invalid quiz format from AI")

            print(f"[DEBUG] Generated {len(questions)} quiz questions")

        except Exception as e:
            print(f"[ERROR] Quiz generation failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate quiz questions")

        # Create quiz
        quiz = Quiz(
            user_id=user_id,
            course_id=course_id,
            name=file.filename.rsplit('.', 1)[0]  # Use filename without extension
        )
        db.add(quiz)
        db.flush()

        # Create questions
        for i, q in enumerate(questions):
            options = q.get("options", [])
            if isinstance(options, list):
                options_json = json.dumps(options)
            else:
                options_json = json.dumps([])

            question = QuizQuestion(
                user_id=user_id,
                quiz_id=quiz.id,
                question=q.get("question", ""),
                options=options_json,
                correct_answer=q.get("correct_answer", "A"),
                explanation=q.get("explanation", ""),
                order_num=str(i)
            )
            db.add(question)

        db.commit()
        print(f"[DEBUG] Created quiz with {len(questions)} questions for course {course_id}")

        return {
            "quiz": {
                "id": quiz.id,
                "name": quiz.name,
                "question_count": len(questions)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")
    finally:
        db.close()


@app.get("/quizzes/{quiz_id}")
def get_quiz(quiz_id: str, current_user: User = Depends(get_current_user)):
    """Get a quiz with all its questions."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user_id).first()
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")

        questions = []
        for q in sorted(quiz.questions, key=lambda x: x.order_num):
            try:
                options = json.loads(q.options)
            except:
                options = []

            questions.append({
                "id": q.id,
                "question": q.question,
                "options": options,
                # Don't include correct_answer or explanation in GET - only after submission
            })

        return {
            "id": quiz.id,
            "name": quiz.name,
            "course_id": quiz.course_id,
            "question_count": len(questions),
            "questions": questions
        }
    finally:
        db.close()


@app.post("/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: str, submission: QuizSubmission, current_user: User = Depends(get_current_user)):
    """Submit quiz answers and get results."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user_id).first()
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")

        results = []
        correct_count = 0
        total_count = len(quiz.questions)

        for q in sorted(quiz.questions, key=lambda x: x.order_num):
            user_answer = submission.answers.get(q.id, "")
            is_correct = user_answer.upper() == q.correct_answer.upper()

            if is_correct:
                correct_count += 1

            try:
                options = json.loads(q.options)
            except:
                options = []

            results.append({
                "question_id": q.id,
                "question": q.question,
                "options": options,
                "user_answer": user_answer,
                "correct_answer": q.correct_answer,
                "is_correct": is_correct,
                "explanation": q.explanation
            })

        score_percentage = round((correct_count / total_count) * 100) if total_count > 0 else 0

        return {
            "quiz_id": quiz_id,
            "quiz_name": quiz.name,
            "score": correct_count,
            "total": total_count,
            "percentage": score_percentage,
            "results": results
        }
    finally:
        db.close()


@app.get("/courses/{course_id}/quizzes")
def get_course_quizzes(course_id: str, current_user: User = Depends(get_current_user)):
    """Get all quizzes for a course."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        course = db.query(Course).filter(Course.id == course_id, Course.user_id == user_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        return [
            {
                "id": quiz.id,
                "name": quiz.name,
                "question_count": len(quiz.questions),
                "created_at": quiz.created_at.isoformat() if quiz.created_at else None
            }
            for quiz in course.quizzes
        ]
    finally:
        db.close()


@app.delete("/quizzes/{quiz_id}")
def delete_quiz(quiz_id: str, current_user: User = Depends(get_current_user)):
    """Delete a quiz."""
    db = SessionLocal()
    try:
        user_id = current_user.id
        quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user_id).first()
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")

        db.delete(quiz)
        db.commit()
        return {"message": "Quiz deleted"}
    finally:
        db.close()

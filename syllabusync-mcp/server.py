"""MCP Server for SyllabuSync (Classmate)

Exposes SyllabuSync's core student study assistant functionality as MCP tools.
Allows the Crow AI widget to help students manage courses, deadlines, and study materials.

Generated with the MCP Builder skill.

⚠️  IMPORTANT — Backend Auth Prerequisite
This server authenticates with the SyllabuSync backend via a service key (X-Service-Key header).
The backend's _get_current_user() function must be patched to support this flow.
See README.md for the exact code change required in main.py before this server will work.
"""

import os
import logging
import httpx
from typing import Optional
from fastmcp import FastMCP
from fastmcp.dependencies import Depends, CurrentHeaders

logger = logging.getLogger(__name__)

# --- Configuration ---
API_BASE = os.environ.get("API_BASE_URL", "http://localhost:8000")
SERVICE_KEY = os.environ.get("SERVICE_KEY", "")

# --- Server ---
mcp = FastMCP("SyllabuSync")


# --- Scoping Parameter Resolution ---
# user_id is passed as X-User-ID header by Crow's backend.
# It originates from the Crow Identity Verification JWT (identity.user_id claim).
# The SyllabuSync backend validates it via the MCP_SERVICE_KEY middleware (see README).

async def get_user_id(headers: dict = CurrentHeaders()) -> str:
    """Read user_id from X-User-ID header (set by Crow's backend)."""
    value = headers.get("x-user-id", "")
    if not value:
        raise ValueError("Missing X-User-ID header")
    return value


async def get_api_client(headers: dict = CurrentHeaders()) -> httpx.AsyncClient:
    """Create HTTP client for the SyllabuSync backend API.

    Passes the service key (X-Service-Key) and user identity (X-User-ID) so the
    backend's patched auth middleware can trust this request without a Supabase JWT.

    Resolution order for service key: env var SERVICE_KEY (local dev) →
    inbound X-Service-Key header (Crow-hosted, auto-injected by platform).
    """
    client_headers: dict = {"Content-Type": "application/json"}

    key = SERVICE_KEY or headers.get("x-service-key", "")
    if key:
        client_headers["X-Service-Key"] = key

    user_id = headers.get("x-user-id", "")
    if user_id:
        client_headers["X-User-ID"] = user_id

    return httpx.AsyncClient(
        base_url=API_BASE,
        headers=client_headers,
        timeout=30.0,
    )


# ============================================================
# PROFILE & SUBSCRIPTION TOOLS
# ============================================================

@mcp.tool(annotations={"readOnlyHint": True})
async def get_profile(
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Get the current student's profile and account information.

    Returns name, school, major, academic year, subscription tier (free/pro),
    onboarding status, and referral code.
    """
    try:
        resp = await client.get("/me")
        resp.raise_for_status()
        data = resp.json()
        profile = data.get("profile") or {}
        subscription = data.get("subscription") or {}
        return {
            "full_name": profile.get("full_name"),
            "email": profile.get("email"),
            "school_name": profile.get("school_name"),
            "academic_year": profile.get("academic_year"),
            "major": profile.get("major"),
            "subscription_tier": subscription.get("tier", "free"),
            "is_pro": subscription.get("is_pro", False),
            "has_completed_onboarding": data.get("has_completed_onboarding", False),
            "referral_code": profile.get("referral_code"),
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}
    except httpx.ConnectError:
        return {"error": "Could not connect to the SyllabuSync backend. Is it running?"}


@mcp.tool
async def update_profile(
    full_name: Optional[str] = None,
    school_name: Optional[str] = None,
    academic_year: Optional[str] = None,
    major: Optional[str] = None,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Update the student's profile information. All fields are optional.

    full_name: Student's full name.
    school_name: Name of the student's school or university.
    academic_year: Options: 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Other'.
    major: Student's field of study.
    """
    payload: dict = {}
    if full_name is not None:
        payload["full_name"] = full_name
    if school_name is not None:
        payload["school_name"] = school_name
    if academic_year is not None:
        payload["academic_year"] = academic_year
    if major is not None:
        payload["major"] = major

    try:
        resp = await client.post("/me/profile", json=payload)
        resp.raise_for_status()
        return {"success": True, "message": "Profile updated successfully."}
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool(annotations={"readOnlyHint": True})
async def get_subscription(
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Get the student's subscription status and usage limits.

    Returns tier (free/pro), AI generation usage this month, and weekly chat message
    usage for Pro users.
    Free plan: 5 AI generations/month, no chat.
    Pro plan: unlimited AI generations, 50 chat messages/week.
    """
    try:
        resp = await client.get("/me/subscription")
        resp.raise_for_status()
        data = resp.json()
        return {
            "tier": data.get("tier", "free"),
            "is_pro": data.get("is_pro", False),
            "status": data.get("status"),
            "period_end": data.get("period_end"),
            "ai_generations_used": data.get("ai_generations_used", 0),
            "ai_generations_max": data.get("ai_generations_max"),
            "courses_used": data.get("courses_used", 0),
            "chat_messages_used": data.get("chat_messages_used", 0),
            "chat_messages_max": data.get("chat_messages_max"),
            "chat_messages_reset_at": data.get("chat_messages_reset_at"),
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool(annotations={"readOnlyHint": True})
async def get_referral_code(
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Get the student's unique referral code for sharing SyllabuSync with others."""
    try:
        resp = await client.get("/me/referral")
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


# ============================================================
# COURSE TOOLS
# ============================================================

@mcp.tool(annotations={"readOnlyHint": True})
async def list_courses(
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """List all of the student's courses.

    Returns course names, codes, semesters, deadline counts, and IDs for follow-up actions.
    Use get_course to see full details (deadlines, study materials) for a specific course.
    """
    try:
        resp = await client.get("/courses")
        resp.raise_for_status()
        data = resp.json()
        courses = data if isinstance(data, list) else data.get("courses", [])
        return {
            "total": len(courses),
            "courses": [
                {
                    "id": c.get("id"),
                    "name": c.get("name"),
                    "code": c.get("code"),
                    "semester": c.get("semester"),
                    "start_date": c.get("start_date"),
                    "end_date": c.get("end_date"),
                    "deadline_count": c.get("deadline_count", 0),
                    "flashcard_set_count": c.get("flashcard_set_count", 0),
                }
                for c in courses
            ],
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool(annotations={"readOnlyHint": True})
async def get_course(
    course_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Get detailed information about a specific course, including its deadlines, flashcard sets, summaries, and quizzes.

    course_id: The UUID of the course (get from list_courses).
    """
    try:
        resp = await client.get(f"/courses/{course_id}")
        resp.raise_for_status()
        data = resp.json()
        return {
            "id": data.get("id"),
            "name": data.get("name"),
            "code": data.get("code"),
            "semester": data.get("semester"),
            "start_date": data.get("start_date"),
            "end_date": data.get("end_date"),
            "course_info": data.get("course_info"),
            "deadlines": [
                {
                    "id": d.get("id"),
                    "title": d.get("title"),
                    "date": d.get("date"),
                    "type": d.get("type"),
                    "completed": d.get("completed", False),
                }
                for d in (data.get("deadlines") or [])[:20]
            ],
            "flashcard_sets": [
                {
                    "id": fs.get("id"),
                    "name": fs.get("name"),
                    "card_count": len(fs.get("flashcards") or []),
                }
                for fs in (data.get("flashcard_sets") or [])
            ],
            "summaries": [
                {"id": s.get("id"), "title": s.get("title")}
                for s in (data.get("summaries") or [])
            ],
            "quizzes": [
                {"id": q.get("id"), "name": q.get("name")}
                for q in (data.get("quizzes") or [])
            ],
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Course not found."}
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool
async def create_course(
    name: str,
    code: Optional[str] = None,
    semester: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Create a new course.

    name: Course name (e.g., 'Biology 101'). Required.
    code: Course code (e.g., 'BIO 101').
    semester: Semester label (e.g., 'Spring 2025', 'Fall 2025').
    start_date: Course start date in YYYY-MM-DD format.
    end_date: Course end date in YYYY-MM-DD format.
    """
    payload: dict = {"name": name}
    if code:
        payload["code"] = code
    if semester:
        payload["semester"] = semester
    if start_date:
        payload["start_date"] = start_date
    if end_date:
        payload["end_date"] = end_date

    try:
        resp = await client.post("/courses", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return {
            "success": True,
            "course_id": data.get("id"),
            "name": data.get("name"),
            "message": f"Course '{name}' created successfully.",
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool
async def update_course(
    course_id: str,
    name: Optional[str] = None,
    code: Optional[str] = None,
    semester: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Update an existing course's details. All fields except course_id are optional.

    course_id: The UUID of the course to update (get from list_courses).
    start_date / end_date: Use YYYY-MM-DD format.
    """
    payload: dict = {}
    if name is not None:
        payload["name"] = name
    if code is not None:
        payload["code"] = code
    if semester is not None:
        payload["semester"] = semester
    if start_date is not None:
        payload["start_date"] = start_date
    if end_date is not None:
        payload["end_date"] = end_date

    try:
        resp = await client.patch(f"/courses/{course_id}", json=payload)
        resp.raise_for_status()
        return {"success": True, "message": "Course updated successfully."}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Course not found."}
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool(annotations={"destructiveHint": True})
async def delete_course(
    course_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Delete a course and ALL its related data (deadlines, flashcards, summaries, quizzes). IRREVERSIBLE.

    course_id: The UUID of the course to delete (get from list_courses).
    """
    try:
        resp = await client.delete(f"/courses/{course_id}")
        resp.raise_for_status()
        return {"success": True, "message": "Course and all related data permanently deleted."}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Course not found."}
        return {"error": f"API error: {e.response.status_code}"}


# ============================================================
# DEADLINE TOOLS
# ============================================================

@mcp.tool(annotations={"readOnlyHint": True})
async def list_deadlines(
    course_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """List upcoming deadlines and assignments across all courses. Optionally filter by course or date range.

    course_id: Filter to a specific course (optional). Get IDs from list_courses.
    from_date: Only return deadlines on or after this date (YYYY-MM-DD). E.g., '2025-03-01'.
    to_date: Only return deadlines on or before this date (YYYY-MM-DD). E.g., '2025-03-31'.
    Returns deadlines sorted by date with completion status and course name.
    """
    try:
        if course_id:
            resp = await client.get(f"/courses/{course_id}/deadlines")
        else:
            params: dict = {}
            if from_date:
                params["from"] = from_date
            if to_date:
                params["to"] = to_date
            resp = await client.get("/deadlines", params=params)
        resp.raise_for_status()
        data = resp.json()
        deadlines = data if isinstance(data, list) else data.get("deadlines", [])
        return {
            "total": len(deadlines),
            "deadlines": [
                {
                    "id": d.get("id"),
                    "title": d.get("title"),
                    "date": d.get("date"),
                    "time": d.get("time"),
                    "type": d.get("type"),
                    "course_id": d.get("course_id"),
                    "course_name": d.get("course_name"),
                    "completed": d.get("completed", False),
                    "description": d.get("description"),
                    "source": d.get("source", "manual"),
                }
                for d in deadlines
            ],
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool
async def create_deadline(
    title: str,
    date: str,
    course_id: str,
    deadline_type: str = "assignment",
    time: Optional[str] = None,
    description: Optional[str] = None,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Create a new deadline or assignment.

    title: Name of the deadline (e.g., 'Midterm Exam'). Required.
    date: Due date in YYYY-MM-DD format (e.g., '2025-03-15'). Required.
    course_id: The UUID of the course this deadline belongs to. Required. Get from list_courses.
    deadline_type: Type of deadline. Options: 'exam', 'assignment', 'quiz', 'project', 'reading', 'Deadline'. Default: 'assignment'.
    time: Due time string (e.g., '11:59pm' or '23:59').
    description: Optional notes or details about the deadline.
    """
    payload: dict = {
        "title": title,
        "date": date,
        "course_id": course_id,
        "type": deadline_type,
    }
    if time:
        payload["time"] = time
    if description:
        payload["description"] = description

    try:
        resp = await client.post("/deadlines", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return {
            "success": True,
            "deadline_id": data.get("id"),
            "title": data.get("title"),
            "date": data.get("date"),
            "message": f"Deadline '{title}' created for {date}.",
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool
async def update_deadline(
    deadline_id: str,
    title: Optional[str] = None,
    date: Optional[str] = None,
    course_id: Optional[str] = None,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Update an existing deadline. All fields except deadline_id are optional.

    deadline_id: The UUID of the deadline to update (get from list_deadlines).
    title: New name for the deadline.
    date: New due date in YYYY-MM-DD format.
    course_id: Move deadline to a different course (use course UUID).
    """
    payload: dict = {}
    if title is not None:
        payload["title"] = title
    if date is not None:
        payload["date"] = date
    if course_id is not None:
        payload["course_id"] = course_id

    try:
        resp = await client.patch(f"/deadlines/{deadline_id}", json=payload)
        resp.raise_for_status()
        return {"success": True, "message": "Deadline updated successfully."}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Deadline not found."}
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool
async def toggle_deadline_complete(
    deadline_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Toggle a deadline's completion status (mark as done or undone).

    deadline_id: The UUID of the deadline to toggle (get from list_deadlines).
    Returns the new completion status after toggling.
    """
    try:
        resp = await client.patch(f"/deadlines/{deadline_id}/complete")
        resp.raise_for_status()
        data = resp.json()
        new_status = data.get("completed")
        return {
            "success": True,
            "completed": new_status,
            "message": f"Deadline marked as {'complete ✓' if new_status else 'incomplete'}.",
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Deadline not found."}
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool(annotations={"destructiveHint": True})
async def delete_deadline(
    deadline_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Delete a deadline permanently. IRREVERSIBLE.

    deadline_id: The UUID of the deadline to delete (get from list_deadlines).
    """
    try:
        resp = await client.delete(f"/deadlines/{deadline_id}")
        resp.raise_for_status()
        return {"success": True, "message": "Deadline deleted."}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Deadline not found."}
        return {"error": f"API error: {e.response.status_code}"}


# ============================================================
# STUDY MATERIALS — SUMMARIES
# ============================================================

@mcp.tool(annotations={"readOnlyHint": True})
async def get_summary(
    summary_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Get an AI-generated study summary.

    summary_id: The UUID of the summary (get from get_course).
    Returns the full summary content in markdown/bullet format.
    Note: Summaries are generated by uploading study materials in the SyllabuSync app.
    """
    try:
        resp = await client.get(f"/summaries/{summary_id}")
        resp.raise_for_status()
        data = resp.json()
        return {
            "id": data.get("id"),
            "title": data.get("title"),
            "course_id": data.get("course_id"),
            "content": data.get("content"),
            "created_at": data.get("created_at"),
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Summary not found."}
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool(annotations={"destructiveHint": True})
async def delete_summary(
    summary_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Delete a study summary permanently. IRREVERSIBLE.

    summary_id: The UUID of the summary to delete (get from get_course).
    """
    try:
        resp = await client.delete(f"/summaries/{summary_id}")
        resp.raise_for_status()
        return {"success": True, "message": "Summary deleted."}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Summary not found."}
        return {"error": f"API error: {e.response.status_code}"}


# ============================================================
# STUDY MATERIALS — FLASHCARDS
# ============================================================

@mcp.tool(annotations={"readOnlyHint": True})
async def get_flashcard_set(
    set_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Get a flashcard set with all its cards (front = question/term, back = answer/definition).

    set_id: The UUID of the flashcard set (get from get_course).
    Returns up to 50 flashcards.
    Note: Flashcard sets are generated by uploading study materials in the SyllabuSync app.
    """
    try:
        resp = await client.get(f"/flashcard-sets/{set_id}")
        resp.raise_for_status()
        data = resp.json()
        cards = data.get("flashcards") or []
        return {
            "id": data.get("id"),
            "name": data.get("name"),
            "course_id": data.get("course_id"),
            "card_count": len(cards),
            "flashcards": [
                {"id": c.get("id"), "front": c.get("front"), "back": c.get("back")}
                for c in cards[:50]
            ],
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Flashcard set not found."}
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool(annotations={"destructiveHint": True})
async def delete_flashcard_set(
    set_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Delete a flashcard set and all its cards permanently. IRREVERSIBLE.

    set_id: The UUID of the flashcard set to delete (get from get_course).
    """
    try:
        resp = await client.delete(f"/flashcard-sets/{set_id}")
        resp.raise_for_status()
        return {"success": True, "message": "Flashcard set deleted."}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Flashcard set not found."}
        return {"error": f"API error: {e.response.status_code}"}


# ============================================================
# STUDY MATERIALS — QUIZZES
# ============================================================

@mcp.tool(annotations={"readOnlyHint": True})
async def list_quizzes(
    course_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """List all quizzes for a specific course.

    course_id: The UUID of the course (get from list_courses).
    """
    try:
        resp = await client.get(f"/courses/{course_id}/quizzes")
        resp.raise_for_status()
        data = resp.json()
        quizzes = data if isinstance(data, list) else data.get("quizzes", [])
        return {
            "total": len(quizzes),
            "quizzes": [
                {"id": q.get("id"), "name": q.get("name"), "created_at": q.get("created_at")}
                for q in quizzes
            ],
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool(annotations={"readOnlyHint": True})
async def get_quiz(
    quiz_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Get a quiz with all its multiple-choice questions (correct answers hidden until submission).

    quiz_id: The UUID of the quiz (get from list_quizzes or get_course).
    Returns all questions with A/B/C/D answer options. Use submit_quiz to score answers.
    Note: Quizzes are generated by uploading study materials in the SyllabuSync app.
    """
    try:
        resp = await client.get(f"/quizzes/{quiz_id}")
        resp.raise_for_status()
        data = resp.json()
        questions = data.get("questions") or []
        return {
            "id": data.get("id"),
            "name": data.get("name"),
            "question_count": len(questions),
            "questions": [
                {
                    "id": q.get("id"),
                    "question": q.get("question"),
                    "options": q.get("options"),
                    "order_num": q.get("order_num"),
                }
                for q in questions
            ],
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Quiz not found."}
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool
async def submit_quiz(
    quiz_id: str,
    answers: dict,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Submit answers to a quiz and receive a scored result with explanations.

    quiz_id: The UUID of the quiz (get from list_quizzes).
    answers: A dict mapping question_id (UUID) to answer letter. Example: {"uuid-q1": "A", "uuid-q2": "C"}.
             Get question IDs from get_quiz. Valid answer letters: A, B, C, D.
    Returns score percentage, correct/incorrect count, and per-question explanations.
    """
    try:
        resp = await client.post(f"/quizzes/{quiz_id}/submit", json={"answers": answers})
        resp.raise_for_status()
        data = resp.json()
        return {
            "score": data.get("score"),
            "total_questions": data.get("total_questions"),
            "correct_count": data.get("correct_count"),
            "percentage": data.get("percentage"),
            "results": data.get("results"),
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Quiz not found."}
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool(annotations={"destructiveHint": True})
async def delete_quiz(
    quiz_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Delete a quiz permanently. IRREVERSIBLE.

    quiz_id: The UUID of the quiz to delete (get from list_quizzes).
    """
    try:
        resp = await client.delete(f"/quizzes/{quiz_id}")
        resp.raise_for_status()
        return {"success": True, "message": "Quiz deleted."}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Quiz not found."}
        return {"error": f"API error: {e.response.status_code}"}


# ============================================================
# LMS INTEGRATION TOOLS
# ============================================================

@mcp.tool(annotations={"readOnlyHint": True})
async def list_lms_connections(
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """List the student's connected LMS integrations (Canvas, iCal feeds).

    Returns each connection's provider, last sync time, and ID for disconnecting.
    """
    try:
        resp = await client.get("/lms/connections")
        resp.raise_for_status()
        data = resp.json()
        connections = data if isinstance(data, list) else data.get("connections", [])
        return {
            "total": len(connections),
            "connections": [
                {
                    "id": c.get("id"),
                    "provider": c.get("provider"),
                    "instance_url": c.get("instance_url"),
                    "last_synced": c.get("last_synced"),
                }
                for c in connections
            ],
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool
async def sync_lms(
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Trigger a manual sync with all connected LMS integrations (Canvas, iCal).

    Fetches new deadlines and assignments from all connected LMS sources and adds them
    to the student's deadline list. Returns number of new deadlines synced.
    """
    try:
        resp = await client.post("/lms/sync")
        resp.raise_for_status()
        data = resp.json()
        return {
            "success": True,
            "message": data.get("message", "LMS sync completed."),
            "deadlines_added": data.get("deadlines_added"),
            "deadlines_updated": data.get("deadlines_updated"),
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"LMS sync failed: {e.response.status_code}"}


@mcp.tool(annotations={"destructiveHint": True})
async def disconnect_lms(
    connection_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Disconnect an LMS integration (Canvas or iCal connection). This removes the connection permanently.

    connection_id: The UUID of the LMS connection to remove (get from list_lms_connections).
    """
    try:
        resp = await client.delete(f"/lms/connections/{connection_id}")
        resp.raise_for_status()
        return {"success": True, "message": "LMS connection removed."}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "LMS connection not found."}
        return {"error": f"API error: {e.response.status_code}"}


# ============================================================
# CHAT TOOLS
# ============================================================

@mcp.tool(annotations={"readOnlyHint": True})
async def list_conversations(
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """List all of the student's AI chat conversations (most recent 20).

    Returns conversation titles, IDs, and creation dates.
    """
    try:
        resp = await client.get("/chat/conversations")
        resp.raise_for_status()
        data = resp.json()
        convos = data if isinstance(data, list) else data.get("conversations", [])
        return {
            "total": len(convos),
            "conversations": [
                {"id": c.get("id"), "title": c.get("title"), "created_at": c.get("created_at")}
                for c in convos[:20]
            ],
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool
async def create_conversation(
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Create a new empty AI chat conversation.

    Returns the new conversation ID. Use send_message to add messages.
    """
    try:
        resp = await client.post("/chat/conversations")
        resp.raise_for_status()
        data = resp.json()
        return {
            "success": True,
            "conversation_id": data.get("id"),
            "title": data.get("title", "New Chat"),
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool(annotations={"readOnlyHint": True})
async def get_conversation_messages(
    conversation_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Get all messages in a chat conversation (most recent 20).

    conversation_id: The UUID of the conversation (get from list_conversations).
    Returns messages in chronological order with roles (user/assistant).
    """
    try:
        resp = await client.get(f"/chat/conversations/{conversation_id}/messages")
        resp.raise_for_status()
        data = resp.json()
        messages = data if isinstance(data, list) else data.get("messages", [])
        return {
            "conversation_id": conversation_id,
            "message_count": len(messages),
            "messages": [
                {
                    "id": m.get("id"),
                    "role": m.get("role"),
                    "content": m.get("content"),
                    "created_at": m.get("created_at"),
                }
                for m in messages[-20:]
            ],
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Conversation not found."}
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool
async def send_message(
    conversation_id: str,
    content: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Send a message in a chat conversation and receive an AI response.

    conversation_id: The UUID of the conversation. Create one with create_conversation.
    content: The message text to send.
    Returns the AI assistant's response.
    Note: Chat is a Pro feature (50 messages/week limit).
    """
    try:
        resp = await client.post(
            f"/chat/conversations/{conversation_id}/messages",
            json={"content": content},
        )
        resp.raise_for_status()
        data = resp.json()
        assistant_content = (
            data.get("content")
            or data.get("message")
            or data.get("response")
            or (data.get("assistant_message") or {}).get("content")
        )
        return {
            "user_message": content,
            "assistant_response": assistant_content,
            "conversation_id": conversation_id,
        }
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Conversation not found."}
        if e.response.status_code == 429:
            return {"error": "Weekly chat message limit reached. Upgrade to Pro for more messages."}
        if e.response.status_code == 403:
            return {"error": "Chat is a Pro feature. Upgrade to Pro to use AI chat."}
        return {"error": f"API error: {e.response.status_code}"}


@mcp.tool(annotations={"destructiveHint": True})
async def delete_conversation(
    conversation_id: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Delete a chat conversation and all its messages permanently. IRREVERSIBLE.

    conversation_id: The UUID of the conversation to delete (get from list_conversations).
    """
    try:
        resp = await client.delete(f"/chat/conversations/{conversation_id}")
        resp.raise_for_status()
        return {"success": True, "message": "Conversation deleted."}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Conversation not found."}
        return {"error": f"API error: {e.response.status_code}"}


# ============================================================
# FEEDBACK
# ============================================================

@mcp.tool
async def submit_feedback(
    feedback_type: str,
    message: str,
    client: httpx.AsyncClient = Depends(get_api_client),
) -> dict:
    """Submit feedback about SyllabuSync/Classmate.

    feedback_type: Category of feedback. Options: 'bug', 'feature', 'general', 'other'.
    message: The feedback message text.
    """
    valid_types = {"bug", "feature", "general", "other"}
    if feedback_type not in valid_types:
        return {
            "error": f"Invalid feedback_type '{feedback_type}'.",
            "valid_options": sorted(valid_types),
        }

    try:
        resp = await client.post(
            "/feedback",
            json={"feedback_type": feedback_type, "message": message},
        )
        resp.raise_for_status()
        return {"success": True, "message": "Feedback submitted. Thank you!"}
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}"}


# ============================================================
# ENTRYPOINT
# ============================================================

if __name__ == "__main__":
    mcp.run()

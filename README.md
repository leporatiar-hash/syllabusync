# ClassMate

A calm, organized workspace for students to parse syllabi, track deadlines, and study smarter with AI-powered flashcard generation.

## Features

- **Parse Syllabi**: Upload PDF syllabi and automatically extract deadlines using AI
- **Track Deadlines**: View all deadlines in a timeline or calendar view
- **Generate Flashcards**: Upload study materials and generate smart flashcard decks
- **Stay Organized**: Mark deadlines complete and track your progress

## Project Structure

```
classmate/
├── Backend/      # FastAPI backend
└── Frontend/     # Next.js frontend
```

## Local Development

### Backend

```bash
cd Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at http://localhost:8000

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

Frontend runs at http://localhost:3000

## Deploy to Railway (Monorepo: API + App)

Create two Railway services from the same GitHub repo.

### Service 1: API (FastAPI)

- **Root Directory**: `Backend`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Variables**:
  - `DATABASE_URL` (Railway Postgres URL or sqlite for testing)
  - `OPENAI_API_KEY`
  - `ALLOWED_ORIGINS` (set to your frontend domain, or `*` for testing)

Generate a public domain for the API service (e.g., `https://your-api.up.railway.app`).

### Service 2: App (Next.js)

- **Root Directory**: `Frontend`
- **Start Command**: `npm run start`
- **Variables**:
  - `NEXT_PUBLIC_API_URL` (set to your API domain)

Generate a public domain for the App service (e.g., `https://your-app.up.railway.app`).

## API Endpoints

### Health
- `GET /` - Health check

### Courses
- `GET /courses` - List all courses
- `GET /courses/{id}` - Get course with deadlines and flashcard sets
- `POST /courses` - Create a new course
- `DELETE /courses/{id}` - Delete a course

### Syllabus & Deadlines
- `POST /upload` - Upload PDF, create course and extract deadlines
- `POST /courses/{id}/syllabus` - Upload syllabus to existing course
- `GET /deadlines` - Get all deadlines (supports filtering)
- `PATCH /deadlines/{id}/complete` - Toggle deadline completion

### Flashcards
- `POST /courses/{id}/flashcards` - Generate flashcards from study material
- `GET /flashcard-sets/{id}` - Get flashcard set with all cards
- `DELETE /flashcard-sets/{id}` - Delete a flashcard set

## Environment Variables

### Backend (`Backend/.env`)
```
OPENAI_API_KEY=your-openai-api-key
DATABASE_URL=sqlite:///./railway.db  # or PostgreSQL URL
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend (`Frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
# Deploy trigger Sat Jan 31 13:26:59 EST 2026
# Force rebuild Tue Feb  3 12:52:30 EST 2026

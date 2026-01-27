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
├── api/          # FastAPI backend
└── app/          # Next.js frontend
```

## Local Development

### Backend

```bash
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at http://localhost:8000

### Frontend

```bash
cd app
npm install
npm run dev
```

Frontend runs at http://localhost:3000

## Deploy to Railway

### 1. Deploy Backend

```bash
cd api
railway init
railway up
railway domain
```

Save the backend URL (e.g., `https://your-api.railway.app`)

### 2. Deploy Frontend

```bash
cd app
railway init
railway variables set NEXT_PUBLIC_API_URL=https://your-api.railway.app
railway up
railway domain
```

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

### Backend (`api/.env`)
```
OPENAI_API_KEY=your-openai-api-key
DATABASE_URL=sqlite:///./classmate.db  # or PostgreSQL URL
```

### Frontend (`app/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

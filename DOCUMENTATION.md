# AI Coach — Documentation

## Overview
A web-based fitness tracking & AI coaching application built with React (Vite) and FastAPI (Python). Features an LLM-powered coach that analyzes your workout history and provides personalized recommendations.

## Setup

### Prerequisites
- Node.js & npm
- Python 3.10+
- Ollama (for AI Coach)

### Installation
```bash
git clone https://github.com/danielwalke/AI-Coach.git
cd AI-Coach

# Backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r backend/requirements.txt

# Frontend
npm install

# Ollama model
ollama pull qwen3:8b
```

### Running
```bash
# Terminal 1: Backend
uvicorn backend.main:app --reload

# Terminal 2: Frontend
npm run dev
```
Access at http://localhost:5173

## Features

### User Authentication
Sign up and login with email/password. JWT-based auth protects all API endpoints.

### Dashboard 
View workout streak, total sessions, hours trained, progress charts, and recent workout details.

### Training Sessions
- Select from default exercises or create custom ones
- Track sets, reps, and weight
- **Persistent State**: Navigate freely without losing workout progress
- **Cancel Option**: Discard current session at any time
- **Rest Timer**: Automatically tracks rest between sets with visual indicator

### AI Coach (Health Coach Tab)
LLM-powered fitness coaching using Ollama (qwen3:8b, 16k context):
- Select past workout sessions as context
- Ask for workout recommendations, analysis, or advice
- Streaming responses rendered as markdown
- "Thinking" toggle to see the LLM's reasoning process
- Chat history with individual message deletion

### Garmin Integration (`feature/garmin-integration` branch)
> **Note**: This feature is on a separate branch as of 2026-02-15.

- Link Garmin account to sync heart rate data
- Heart rate chart with day navigation (prev/next day)
- Auto-sync toggle (every 10 seconds)

To use: `git checkout feature/garmin-integration`

## Docker Deployment

### Ports
| Service | Port |
|---------|------|
- **Backend (uvicorn)**: 9061
- **Ollama**: 11434 (host)
  - Windows: qwen3:8b
  - RPi: qwen3:1.7b

### Quick Deploy
```bash
docker compose up --build
```

### Raspberry Pi (ARM)
```bash
chmod +x deploy-rpi.sh
./deploy-rpi.sh
```

### Windows
```powershell
.\deploy-windows.ps1
```

## Project Structure
- `backend/`: FastAPI application, database models, API routers
  - `routers/coach.py`: AI Coach streaming endpoint
- `src/`: React frontend source code
  - `components/`: Reusable UI components (CoachChat, GlassCard, StatCard)
  - `context/`: React Context (DataContext, WorkoutContext)
  - `pages/`: Application pages (Dashboard, Training, Health Coach, Profile)
  - `api/`: API client configuration

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/token` | Login |
| GET | `/users/me` | Current user info |
| GET/POST | `/exercises/` | List/create exercises |
| GET/POST | `/sessions/` | List/create workout sessions |
| DELETE | `/sessions/{id}` | Delete session |
| GET | `/coach/sessions` | List sessions for AI context |
| POST | `/coach/chat` | Stream AI Coach response (SSE) |

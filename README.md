# AI Coach 🏋️‍♂️

A full-stack fitness tracking & AI coaching app. Track workouts, monitor progress, and get personalized training recommendations powered by a local LLM.

## Features

### Core
- **User Authentication** — Sign up / login with email & password
- **Dashboard** — Workout history, streak tracking, progress charts
- **Training Sessions** — Track exercises, sets, reps, weight, and rest time
- **Persistent Workouts** — Navigate freely without losing session progress
- **Rest Timer** — Automatic rest tracking between sets
- **AI Coach** — Chat with a local LLM (qwen3:8b via Ollama) for personalized workout advice
  - Select past workouts as context
  - Streaming responses with thinking process toggle
  - Chat history with message deletion

### Feature Branch: `feature/garmin-integration`
- **Garmin Connect Sync** — Link your Garmin account and sync heart rate data
- **Heart Rate Chart** — Visualize heart rate with day navigation
- **Auto-Sync** — Automatic 10-second sync interval

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Styling | TailwindCSS |
| Backend | Python FastAPI + SQLModel |
| Database | SQLite |
| AI | Ollama (qwen3:8b, 16k context) |
| Deployment | Docker + nginx + ngrok |

## Quick Start (Development)

```bash
# Backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload

# Frontend (new terminal)
npm install
npm run dev
```

Open http://localhost:5173

## Docker Deployment

```bash
# Prerequisites: Docker, Ollama with qwen3:8b
docker compose up --build
```

- **Frontend**: http://localhost:9060
- **Backend API**: http://localhost:9061

### Raspberry Pi (ARM)
```bash
chmod +x deploy-rpi.sh
./deploy-rpi.sh
```
Builds containers natively for ARM, starts ngrok tunnel.

### Windows
```powershell
.\deploy-windows.ps1
```
Builds containers, starts ngrok tunnel.

## Project Structure

```
├── backend/               # FastAPI backend
│   ├── main.py           # App entry point
│   ├── models.py         # Database models
│   ├── database.py       # DB connection
│   ├── auth.py           # JWT authentication
│   └── routers/          # API endpoints
│       ├── auth.py       # Login/register
│       ├── exercises.py  # Exercise CRUD
│       ├── sessions.py   # Workout sessions
│       └── coach.py      # AI Coach (LLM streaming)
├── src/                   # React frontend
│   ├── components/       # UI components
│   ├── context/          # State management
│   ├── pages/            # Page components
│   └── api/              # API client
├── Dockerfile.backend    # Backend Docker image
├── Dockerfile.frontend   # Frontend Docker image
├── docker-compose.yml    # Service orchestration
├── deploy-rpi.sh         # ARM deployment script
└── deploy-windows.ps1    # Windows deployment script
```

## Ports

| Service | Port |
|---------|------|
| Frontend (nginx) | 9060 |
| Backend (uvicorn) | 9061 |
| Ollama | 11434 (default, on host) |

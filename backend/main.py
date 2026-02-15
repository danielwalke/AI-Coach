from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import create_db_and_tables
from backend.routers import auth, users, exercises, sessions, garmin, coach
from backend.seed import seed_exercises

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    seed_exercises()
    yield

app = FastAPI(lifespan=lifespan)

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(exercises.router)
app.include_router(sessions.router)
app.include_router(garmin.router)
app.include_router(coach.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Fitness App API"}

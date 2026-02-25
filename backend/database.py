import os
from sqlmodel import SQLModel, create_engine, Session

# Use absolute path for the database file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sqlite_file_name = os.path.join(BASE_DIR, "data", "database.db")
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, echo=True, connect_args=connect_args)

def create_db_and_tables():
    # Import models explicitly to ensure they are registered with SQLModel.metadata
    from backend.models import (
        User, Exercise, TrainingSession, SessionExercise, TrainingSet, 
        WorkoutTemplate, TemplateExercise, TemplateSet, GarminCredentials, HeartRateLog
    )
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

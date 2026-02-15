from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from backend.database import get_session
from backend.models import (
    TrainingSession, TrainingSessionCreate, TrainingSessionRead,
    SessionExercise, TrainingSet, User
)
from backend.auth import get_current_user

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.get("/", response_model=List[TrainingSessionRead])
async def read_sessions(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(TrainingSession).where(TrainingSession.user_id == current_user.id)
    sessions = session.exec(statement).all()
    return sessions

@router.post("/", response_model=TrainingSessionRead)
async def create_session(
    session_data: TrainingSessionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Create the session
    db_session = TrainingSession(
        date=session_data.date,
        duration_seconds=session_data.duration_seconds,
        user_id=current_user.id
    )
    session.add(db_session)
    session.commit()
    session.refresh(db_session)
    
    # Iterate through exercises
    for session_exercise_data in session_data.exercises:
        db_session_exercise = SessionExercise(
            session_id=db_session.id,
            exercise_id=session_exercise_data.exercise_id
        )
        session.add(db_session_exercise)
        session.commit()
        session.refresh(db_session_exercise)
        
        # Iterate through sets
        for set_data in session_exercise_data.sets:
            db_set = TrainingSet(**set_data.model_dump(), session_exercise_id=db_session_exercise.id)
            session.add(db_set)
            
    session.commit()
    session.refresh(db_session)
    return db_session

@router.delete("/{session_id}")
async def delete_session(
    session_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(TrainingSession).where(
        TrainingSession.id == session_id,
        TrainingSession.user_id == current_user.id
    )
    db_session = session.exec(statement).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session.delete(db_session)
    session.commit()
    return {"ok": True}

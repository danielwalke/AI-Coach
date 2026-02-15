from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, col
from backend.database import get_session
from backend.models import Exercise, ExerciseCreate, ExerciseRead, User
from backend.auth import get_current_user

router = APIRouter(prefix="/exercises", tags=["exercises"])

@router.get("/", response_model=List[ExerciseRead])
async def read_exercises(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Return default exercises (user_id is None) AND user's custom exercises
    statement = select(Exercise).where(
        (Exercise.user_id == None) | (Exercise.user_id == current_user.id)
    )
    exercises = session.exec(statement).all()
    return exercises

@router.post("/", response_model=ExerciseRead)
async def create_exercise(
    exercise: ExerciseCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_exercise = Exercise.model_validate(exercise)
    db_exercise.user_id = current_user.id
    db_exercise.is_custom = True
    session.add(db_exercise)
    session.commit()
    session.refresh(db_exercise)
    return db_exercise

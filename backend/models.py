from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, Relationship, SQLModel

# Shared properties
class UserBase(SQLModel):
    name: str
    email: str = Field(unique=True, index=True)
    age: Optional[int] = None
    joined_at: datetime = Field(default_factory=datetime.utcnow)

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    password_hash: str
    
    exercises: List["Exercise"] = Relationship(back_populates="user")
    sessions: List["TrainingSession"] = Relationship(back_populates="user")
    garmin_credentials: Optional["GarminCredentials"] = Relationship(back_populates="user")
    heart_rate_logs: List["HeartRateLog"] = Relationship(back_populates="user")

class GarminCredentials(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    email: str
    password: str

    user: User = Relationship(back_populates="garmin_credentials")

class HeartRateLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    timestamp: datetime
    heart_rate: int
    
    user: User = Relationship(back_populates="heart_rate_logs")

    # garmin_credentials relationship removed to avoid ambiguity
    
# Update GarminCredentials to have the relationship back to user
# We need to do this carefully if we want type checking to work well, 
# but for SQLModel circular deps can be tricky in one go. 
# Let's just add the back_populates to GarminCredentials.



class ExerciseBase(SQLModel):
    name: str
    category: str
    is_custom: bool = False

class Exercise(ExerciseBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    user: Optional[User] = Relationship(back_populates="exercises")
    session_exercises: List["SessionExercise"] = Relationship(back_populates="exercise")

class TrainingSessionBase(SQLModel):
    date: datetime
    duration_seconds: int

class TrainingSession(TrainingSessionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    
    user: User = Relationship(back_populates="sessions")
    exercises: List["SessionExercise"] = Relationship(back_populates="session", sa_relationship_kwargs={"cascade": "all, delete"})

class SessionExerciseBase(SQLModel):
    pass

class SessionExercise(SessionExerciseBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="trainingsession.id")
    exercise_id: int = Field(foreign_key="exercise.id")
    
    session: TrainingSession = Relationship(back_populates="exercises")
    exercise: Exercise = Relationship(back_populates="session_exercises")
    sets: List["TrainingSet"] = Relationship(back_populates="session_exercise", sa_relationship_kwargs={"cascade": "all, delete"})

class TrainingSetBase(SQLModel):
    weight: float
    reps: int
    completed: bool = False
    rest_seconds: int = 0

class TrainingSet(TrainingSetBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_exercise_id: int = Field(foreign_key="sessionexercise.id")
    
    session_exercise: SessionExercise = Relationship(back_populates="sets")

# --- Pydantic Schemas for API ---

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: int

class Token(SQLModel):
    access_token: str
    token_type: str

class TokenData(SQLModel):
    email: Optional[str] = None

class ExerciseCreate(ExerciseBase):
    pass

class ExerciseRead(ExerciseBase):
    id: int
    user_id: Optional[int]

class TrainingSetCreate(TrainingSetBase):
    pass

class TrainingSetRead(TrainingSetBase):
    id: int

class SessionExerciseCreate(SessionExerciseBase):
    exercise_id: int
    sets: List[TrainingSetCreate]

class SessionExerciseRead(SessionExerciseBase):
    id: int
    exercise: ExerciseRead
    sets: List[TrainingSetRead]

class TrainingSessionCreate(TrainingSessionBase):
    exercises: List[SessionExerciseCreate]

class TrainingSessionRead(TrainingSessionBase):
    id: int
    exercises: List[SessionExerciseRead]

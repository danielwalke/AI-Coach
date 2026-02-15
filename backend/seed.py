from sqlmodel import Session, select
from backend.database import engine
from backend.models import Exercise

DEFAULT_EXERCISES = [
    {"name": "Squat", "category": "Legs"},
    {"name": "Bench Press", "category": "Chest"},
    {"name": "Deadlift", "category": "Back"},
    {"name": "Overhead Press", "category": "Shoulders"},
    {"name": "Pull Up", "category": "Back"},
    {"name": "Dips", "category": "Chest"},
    {"name": "Barbell Row", "category": "Back"},
    {"name": "Lunge", "category": "Legs"},
    {"name": "Plank", "category": "Core"},
    {"name": "Push Up", "category": "Chest"},
]

def seed_exercises():
    with Session(engine) as session:
        for exercise_data in DEFAULT_EXERCISES:
            # Check if global exercise with this name exists
            statement = select(Exercise).where(
                (Exercise.name == exercise_data["name"]) &
                (Exercise.user_id == None)
            )
            existing = session.exec(statement).first()
            
            if not existing:
                exercise = Exercise(
                    name=exercise_data["name"],
                    category=exercise_data["category"],
                    is_custom=False,
                    user_id=None
                )
                session.add(exercise)
        
        session.commit()

if __name__ == "__main__":
    seed_exercises()

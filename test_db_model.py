from sqlmodel import Session, select
from backend.database import engine
from backend.models import TrainingSession, SessionExercise, TrainingSet
from datetime import datetime

def test_db_insert():
    with Session(engine) as session:
        # Create dummy session
        new_sess = TrainingSession(user_id=1, date=datetime.utcnow().isoformat(), duration_seconds=120)
        session.add(new_sess)
        session.commit()
        session.refresh(new_sess)

        # Create dummy SessionExercise
        new_ex = SessionExercise(session_id=new_sess.id, exercise_id=1)
        session.add(new_ex)
        session.commit()
        session.refresh(new_ex)

        # Create TrainingSet WITH REST SECONDS
        new_set = TrainingSet(
            session_exercise_id=new_ex.id,
            weight=100.0,
            reps=10,
            completed=True,
            rest_seconds=45,
            set_duration=15
        )
        session.add(new_set)
        session.commit()
        session.refresh(new_set)

        # Now query it back
        statement = select(TrainingSet).where(TrainingSet.id == new_set.id)
        saved_set = session.exec(statement).first()

        print(f"Saved rest_seconds in DB: {saved_set.rest_seconds}")
        if saved_set.rest_seconds == 45:
            print("DB perfectly supports rest_seconds.")
        else:
            print("DB dropped rest_seconds!")

if __name__ == "__main__":
    test_db_insert()

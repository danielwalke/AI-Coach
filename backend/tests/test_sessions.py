from datetime import datetime
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from backend.models import Exercise, TrainingSession, SessionExercise, TrainingSet

def test_create_session_with_nested_data(client: TestClient, auth_headers: dict, session: Session):
    # 1. Create an exercise to reference
    ex = Exercise(name="Squat", category="Strength")
    session.add(ex)
    session.commit()
    session.refresh(ex)
    
    # 2. Create session data
    session_data = {
        "date": datetime.now().isoformat(),
        "duration_seconds": 3600,
        "exercises": [
            {
                "exercise_id": ex.id,
                "sets": [
                    {"weight": 100, "reps": 5, "completed": True},
                    {"weight": 100, "reps": 5, "completed": True}
                ]
            }
        ]
    }
    
    # 3. Post to API
    response = client.post("/sessions/", json=session_data, headers=auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()
    
    # 4. Verify response structure
    assert data["duration_seconds"] == 3600
    assert len(data["exercises"]) == 1
    assert data["exercises"][0]["exercise"]["name"] == "Squat"
    assert len(data["exercises"][0]["sets"]) == 2
    assert data["exercises"][0]["sets"][0]["weight"] == 100
    
    # 5. Verify Database
    db_session = session.exec(select(TrainingSession).where(TrainingSession.id == data["id"])).first()
    assert db_session is not None
    assert len(db_session.exercises) == 1
    assert len(db_session.exercises[0].sets) == 2

def test_delete_session(client: TestClient, auth_headers: dict, session: Session, test_user):
    # Create a session manually
    db_session = TrainingSession(
        date=datetime.now(),
        duration_seconds=120,
        user_id=test_user.id
    )
    session.add(db_session)
    session.commit()
    
    response = client.delete(f"/sessions/{db_session.id}", headers=auth_headers)
    assert response.status_code == 200
    
    # Verify it's gone
    deleted = session.exec(select(TrainingSession).where(TrainingSession.id == db_session.id)).first()
    assert deleted is None

from fastapi.testclient import TestClient
from sqlmodel import Session, select
from backend.models import Exercise

def test_create_exercise(client: TestClient, auth_headers: dict):
    response = client.post(
        "/exercises/",
        json={"name": "Push Up", "category": "Strength", "is_custom": True},
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Push Up"
    assert data["user_id"] is not None

def test_read_exercises(client: TestClient, auth_headers: dict, session: Session):
    # Add a public exercise
    public_ex = Exercise(name="Public Ex", category="Cardio", is_custom=False)
    session.add(public_ex)
    session.commit()
    
    response = client.get("/exercises/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Should see at least the public one
    names = [e["name"] for e in data]
    assert "Public Ex" in names

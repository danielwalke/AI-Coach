from fastapi.testclient import TestClient
from sqlmodel import Session
from backend.models import User

def test_register_user(client: TestClient, session: Session):
    response = client.post(
        "/auth/register",
        json={
            "name": "New User",
            "email": "new@example.com",
            "password": "newpassword",
            "age": 30
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    
    # Verify DB
    user = session.exec(select(User).where(User.email == "new@example.com")).first()
    assert user is not None
    assert user.name == "New User"

def test_login_user(client: TestClient, test_user: User):
    response = client.post(
        "/auth/token",
        data={"username": "test@example.com", "password": "testpassword"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data

def test_login_incorrect_password(client: TestClient, test_user: User):
    response = client.post(
        "/auth/token",
        data={"username": "test@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401

from sqlmodel import select

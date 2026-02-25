import httpx
import asyncio

async def test_backend():
    print("Testing backend logic directly...")
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # 1. Login to get token
        resp = await client.post("/auth/login", data={"username": "test@example.com", "password": "password123"})
        if resp.status_code != 200:
            print("Failed to login. Please create test@example.com first.")
            return
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Add Session
        session_data = {
            "date": "2026-02-24T12:00:00Z",
            "duration_seconds": 120,
            "exercises": [
                {
                    "exercise_id": 1,
                    "sets": [
                        {
                            "weight": 100,
                            "reps": 10,
                            "completed": True,
                            "rest_seconds": 45,
                            "set_duration": 15
                        }
                    ]
                }
            ]
        }
        resp = await client.post("/sessions/", json=session_data, headers=headers)
        if resp.status_code != 200:
            print(f"Failed to create session: {resp.text}")
            return
        session_details = resp.json()
        print(f"Created session id: {session_details['id']}")

        # 3. Fetch Session
        resp = await client.get("/sessions/", headers=headers)
        sessions = resp.json()
        new_session = next(s for s in sessions if s['id'] == session_details['id'])
        
        rest_sec = new_session['exercises'][0]['sets'][0]['rest_seconds']
        print(f"rest_seconds in db: {rest_sec}")
        if rest_sec == 45:
            print("Backend logic works perfectly.")
        else:
            print("Backend dropped the rest_seconds!")

if __name__ == "__main__":
    asyncio.run(test_backend())

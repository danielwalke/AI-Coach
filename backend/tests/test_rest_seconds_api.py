"""Phase 2: Backend API test - verify rest_seconds round-trips through the live API.
Run this while the backend is running on localhost:8000.
"""
import httpx
import sys
import os

# Force UTF-8 output on Windows
os.environ["PYTHONIOENCODING"] = "utf-8"

BASE_URL = "http://127.0.0.1:8000"


def test_rest_seconds_round_trip():
    """Create a session with rest_seconds via the API, then GET it back and verify."""
    
    print("=== Phase 2: Backend API Round-Trip Test ===\n")
    
    # 1. Login (use existing test user or register)
    print("1. Authenticating...")
    resp = httpx.post(f"{BASE_URL}/auth/token", data={
        "username": "test@example.com",
        "password": "password123"
    })
    
    if resp.status_code != 200:
        print(f"   Login failed ({resp.status_code}), trying to register...")
        resp = httpx.post(f"{BASE_URL}/auth/register", json={
            "name": "API Test User",
            "email": "apitest_rest@example.com",
            "password": "password123",
            "age": 25
        })
        if resp.status_code != 200:
            print(f"   Registration also failed: {resp.text}")
            sys.exit(1)
    
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [OK] Authenticated")
    
    # 2. Get exercises to find one to use
    print("\n2. Getting exercises...")
    resp = httpx.get(f"{BASE_URL}/exercises/", headers=headers)
    exercises = resp.json()
    if not exercises:
        print("   No exercises found, creating one...")
        resp = httpx.post(f"{BASE_URL}/exercises/", json={
            "name": "REST Test Bench Press",
            "category": "Push",
            "is_custom": True
        }, headers=headers)
        exercise_id = resp.json()["id"]
    else:
        exercise_id = exercises[0]["id"]
    print(f"   Using exercise_id={exercise_id}")
    
    # 3. Create a training session with specific rest_seconds and set_duration values
    print("\n3. Creating session with rest_seconds...")
    session_data = {
        "date": "2026-02-25T06:00:00",
        "duration_seconds": 300,
        "exercises": [
            {
                "exercise_id": exercise_id,
                "sets": [
                    {"weight": 60.0, "reps": 10, "completed": True, "rest_seconds": 0, "set_duration": 45},
                    {"weight": 60.0, "reps": 8,  "completed": True, "rest_seconds": 90, "set_duration": 40},
                    {"weight": 55.0, "reps": 8,  "completed": True, "rest_seconds": 120, "set_duration": 35},
                ]
            }
        ]
    }
    resp = httpx.post(f"{BASE_URL}/sessions/", json=session_data, headers=headers)
    assert resp.status_code == 200, f"   FAIL: Session creation failed: {resp.status_code} {resp.text}"
    created = resp.json()
    session_id = created["id"]
    print(f"   [OK] Created session id={session_id}")
    
    # 4. Print what the POST returned
    print(f"\n4. POST response exercises:")
    for ex in created["exercises"]:
        print(f"   Exercise: {ex['exercise']['name']}")
        for i, s in enumerate(ex["sets"]):
            print(f"     Set {i+1}: weight={s['weight']}, reps={s['reps']}, "
                  f"rest_seconds={s.get('rest_seconds', 'MISSING!')}, "
                  f"set_duration={s.get('set_duration', 'MISSING!')}")
    
    # 5. GET all sessions and find ours
    print(f"\n5. GET /sessions/ to verify round-trip...")
    resp = httpx.get(f"{BASE_URL}/sessions/", headers=headers)
    assert resp.status_code == 200
    sessions = resp.json()
    our = next((s for s in sessions if s["id"] == session_id), None)
    assert our is not None, f"   FAIL: Could not find session id={session_id} in GET response"
    
    sets = our["exercises"][0]["sets"]
    print(f"   Found session with {len(sets)} sets:")
    
    all_ok = True
    expected = [(0, 45), (90, 40), (120, 35)]
    for i, (exp_rest, exp_dur) in enumerate(expected):
        actual_rest = sets[i].get("rest_seconds")
        actual_dur = sets[i].get("set_duration")
        rest_ok = actual_rest == exp_rest
        dur_ok = actual_dur == exp_dur
        status_rest = "[OK]" if rest_ok else "[FAIL]"
        status_dur = "[OK]" if dur_ok else "[FAIL]"
        print(f"     Set {i+1}: rest_seconds={actual_rest} (expected {exp_rest}) {status_rest}, "
              f"set_duration={actual_dur} (expected {exp_dur}) {status_dur}")
        if not rest_ok or not dur_ok:
            all_ok = False
    
    # 6. Cleanup: delete the test session
    print(f"\n6. Cleaning up (deleting session {session_id})...")
    resp = httpx.delete(f"{BASE_URL}/sessions/{session_id}", headers=headers)
    print(f"   Delete status: {resp.status_code}")
    
    if all_ok:
        print("\n=== Phase 2 PASSED: rest_seconds and set_duration round-trip correctly! ===")
    else:
        print("\n=== Phase 2 FAILED: Some values did not round-trip correctly! ===")
        sys.exit(1)


if __name__ == "__main__":
    test_rest_seconds_round_trip()

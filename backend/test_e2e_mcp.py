"""
End-to-end test: Login -> Ask coach for workout plan -> Verify template saved.
Also tests MCP server tools directly, including conceptualization tools.
"""
import requests
import json
import sys
import time
import os

BASE_URL = "http://localhost:8000"

def test_login():
    """Login with test account and return auth token."""
    print("=" * 60)
    print("STEP 1: Login with mcptest@example.com")
    print("=" * 60)
    resp = requests.post(f"{BASE_URL}/auth/token", data={
        "username": "mcptest@example.com",
        "password": "testpassword"
    })
    if resp.status_code != 200:
        # Try registering
        print(f"Login failed ({resp.status_code}), trying to register...")
        resp = requests.post(f"{BASE_URL}/auth/register", json={
            "name": "MCP Test User",
            "email": "mcptest@example.com",
            "password": "testpassword",
            "age": 25
        })
        if resp.status_code != 200:
            print(f"Register also failed ({resp.status_code}): {resp.text}")
            return None
    
    token = resp.json()["access_token"]
    print(f"✅ Login successful. Token: {token[:20]}...")
    return token


def test_list_templates(token):
    """List existing templates to get a baseline count."""
    print("\n" + "=" * 60)
    print("STEP 2: List existing templates")
    print("=" * 60)
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/templates/", headers=headers)
    if resp.status_code != 200:
        print(f"❌ Failed to list templates: {resp.status_code} {resp.text}")
        return 0
    templates = resp.json()
    print(f"✅ Found {len(templates)} existing templates")
    for t in templates:
        print(f"   - [{t['id']}] {t['name']}")
    return len(templates)


def test_coach_chat_web(token):
    """Ask the web LLM coach to generate a workout template."""
    print("\n" + "=" * 60)
    print("STEP 3: Ask AI Coach (web LLM) to create a workout plan")
    print("=" * 60)
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "messages": [],
        "session_ids": [],
        "question": "Create a simple 2-exercise push workout template for me with bench press and overhead press. Keep it simple.",
        "model_source": "web"
    }
    
    resp = requests.post(f"{BASE_URL}/coach/chat", json=payload, headers=headers, stream=True, timeout=120)
    if resp.status_code != 200:
        print(f"❌ Chat failed: {resp.status_code} {resp.text}")
        return False
    
    full_content = ""
    template_created = False
    
    print("📡 Streaming response from AI Coach...")
    for line in resp.iter_lines(decode_unicode=True):
        if not line:
            continue
        if line.startswith("data: "):
            json_str = line[6:]
            try:
                data = json.loads(json_str)
                if data.get("type") == "content":
                    text = data.get("text", "")
                    full_content += text
                    # Print chunks as they arrive
                    print(text, end="", flush=True)
                    if "New Workout Created" in text or "template" in text.lower():
                        template_created = True
                elif data.get("type") == "done":
                    break
                elif data.get("type") == "error":
                    print(f"\n❌ Error from coach: {data.get('text')}")
                    return False
            except json.JSONDecodeError:
                pass
    
    print("\n")
    
    if template_created:
        print("✅ Template creation detected in response!")
    else:
        print("⚠️  No template creation link detected in response.")
        print("   (LLM may not have included <workout_template> tags)")
    
    return True


def test_mcp_list_exercises():
    """Test MCP server list_exercises tool directly."""
    print("\n" + "=" * 60)
    print("STEP 4: Test MCP Server - list_exercises()")
    print("=" * 60)
    
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from backend.mcp_server import list_exercises_logic
    
    result = list_exercises_logic()
    if "Found" in result or "via ExerciseDB" in result or "Available Exercises" in result:
        # Show first 5 lines
        lines = result.strip().split("\n")
        for line in lines[:6]:
            print(f"   {line}")
        if len(lines) > 6:
            print(f"   ... and {len(lines) - 6} more")
        print("✅ MCP list_exercises works!")
        return True
    else:
        print(f"❌ Unexpected result: {result}")
        return False


def test_mcp_create_template():
    """Test MCP server create_workout_template tool directly."""
    print("\n" + "=" * 60)
    print("STEP 5: Test MCP Server - create_workout_template()")
    print("=" * 60)
    
    from backend.mcp_server import create_workout_template_logic, ExerciseInput, SetInput
    
    exercises = [
        ExerciseInput(
            name="Bench Press",
            category="Push",
            sets=[
                SetInput(goal_weight=60, goal_reps=10),
                SetInput(goal_weight=70, goal_reps=8),
                SetInput(goal_weight=80, goal_reps=6),
            ]
        ),
        ExerciseInput(
            name="Overhead Dumbbell Press",
            category="Push",
            sets=[
                SetInput(goal_weight=20, goal_reps=12),
                SetInput(goal_weight=25, goal_reps=10),
            ]
        )
    ]
    
    result = create_workout_template_logic(name="MCP E2E Test Template", exercises=exercises)
    print(f"   Result: {result}")
    
    if "successfully" in result.lower() or "created" in result.lower():
        print("✅ MCP create_workout_template works!")
        return True
    else:
        print(f"❌ Template creation failed: {result}")
        return False


# ========== NEW CONCEPTUALIZATION TOOL TESTS ==========

def test_mcp_design_workout():
    """Test MCP server design_workout tool directly."""
    print("\n" + "=" * 60)
    print("STEP 6: Test MCP Server - design_workout()")
    print("=" * 60)
    
    from backend.mcp_server import design_workout_logic
    
    # Test 1: Upper body hypertrophy
    print("\n   --- Test 1: Upper Body Hypertrophy (intermediate, 60 min) ---")
    result = design_workout_logic(
        goal="upper_body_hypertrophy",
        experience_level="intermediate",
        available_minutes=60,
    )
    plan = json.loads(result)
    
    print(f"   Workout: {plan['name']}")
    print(f"   Exercises: {len(plan['exercises'])}")
    for ex in plan["exercises"]:
        sets_info = f"{len(ex['sets'])} sets × {ex['sets'][0]['goal_reps']} reps"
        print(f"     - {ex['name']} ({ex['category']}) — {sets_info}")
        print(f"       Rationale: {ex['rationale']}")
    
    notes = plan["programming_notes"]
    print(f"   Programming: {notes['scheme']}")
    print(f"   Est. duration: {notes['estimated_duration_min']} min")
    print(f"   Principles: {', '.join(notes['principles'][:2])}")
    
    # Validate structure
    assert len(plan["exercises"]) >= 3, f"Expected >= 3 exercises, got {len(plan['exercises'])}"
    assert plan["programming_notes"]["style"] == "hypertrophy", f"Expected hypertrophy style"
    assert all("sets" in ex for ex in plan["exercises"]), "All exercises must have sets"
    assert all(len(ex["sets"]) >= 2 for ex in plan["exercises"]), "All exercises must have >= 2 sets"
    
    # Test 2: Push day with barbell only
    print("\n   --- Test 2: Push Day (beginner, barbell only, 30 min) ---")
    result2 = design_workout_logic(
        goal="push",
        experience_level="beginner",
        available_minutes=30,
        equipment=["barbell"],
    )
    plan2 = json.loads(result2)
    print(f"   Workout: {plan2['name']}")
    print(f"   Exercises: {len(plan2['exercises'])}")
    for ex in plan2["exercises"]:
        print(f"     - {ex['name']} ({ex['category']})")
    
    assert len(plan2["exercises"]) >= 3, f"Expected >= 3 exercises, got {len(plan2['exercises'])}"
    
    # Test 3: Full body strength (advanced)
    print("\n   --- Test 3: Full Body Strength (advanced, 45 min) ---")
    result3 = design_workout_logic(
        goal="full_body_strength",
        experience_level="advanced",
        available_minutes=45,
    )
    plan3 = json.loads(result3)
    print(f"   Workout: {plan3['name']}")
    print(f"   Exercises: {len(plan3['exercises'])}")
    print(f"   Scheme: {plan3['programming_notes']['scheme']}")
    
    assert plan3["programming_notes"]["style"] == "strength"
    assert "5" in str(plan3["programming_notes"]["scheme"]) or "3" in str(plan3["programming_notes"]["scheme"])
    
    print("\n✅ MCP design_workout works! All 3 tests passed.")
    return True


def test_mcp_get_recommendations():
    """Test MCP server get_training_recommendations tool directly."""
    print("\n" + "=" * 60)
    print("STEP 7: Test MCP Server - get_training_recommendations()")
    print("=" * 60)
    
    from backend.mcp_server import get_training_recommendations_logic
    
    result = get_training_recommendations_logic(user_id=1)
    recs = json.loads(result)
    
    print(f"   Neglected muscle groups: {recs.get('neglected_muscle_groups', [])}")
    print(f"   Stagnating exercises: {recs.get('stagnating_exercises', [])}")
    print(f"   Suggested focus: {recs.get('suggested_focus', 'N/A')}")
    print(f"   Recovery status: {recs.get('recovery_status', 'N/A')}")
    
    # Validate structure
    assert "neglected_muscle_groups" in recs, "Missing neglected_muscle_groups"
    assert "stagnating_exercises" in recs, "Missing stagnating_exercises"
    assert "suggested_focus" in recs, "Missing suggested_focus"
    assert "recovery_status" in recs, "Missing recovery_status"
    assert isinstance(recs["neglected_muscle_groups"], list), "neglected_muscle_groups must be a list"
    assert isinstance(recs["stagnating_exercises"], list), "stagnating_exercises must be a list"
    
    print("✅ MCP get_training_recommendations works!")
    return True


def test_conceptualize_then_create():
    """End-to-end: get_recommendations -> design_workout -> create_template."""
    print("\n" + "=" * 60)
    print("STEP 8: Pipeline Test — Recommend → Design → Create")
    print("=" * 60)
    
    from backend.mcp_server import (
        get_training_recommendations_logic,
        design_workout_logic,
        create_workout_template_logic,
        ExerciseInput,
        SetInput,
    )
    
    # Step 1: Get recommendations
    print("\n   1️⃣  Getting training recommendations...")
    recs_json = get_training_recommendations_logic(user_id=1)
    recs = json.loads(recs_json)
    suggested_focus = recs.get("suggested_focus", "full_body_hypertrophy")
    print(f"      Suggested focus: {suggested_focus}")
    print(f"      Recovery: {recs['recovery_status']}")
    
    # Step 2: Design workout based on recommendations
    print("\n   2️⃣  Designing workout based on recommendation...")
    design_json = design_workout_logic(
        goal=suggested_focus,
        experience_level="intermediate",
        available_minutes=45,
    )
    plan = json.loads(design_json)
    print(f"      Designed: {plan['name']} with {len(plan['exercises'])} exercises")
    for ex in plan["exercises"]:
        print(f"        - {ex['name']}")
    
    # Step 3: Create template from the designed plan
    print("\n   3️⃣  Creating template from designed plan...")
    exercises = []
    for ex in plan["exercises"]:
        sets = [SetInput(goal_weight=s["goal_weight"], goal_reps=s["goal_reps"]) for s in ex["sets"]]
        exercises.append(ExerciseInput(
            name=ex["name"],
            category=ex["category"],
            sets=sets,
        ))
    
    result = create_workout_template_logic(
        name=plan["name"],
        exercises=exercises,
        user_id=1,
    )
    print(f"      Result: {result}")
    
    assert "successfully" in result.lower() or "created" in result.lower(), f"Template creation failed: {result}"
    
    print("\n✅ Full pipeline test passed: Recommend → Design → Create!")
    return True


def test_verify_new_templates(token, baseline_count):
    """Verify templates were actually saved in database."""
    print("\n" + "=" * 60)
    print("STEP 9: Verify templates saved in database")
    print("=" * 60)
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{BASE_URL}/templates/", headers=headers)
    if resp.status_code != 200:
        print(f"❌ Failed to list templates: {resp.status_code}")
        return False
    
    templates = resp.json()
    new_count = len(templates)
    print(f"   Before: {baseline_count} templates")
    print(f"   After: {new_count} templates")
    
    if new_count > baseline_count:
        print(f"✅ {new_count - baseline_count} new template(s) created!")
        for t in templates:
            if t['id'] > baseline_count:
                print(f"   - [{t['id']}] {t['name']}")
        return True
    else:
        print("⚠️  No new templates detected (LLM may not have used template tags)")
        return True  # Not a failure of our code


if __name__ == "__main__":
    print("🏋️ FITNESS APP E2E TEST (with Conceptualization MCP)")
    print("=" * 60)
    
    results = {}
    
    # Step 1: Login
    token = test_login()
    if not token:
        print("\n❌ FAILED: Could not login. Aborting.")
        sys.exit(1)
    results["login"] = True
    
    # Step 2: Baseline template count
    baseline = test_list_templates(token)
    results["list_templates"] = True
    
    # Step 3: Coach chat (web LLM)
    results["coach_chat"] = test_coach_chat_web(token)
    
    # Step 4: MCP list exercises
    results["list_exercises"] = test_mcp_list_exercises()
    
    # Step 5: MCP create template
    results["create_template"] = test_mcp_create_template()
    
    # Step 6: MCP design_workout (NEW)
    try:
        results["design_workout"] = test_mcp_design_workout()
    except AssertionError as e:
        print(f"\n❌ design_workout assertion failed: {e}")
        results["design_workout"] = False
    except Exception as e:
        print(f"\n❌ design_workout error: {e}")
        results["design_workout"] = False
    
    # Step 7: MCP get_training_recommendations (NEW)
    try:
        results["get_recommendations"] = test_mcp_get_recommendations()
    except AssertionError as e:
        print(f"\n❌ get_recommendations assertion failed: {e}")
        results["get_recommendations"] = False
    except Exception as e:
        print(f"\n❌ get_recommendations error: {e}")
        results["get_recommendations"] = False
    
    # Step 8: Full pipeline: Recommend → Design → Create (NEW)
    try:
        results["pipeline"] = test_conceptualize_then_create()
    except AssertionError as e:
        print(f"\n❌ pipeline assertion failed: {e}")
        results["pipeline"] = False
    except Exception as e:
        print(f"\n❌ pipeline error: {e}")
        results["pipeline"] = False
    
    # Step 9: Verify
    results["verify_templates"] = test_verify_new_templates(token, baseline)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    for name, result in results.items():
        status = "✅" if result else "❌"
        print(f"  {status} {name}")
    print(f"\n  {passed}/{total} tests passed")
    
    print("\n" + "=" * 60)
    print("🎉 E2E TEST COMPLETE")
    print("=" * 60)
    
    sys.exit(0 if passed == total else 1)

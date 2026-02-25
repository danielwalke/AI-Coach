import sys
import os

# Ensure backend can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.append(project_root)

# Import logic functions instead of decorated tools
from backend.mcp_server import list_exercises_logic, create_workout_template_logic, ExerciseInput, SetInput

def test_list_exercises():
    print("Testing list_exercises...")
    try:
        result = list_exercises_logic()
        print(result[:200] + "..." if len(result) > 200 else result)
        if "Available Exercises" in result:
            print("PASS")
        else:
            print("FAIL")
    except Exception as e:
        print(f"FAIL: {e}")

def test_create_template():
    print("\nTesting create_workout_template...")
    try:
        exercises = [
            ExerciseInput(
                name="Push Up",
                category="Push",
                sets=[SetInput(goal_weight=0, goal_reps=10)]
            )
        ]
        result = create_workout_template_logic(name="MCP Test Workout", exercises=exercises)
        print(result)
        if "Successfully created" in result:
            print("PASS")
        else:
            print("FAIL")
    except Exception as e:
        print(f"FAIL: {e}")

if __name__ == "__main__":
    test_list_exercises()
    test_create_template()

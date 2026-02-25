try:
    from fastmcp import FastMCP
except ImportError:
    FastMCP = None

from pydantic import BaseModel, Field
from typing import List, Optional
from sqlmodel import select, Session

import sys
import os

# Add the project root to python path so we can import backend
# backend/mcp_server.py -> backend/ -> project_root
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.append(project_root)

# Verify import
try:
    from backend.database import engine
    from backend.models import (
        Exercise, 
        User, 
        TrainingSession, 
        SessionExercise, 
        TrainingSet,
        WorkoutTemplate,
        TemplateExercise,
        TemplateSet
    )
    from backend.routers.template_helper import save_generated_template
except ImportError:
    # If project_root/backend is where we are, maybe we need to append project_root's parent?
    sys.path.append(project_root)
    from backend.database import engine
    from backend.models import (
        Exercise, 
        User, 
        TrainingSession, 
        SessionExercise, 
        TrainingSet,
        WorkoutTemplate,
        TemplateExercise,
        TemplateSet
    )
    from backend.routers.template_helper import save_generated_template


# --- Pydantic Models for Tool Inputs ---

class SetInput(BaseModel):
    goal_weight: float = Field(0, description="Target weight in kg")
    goal_reps: int = Field(0, description="Target number of reps")

class ExerciseInput(BaseModel):
    name: str = Field(..., description="Name of the exercise")
    category: str = Field("Uncategorized", description="Category of the exercise (e.g., Push, Pull, Legs)")
    sets: List[SetInput] = Field(..., description="List of sets to perform")
    video_url: Optional[str] = Field(None, description="URL for exercise demo/video from list_exercises tool")

import httpx

def list_exercises_logic(category: str = None) -> str:
    """List available exercises using RapidAPI ExerciseDB."""
    api_key = os.environ.get("RAPID_API_KEY")
    api_host = os.environ.get("RAPID_API_HOST", "exercisedb.p.rapidapi.com")
    
    if not api_key:
        return "Error: RAPID_API_KEY not found in environment variables."

    headers = {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": api_host
    }
    
    # Decide endpoint based on filter
    # If category matches a "bodyPart" or "target", we can use specific endpoints.
    # Otherwise we default to listing with a limit.
    # Supported BodyParts: back, cardio, chest, lower arms, lower legs, neck, shoulders, upper arms, upper legs, waist
    # Supported Targets: abductors, abs, adductors, biceps, calves, ...
    
    try:
        data = []
        if category:
            # Try to map category to bodyPart or target
            # Simple heuristic: try bodyPart first
            category_lower = category.lower()
            url = f"https://{api_host}/exercises/bodyPart/{category_lower}"
            response = httpx.get(url, headers=headers, params={"limit": 10})
            
            if response.status_code != 200 or not response.json():
                # Fallback to name search if bodyPart fails
                url = f"https://{api_host}/exercises/name/{category_lower}"
                response = httpx.get(url, headers=headers, params={"limit": 10})
                
            if response.status_code == 200:
                data = response.json()
        else:
            # List random exercises (or just the first N)
            url = f"https://{api_host}/exercises"
            response = httpx.get(url, headers=headers, params={"limit": 10})
            if response.status_code == 200:
                data = response.json()
        
        if not data:
            return f"No exercises found for '{category}'."
            
        output = f"Found {len(data)} exercises via ExerciseDB:\n"
        for ex in data:
            name = ex.get("name", "Unknown").title()
            body_part = ex.get("bodyPart", "")
            target = ex.get("target", "")
            # ExerciseDB usually provides a gifUrl, we can include it or just a link to google
            # The prompt requires a link for extended info. 
            # We can use the gifUrl if valid, or generate a google search link.
            # gifUrl example: https://v2.exercisedb.io/image/3_4_Sit-Up.gif
            gif_url = ex.get("gifUrl", "")
            
            # Use gifUrl as the primary link if available, otherwise Google Search
            if gif_url:
                primary_link = gif_url
                output += f"- {name} (Target: {target}, BodyPart: {body_part})\n  Visual: {primary_link}\n"
            else:
                search_link = f"https://www.google.com/search?q={name.replace(' ', '+')}+exercise"
                output += f"- {name} (Target: {target}, BodyPart: {body_part})\n  Info: {search_link}\n"
                 
        return output

    except Exception as e:
        print(f"Error calling RapidAPI: {e}")
        return f"Error executing tool: {str(e)}"

def create_workout_template_logic(
    name: str, 
    exercises: List[ExerciseInput], 
    user_id: int = 1
) -> str:
    with Session(engine) as session:
        try:
            # Check if user exists
            user = session.get(User, user_id)
            if not user:
                # Fallback to first user if specified user not found
                # This is helpful for single-user local deployments
                user = session.exec(select(User)).first()
                if not user:
                    return "Error: No users found in database. Please create a user first."
                print(f"User {user_id} not found, defaulting to user {user.id} ({user.username})")
                user_id = user.id

            # 1. Create Template
            template = WorkoutTemplate(name=name, user_id=user_id, is_ai_generated=True)
            session.add(template)
            session.commit()
            session.refresh(template)
            
            # 2. Add Exercises
            for order, ex_input in enumerate(exercises):
                # Check if exercise exists
                statement = select(Exercise).where(Exercise.name == ex_input.name)
                exercise = session.exec(statement).first()
                
                if not exercise:
                    # Create it
                    # Logic to determine category if not provided? Default to 'Uncategorized'
                    category = ex_input.category if ex_input.category else "Uncategorized"
                    # Check if we have a video_url in the input? 
                    # The ExerciseInput model currently doesn't have it. We should assume the LLM might pass it as description or separate field?
                    # For now, let's just stick to name/category, but if we want to save the URL, 
                    # we need to update ExerciseInput schema in this file too.
                    
                    # Let's assume the LLM passes the URL in the 'description' field if we reuse it, 
                    # OR we need to update ExerciseInput.
                    # Let's update ExerciseInput above first.
                    exercise = Exercise(
                        name=ex_input.name, 
                        category=category, 
                        is_custom=True,
                        video_url=ex_input.video_url # Use the new video_url field
                    )
                    session.add(exercise)
                    session.commit()
                    session.refresh(exercise)
                else:
                    # Update video_url if it's missing and we have it
                    if not exercise.video_url and ex_input.video_url:
                        exercise.video_url = ex_input.video_url
                        session.add(exercise)
                        session.commit()
                
                # Create TemplateExercise linkage
                template_ex = TemplateExercise(
                    template_id=template.id,
                    exercise_id=exercise.id,
                    order=order
                )
                session.add(template_ex)
                session.commit()
                session.refresh(template_ex)
                
                # Create Sets
                for set_input in ex_input.sets:
                    # Map reps/weight. If range (e.g. "8-12"), take lower bound or parse?
                    # For simplicity, taking explicit or default 0
                    # If set_input.reps is a string "8-12", pydantic model for SetInput currently says int or string?
                    # Let's check SetInput definition.
                    
                    t_set = TemplateSet(
                        template_exercise_id=template_ex.id,
                        goal_reps=set_input.goal_reps,
                        goal_weight=set_input.goal_weight
                    )
                    session.add(t_set)
            
            session.commit()
            return f"Workout template '{name}' created successfully with {len(exercises)} exercises."
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return f"Error creating template: {str(e)}"

# --- Exercise Knowledge Base for Workout Conceptualization ---

# Curated compound-first exercise database organized by muscle group
EXERCISE_DATABASE = {
    "chest": {
        "compound": [
            {"name": "Bench Press", "category": "Chest", "equipment": ["barbell", "bench"]},
            {"name": "Incline Bench Press", "category": "Chest", "equipment": ["barbell", "bench"]},
            {"name": "Dips", "category": "Chest", "equipment": ["bodyweight"]},
            {"name": "Push Up", "category": "Chest", "equipment": ["bodyweight"]},
        ],
        "isolation": [
            {"name": "Dumbbell Flyes", "category": "Chest", "equipment": ["dumbbell", "bench"]},
            {"name": "Cable Crossover", "category": "Chest", "equipment": ["cable"]},
        ]
    },
    "back": {
        "compound": [
            {"name": "Deadlift", "category": "Back", "equipment": ["barbell"]},
            {"name": "Barbell Row", "category": "Back", "equipment": ["barbell"]},
            {"name": "Pull Up", "category": "Back", "equipment": ["bodyweight"]},
            {"name": "Lat Pulldown", "category": "Back", "equipment": ["cable"]},
        ],
        "isolation": [
            {"name": "Face Pull", "category": "Back", "equipment": ["cable"]},
            {"name": "Dumbbell Row", "category": "Back", "equipment": ["dumbbell"]},
        ]
    },
    "shoulders": {
        "compound": [
            {"name": "Overhead Press", "category": "Shoulders", "equipment": ["barbell"]},
            {"name": "Dumbbell Shoulder Press", "category": "Shoulders", "equipment": ["dumbbell"]},
        ],
        "isolation": [
            {"name": "Lateral Raise", "category": "Shoulders", "equipment": ["dumbbell"]},
            {"name": "Rear Delt Fly", "category": "Shoulders", "equipment": ["dumbbell"]},
        ]
    },
    "legs": {
        "compound": [
            {"name": "Squat", "category": "Legs", "equipment": ["barbell"]},
            {"name": "Front Squat", "category": "Legs", "equipment": ["barbell"]},
            {"name": "Romanian Deadlift", "category": "Legs", "equipment": ["barbell"]},
            {"name": "Lunge", "category": "Legs", "equipment": ["dumbbell", "bodyweight"]},
            {"name": "Leg Press", "category": "Legs", "equipment": ["machine"]},
        ],
        "isolation": [
            {"name": "Leg Extension", "category": "Legs", "equipment": ["machine"]},
            {"name": "Leg Curl", "category": "Legs", "equipment": ["machine"]},
            {"name": "Calf Raise", "category": "Legs", "equipment": ["machine", "bodyweight"]},
        ]
    },
    "arms": {
        "compound": [
            {"name": "Close Grip Bench Press", "category": "Arms", "equipment": ["barbell", "bench"]},
            {"name": "Chin Up", "category": "Arms", "equipment": ["bodyweight"]},
        ],
        "isolation": [
            {"name": "Barbell Curl", "category": "Arms", "equipment": ["barbell"]},
            {"name": "Tricep Pushdown", "category": "Arms", "equipment": ["cable"]},
            {"name": "Hammer Curl", "category": "Arms", "equipment": ["dumbbell"]},
        ]
    },
    "core": {
        "compound": [
            {"name": "Plank", "category": "Core", "equipment": ["bodyweight"]},
            {"name": "Hanging Leg Raise", "category": "Core", "equipment": ["bodyweight"]},
        ],
        "isolation": [
            {"name": "Cable Crunch", "category": "Core", "equipment": ["cable"]},
            {"name": "Russian Twist", "category": "Core", "equipment": ["bodyweight"]},
        ]
    }
}

# Goal → muscle group mapping
GOAL_MUSCLE_MAP = {
    "upper_body_hypertrophy": ["chest", "back", "shoulders", "arms"],
    "upper_body_strength": ["chest", "back", "shoulders"],
    "lower_body_hypertrophy": ["legs", "core"],
    "lower_body_strength": ["legs", "core"],
    "push": ["chest", "shoulders", "arms"],  # tricep-heavy arms
    "pull": ["back", "arms"],  # bicep-heavy arms
    "legs": ["legs", "core"],
    "full_body_strength": ["chest", "back", "legs", "shoulders"],
    "full_body_hypertrophy": ["chest", "back", "legs", "shoulders", "arms"],
    "push_pull_legs": ["chest", "shoulders", "back", "legs"],  # balanced
}

# Evidence-based set/rep schemes per training goal and experience level
SET_REP_SCHEMES = {
    "strength": {
        "beginner":     {"sets": 3, "reps": 5, "rpe_range": "7-8"},
        "intermediate": {"sets": 4, "reps": 4, "rpe_range": "8-9"},
        "advanced":     {"sets": 5, "reps": 3, "rpe_range": "9-10"},
    },
    "hypertrophy": {
        "beginner":     {"sets": 3, "reps": 10, "rpe_range": "7-8"},
        "intermediate": {"sets": 3, "reps": 10, "rpe_range": "8-9"},
        "advanced":     {"sets": 4, "reps": 10, "rpe_range": "8-10"},
    },
    "endurance": {
        "beginner":     {"sets": 2, "reps": 15, "rpe_range": "6-7"},
        "intermediate": {"sets": 3, "reps": 15, "rpe_range": "7-8"},
        "advanced":     {"sets": 3, "reps": 20, "rpe_range": "7-8"},
    },
}

# Minutes per exercise (approx, for time budgeting)
MINUTES_PER_EXERCISE = 7


def _detect_training_style(goal: str) -> str:
    """Infer strength/hypertrophy/endurance from goal string."""
    g = goal.lower()
    if "strength" in g:
        return "strength"
    if "endurance" in g:
        return "endurance"
    return "hypertrophy"  # default


def _select_exercises_for_group(
    group: str,
    style: str,
    max_exercises: int = 2,
    equipment: list = None,
) -> list:
    """Pick exercises for a muscle group: compounds first, then isolation."""
    db = EXERCISE_DATABASE.get(group, {})
    compounds = db.get("compound", [])
    isolations = db.get("isolation", [])

    # Filter by equipment if specified
    if equipment:
        eq_set = {e.lower() for e in equipment}
        eq_set.add("bodyweight")  # always available
        compounds = [e for e in compounds if any(eq in eq_set for eq in e["equipment"])]
        isolations = [e for e in isolations if any(eq in eq_set for eq in e["equipment"])]

    selected = []
    # Strength → mostly compounds; Hypertrophy → compound + isolation
    compound_count = min(len(compounds), max(1, max_exercises - (1 if style == "hypertrophy" and isolations else 0)))
    selected.extend(compounds[:compound_count])

    remaining = max_exercises - len(selected)
    if remaining > 0 and style != "strength":
        selected.extend(isolations[:remaining])

    # If still short (equipment filter removed too many), pad with whatever is left
    if len(selected) < max_exercises:
        all_available = compounds + isolations
        for ex in all_available:
            if ex not in selected:
                selected.append(ex)
            if len(selected) >= max_exercises:
                break

    return selected


import json as _json

def design_workout_logic(
    goal: str = "full_body_hypertrophy",
    experience_level: str = "intermediate",
    available_minutes: int = 60,
    equipment: list = None,
) -> str:
    """Design a workout using evidence-based programming strategies.

    Returns a JSON workout plan with exercises, sets, reps, and rationale.
    """
    goal_key = goal.lower().replace(" ", "_").replace("-", "_")
    if goal_key not in GOAL_MUSCLE_MAP:
        # Fuzzy match: find best partial match
        for k in GOAL_MUSCLE_MAP:
            if goal_key in k or k in goal_key:
                goal_key = k
                break
        else:
            goal_key = "full_body_hypertrophy"

    muscle_groups = GOAL_MUSCLE_MAP[goal_key]
    style = _detect_training_style(goal)
    exp = experience_level.lower() if experience_level.lower() in ("beginner", "intermediate", "advanced") else "intermediate"

    scheme = SET_REP_SCHEMES[style][exp]
    max_total_exercises = max(3, available_minutes // MINUTES_PER_EXERCISE)

    # Distribute exercises across muscle groups
    exercises_per_group = max(1, max_total_exercises // len(muscle_groups))
    leftover = max_total_exercises - exercises_per_group * len(muscle_groups)

    exercises = []
    for i, group in enumerate(muscle_groups):
        count = exercises_per_group + (1 if i < leftover else 0)
        selected = _select_exercises_for_group(group, style, count, equipment)
        for ex in selected:
            sets_list = [{"goal_weight": 0, "goal_reps": scheme["reps"]} for _ in range(scheme["sets"])]
            exercises.append({
                "name": ex["name"],
                "category": ex["category"],
                "sets": sets_list,
                "rationale": f"{style.title()} focus: {scheme['sets']}×{scheme['reps']} @ RPE {scheme['rpe_range']} for {group}",
            })

    # Trim to max if rounding caused overshoot
    exercises = exercises[:max_total_exercises]

    workout_name = goal.replace("_", " ").title()
    result = {
        "name": workout_name,
        "exercises": exercises,
        "programming_notes": {
            "goal": goal_key,
            "style": style,
            "experience_level": exp,
            "scheme": f"{scheme['sets']} sets × {scheme['reps']} reps @ RPE {scheme['rpe_range']}",
            "total_exercises": len(exercises),
            "estimated_duration_min": len(exercises) * MINUTES_PER_EXERCISE,
            "principles": [
                "Compound movements prioritized over isolation",
                f"{style.title()} rep range applied ({scheme['reps']} reps)",
                "Progressive overload: increase weight when all sets hit target reps",
                "Rest 2-3 min between heavy compounds, 60-90s between isolation",
            ],
        },
    }
    return _json.dumps(result, indent=2)


def get_training_recommendations_logic(user_id: int = 1) -> str:
    """Analyze user workout history and return training recommendations.

    Checks for neglected muscle groups, stagnating exercises, and recovery.
    """
    from datetime import timedelta

    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            user = session.exec(select(User)).first()
            if not user:
                return _json.dumps({"error": "No users found in database."})
            user_id = user.id

        # Fetch last 10 sessions ordered by date desc
        from backend.models import Exercise as ExerciseModel
        sessions_q = (
            select(TrainingSession)
            .where(TrainingSession.user_id == user_id)
            .order_by(TrainingSession.date.desc())
            .limit(10)
        )
        recent_sessions = session.exec(sessions_q).all()

        if not recent_sessions:
            return _json.dumps({
                "neglected_muscle_groups": list(EXERCISE_DATABASE.keys()),
                "stagnating_exercises": [],
                "suggested_focus": "full_body_hypertrophy",
                "recovery_status": "No training history found. Start with a full body workout!",
            })

        # --- 1. Muscle group recency analysis ---
        from datetime import datetime
        now = datetime.utcnow()
        muscle_group_last_trained = {}
        exercise_history = {}  # exercise_name -> list of (date, weight, reps)

        for ts in recent_sessions:
            for se in ts.exercises:
                ex = session.exec(
                    select(ExerciseModel).where(ExerciseModel.id == se.exercise_id)
                ).first()
                if not ex:
                    continue
                # Map exercise category to our muscle group keys
                cat = ex.category.lower()
                matched_group = None
                for group_key in EXERCISE_DATABASE:
                    if cat in group_key or group_key in cat:
                        matched_group = group_key
                        break
                # Fallback: check if exercise name matches any in our DB
                if not matched_group:
                    for group_key, group_data in EXERCISE_DATABASE.items():
                        all_names = [e["name"].lower() for e in group_data.get("compound", []) + group_data.get("isolation", [])]
                        if ex.name.lower() in all_names:
                            matched_group = group_key
                            break

                if matched_group:
                    if matched_group not in muscle_group_last_trained or ts.date > muscle_group_last_trained[matched_group]:
                        muscle_group_last_trained[matched_group] = ts.date

                # Track exercise history for stagnation detection
                for s in se.sets:
                    if ex.name not in exercise_history:
                        exercise_history[ex.name] = []
                    exercise_history[ex.name].append({
                        "date": ts.date.isoformat(),
                        "weight": s.weight,
                        "reps": s.reps,
                    })

        # Neglected groups: not trained for >= 5 days
        neglected = []
        for group in EXERCISE_DATABASE:
            last = muscle_group_last_trained.get(group)
            if not last or (now - last).days >= 5:
                neglected.append(group)

        # --- 2. Stagnation detection: same weight+reps across 3+ sessions ---
        stagnating = []
        for ex_name, entries in exercise_history.items():
            if len(entries) < 3:
                continue
            # Check last 3 entries (most recent)
            last_3 = entries[:3]
            weights = {e["weight"] for e in last_3}
            reps_set = {e["reps"] for e in last_3}
            if len(weights) == 1 and len(reps_set) == 1:
                stagnating.append({
                    "exercise": ex_name,
                    "stuck_at": f"{last_3[0]['weight']}kg × {last_3[0]['reps']} reps",
                    "suggestion": "Try adding 2.5kg or doing 1-2 extra reps next session",
                })

        # --- 3. Suggest focus ---
        if neglected:
            # Suggest a goal that targets neglected groups
            focus_groups = set(neglected)
            if "legs" in focus_groups:
                suggested = "lower_body_hypertrophy"
            elif focus_groups & {"chest", "shoulders"}:
                suggested = "push"
            elif "back" in focus_groups:
                suggested = "pull"
            else:
                suggested = "full_body_hypertrophy"
        else:
            suggested = "full_body_strength"

        # --- 4. Recovery status ---
        most_recent = recent_sessions[0] if recent_sessions else None
        if most_recent:
            days_since = (now - most_recent.date).days
            if days_since == 0:
                recovery = "You trained today. Rest tomorrow or do light active recovery."
            elif days_since == 1:
                recovery = "1 day since last workout. Good to train a different muscle group."
            elif days_since <= 3:
                recovery = f"{days_since} days rest. Fully recovered — time to train!"
            else:
                recovery = f"{days_since} days since last workout. Jump back in with a full body session."
        else:
            recovery = "No recent sessions found."

        result = {
            "neglected_muscle_groups": neglected,
            "stagnating_exercises": stagnating,
            "suggested_focus": suggested,
            "recovery_status": recovery,
        }
        return _json.dumps(result, indent=2)


# --- FastMCP Server Setup ---
if FastMCP:
    mcp = FastMCP("Fitness Coach")

    @mcp.tool()
    def list_exercises(category: str = None) -> str:
        """List available exercises, optionally filtered by category."""
        return list_exercises_logic(category)

    @mcp.tool()
    def create_workout_template(name: str, exercises: List[ExerciseInput], user_id: int = 1) -> str:
        """Create a new workout template for a user.
        
        Args:
            name: The name of the workout template.
            exercises: A list of exercises to include in the template.
            user_id: The ID of the user (default: 1).
        """
        return create_workout_template_logic(name, exercises, user_id)

    @mcp.tool()
    def design_workout(
        goal: str = "full_body_hypertrophy",
        experience_level: str = "intermediate",
        available_minutes: int = 60,
        equipment: list = None,
    ) -> str:
        """Design a workout plan using evidence-based programming strategies.
        
        Call this BEFORE create_workout_template to get a scientifically-backed plan.
        
        Args:
            goal: Training goal. Options: upper_body_hypertrophy, upper_body_strength,
                  lower_body_hypertrophy, lower_body_strength, push, pull, legs,
                  full_body_strength, full_body_hypertrophy, push_pull_legs
            experience_level: beginner, intermediate, or advanced
            available_minutes: How many minutes the user has (default 60)
            equipment: Available equipment list (e.g. ["barbell", "dumbbell", "cable", "machine"])
        """
        return design_workout_logic(goal, experience_level, available_minutes, equipment)

    @mcp.tool()
    def get_training_recommendations(user_id: int = 1) -> str:
        """Analyze workout history and get smart training recommendations.
        
        Returns neglected muscle groups, stagnating exercises, and suggested next focus.
        Call this before design_workout to personalize the plan.
        
        Args:
            user_id: The ID of the user (default: 1).
        """
        return get_training_recommendations_logic(user_id)

    if __name__ == "__main__":
        mcp.run()
else:
    print("FastMCP not installed. Logic functions available, but MCP server cannot run standalone.")

from sqlmodel import Session, select, col
from backend.models import WorkoutTemplate, Exercise, TemplateExercise, TemplateSet

def save_generated_template(db: Session, user_id: int, data: dict) -> int:
    """Save a generated template JSON to the database."""
    print(f"Saving generated template: {data.get('name')}")
    try:
        # Create Template
        template = WorkoutTemplate(
            user_id=user_id,
            name=data.get("name", "New AI Workout"),
            is_ai_generated=True
        )
        db.add(template)
        db.flush()
        db.refresh(template) # Ensure we have the ID
        print(f"Created template ID: {template.id}")

        # Create Exercises
        for i, ex_data in enumerate(data.get("exercises", []), 1):
            ex_name = ex_data.get("name", "Unknown Exercise").strip()
            # Case-insensitive search
            # SQLite default is case-insensitive for ASCII, but let's be explicit if possible or just rely on python for fallback?
            # modifying to use ilike or func.lower if needed, but for now simple search first
            statement = select(Exercise).where(col(Exercise.name).ilike(ex_name))
            db_exercise = db.exec(statement).first()
            
            if not db_exercise:
                print(f"Exercise '{ex_name}' not found, creating new.")
                # Create new exercise
                db_exercise = Exercise(
                    name=ex_name,
                    category=ex_data.get("category", "Uncategorized"), 
                    is_custom=True,
                    user_id=user_id
                )
                db.add(db_exercise)
                db.flush()
                db.refresh(db_exercise)

            # Create Template Exercise
            tmpl_ex = TemplateExercise(
                template_id=template.id,
                exercise_id=db_exercise.id,
                order=ex_data.get("order", i)
            )
            db.add(tmpl_ex)
            db.flush()
            db.refresh(tmpl_ex)

            # Create Sets
            for set_data in ex_data.get("sets", []):
                tmpl_set = TemplateSet(
                    template_exercise_id=tmpl_ex.id,
                    goal_weight=set_data.get("goal_weight", 0),
                    goal_reps=set_data.get("goal_reps", 0)
                )
                db.add(tmpl_set)
        
        db.commit()
        db.refresh(template)
        print(f"Successfully saved template {template.id}")
        return template.id
    except Exception as e:
        print(f"Error saving template: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return 0


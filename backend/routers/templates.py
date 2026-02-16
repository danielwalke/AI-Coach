from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlmodel import Session, select
from pydantic import BaseModel
from backend.database import get_session
from backend.models import (
    WorkoutTemplate, WorkoutTemplateCreate, WorkoutTemplateRead,
    TemplateExercise, TemplateSet,
    Exercise, User, ExerciseRead
)
from backend.auth import get_current_user
from datetime import datetime
import yaml
import json

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=List[WorkoutTemplateRead])
async def list_templates(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    statement = select(WorkoutTemplate).where(WorkoutTemplate.user_id == current_user.id)
    templates = session.exec(statement).all()
    return templates


@router.get("/{template_id}", response_model=WorkoutTemplateRead)
async def get_template(
    template_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    template = session.exec(
        select(WorkoutTemplate).where(
            WorkoutTemplate.id == template_id,
            WorkoutTemplate.user_id == current_user.id
        )
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/", response_model=WorkoutTemplateRead)
async def create_template(
    data: WorkoutTemplateCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    template = WorkoutTemplate(
        name=data.name,
        user_id=current_user.id
    )
    session.add(template)
    session.commit()
    session.refresh(template)

    for order, ex_data in enumerate(data.exercises):
        tex = TemplateExercise(
            template_id=template.id,
            exercise_id=ex_data.exercise_id,
            order=order
        )
        session.add(tex)
        session.commit()
        session.refresh(tex)

        for set_data in ex_data.sets:
            tset = TemplateSet(
                template_exercise_id=tex.id,
                goal_weight=set_data.goal_weight,
                goal_reps=set_data.goal_reps
            )
            session.add(tset)

    session.commit()
    session.refresh(template)
    return template


@router.put("/{template_id}", response_model=WorkoutTemplateRead)
async def update_template(
    template_id: int,
    data: WorkoutTemplateCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    template = session.exec(
        select(WorkoutTemplate).where(
            WorkoutTemplate.id == template_id,
            WorkoutTemplate.user_id == current_user.id
        )
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Delete existing exercises (cascades to sets)
    for ex in list(template.exercises):
        session.delete(ex)
    session.commit()

    # Update template
    template.name = data.name
    template.updated_at = datetime.utcnow()

    # Recreate exercises and sets
    for order, ex_data in enumerate(data.exercises):
        tex = TemplateExercise(
            template_id=template.id,
            exercise_id=ex_data.exercise_id,
            order=order
        )
        session.add(tex)
        session.commit()
        session.refresh(tex)

        for set_data in ex_data.sets:
            tset = TemplateSet(
                template_exercise_id=tex.id,
                goal_weight=set_data.goal_weight,
                goal_reps=set_data.goal_reps
            )
            session.add(tset)

    session.commit()
    session.refresh(template)
    return template


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    template = session.exec(
        select(WorkoutTemplate).where(
            WorkoutTemplate.id == template_id,
            WorkoutTemplate.user_id == current_user.id
        )
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    session.delete(template)
    session.commit()
    return {"ok": True}


@router.get("/{template_id}/export", response_class=PlainTextResponse)
async def export_template(
    template_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    template = session.exec(
        select(WorkoutTemplate).where(
            WorkoutTemplate.id == template_id,
            WorkoutTemplate.user_id == current_user.id
        )
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    yaml_data = {
        "name": template.name,
        "exercises": []
    }
    for tex in template.exercises:
        exercise_data = {
            "name": tex.exercise.name,
            "category": tex.exercise.category,
            "sets": [
                {"weight": s.goal_weight, "reps": s.goal_reps}
                for s in tex.sets
            ]
        }
        yaml_data["exercises"].append(exercise_data)

    return yaml.dump(yaml_data, default_flow_style=False, sort_keys=False, allow_unicode=True)


class YamlImport(BaseModel):
    yaml_content: str


@router.post("/import", response_model=WorkoutTemplateRead)
async def import_template(
    data: YamlImport,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Import a template from YAML. Exercises are matched by name or created."""
    try:
        parsed = yaml.safe_load(data.yaml_content)
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {e}")

    if not parsed or "name" not in parsed or "exercises" not in parsed:
        raise HTTPException(status_code=400, detail="YAML must have 'name' and 'exercises' fields")

    template = WorkoutTemplate(
        name=parsed["name"],
        user_id=current_user.id
    )
    session.add(template)
    session.commit()
    session.refresh(template)

    for order, ex_yaml in enumerate(parsed["exercises"]):
        ex_name = ex_yaml.get("name", "Unknown")
        ex_category = ex_yaml.get("category", "Other")

        # Find existing exercise or create
        exercise = session.exec(
            select(Exercise).where(
                Exercise.name == ex_name,
                (Exercise.user_id == current_user.id) | (Exercise.user_id == None)  # noqa: E711
            )
        ).first()

        if not exercise:
            exercise = Exercise(
                name=ex_name,
                category=ex_category,
                is_custom=True,
                user_id=current_user.id
            )
            session.add(exercise)
            session.commit()
            session.refresh(exercise)

        tex = TemplateExercise(
            template_id=template.id,
            exercise_id=exercise.id,
            order=order
        )
        session.add(tex)
        session.commit()
        session.refresh(tex)

        for s_yaml in ex_yaml.get("sets", []):
            tset = TemplateSet(
                template_exercise_id=tex.id,
                goal_weight=s_yaml.get("weight", 0),
                goal_reps=s_yaml.get("reps", 0)
            )
            session.add(tset)

    session.commit()
    session.refresh(template)
    return template

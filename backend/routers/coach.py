"""
Coach router - LLM-powered workout coaching using Ollama.
Streams responses from qwen3:8b with thinking content support.
"""
import json
import os
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from pydantic import BaseModel

from backend.database import get_session
from backend.models import (
    User, TrainingSession, SessionExercise, TrainingSet, Exercise
)
from backend.auth import get_current_user

router = APIRouter(prefix="/coach", tags=["coach"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    thinking: Optional[str] = None


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    session_ids: List[int] = []
    question: str


def format_sessions_as_markdown(sessions_data: list) -> str:
    """Format training sessions into markdown context for the LLM."""
    if not sessions_data:
        return ""

    md = "# Workout History Context\n\n"
    for s in sessions_data:
        date_str = s["date"]
        duration_min = s["duration_seconds"] // 60
        md += f"## Workout on {date_str} ({duration_min} min)\n\n"
        for ex in s["exercises"]:
            md += f"### {ex['name']} ({ex['category']})\n"
            md += "| Set | Weight (kg) | Reps | Rest (s) |\n"
            md += "|-----|------------|------|----------|\n"
            for i, st in enumerate(ex["sets"], 1):
                md += f"| {i} | {st['weight']} | {st['reps']} | {st['rest_seconds']} |\n"
            md += "\n"
    return md


def fetch_session_data(session_ids: list, user_id: int, db: Session) -> list:
    """Fetch full training session data for given IDs."""
    results = []
    for sid in session_ids:
        ts = db.exec(
            select(TrainingSession)
            .where(TrainingSession.id == sid, TrainingSession.user_id == user_id)
        ).first()
        if not ts:
            continue

        session_data = {
            "date": ts.date.strftime("%Y-%m-%d %H:%M"),
            "duration_seconds": ts.duration_seconds,
            "exercises": []
        }

        for se in ts.exercises:
            exercise = db.exec(
                select(Exercise).where(Exercise.id == se.exercise_id)
            ).first()
            ex_data = {
                "name": exercise.name if exercise else "Unknown",
                "category": exercise.category if exercise else "Unknown",
                "sets": []
            }
            for s in se.sets:
                ex_data["sets"].append({
                    "weight": s.weight,
                    "reps": s.reps,
                    "rest_seconds": s.rest_seconds,
                    "completed": s.completed
                })
            session_data["exercises"].append(ex_data)
        results.append(session_data)
    return results


@router.get("/sessions")
def get_available_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    """Return list of training sessions available for context selection."""
    sessions = db.exec(
        select(TrainingSession)
        .where(TrainingSession.user_id == current_user.id)
        .order_by(TrainingSession.date.desc())  # type: ignore
    ).all()

    result = []
    for s in sessions:
        exercise_names = []
        for se in s.exercises:
            exercise = db.exec(
                select(Exercise).where(Exercise.id == se.exercise_id)
            ).first()
            if exercise:
                exercise_names.append(exercise.name)

        result.append({
            "id": s.id,
            "date": s.date.strftime("%Y-%m-%d %H:%M"),
            "duration_seconds": s.duration_seconds,
            "exercises": exercise_names
        })
    return result


@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    """Stream a chat response from the Ollama LLM."""
    from langchain_ollama import ChatOllama

    # Fetch session context
    context_md = ""
    if request.session_ids:
        sessions_data = fetch_session_data(request.session_ids, current_user.id, db)
        context_md = format_sessions_as_markdown(sessions_data)

    # Build messages for the LLM
    system_prompt = (
        "You are an expert fitness and health coach. You analyze workout data "
        "and provide personalized training recommendations. Be specific and "
        "actionable in your advice. Consider exercise selection, volume, intensity, "
        "and recovery when making recommendations.\n\n"
        "When thinking through a problem, use <think> tags to show your reasoning process."
    )

    if context_md:
        system_prompt += f"\n\nHere is the user's workout history:\n\n{context_md}"

    llm_messages = [("system", system_prompt)]

    # Add conversation history
    for msg in request.messages:
        if msg.role == "user":
            llm_messages.append(("human", msg.content))
        elif msg.role == "assistant":
            llm_messages.append(("ai", msg.content))

    # Add the new question
    llm_messages.append(("human", request.question))

    # Initialize Ollama with extended context
    ollama_host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    llm = ChatOllama(
        model="qwen3:8b",
        num_ctx=16000,
        temperature=0.7,
        base_url=ollama_host,
    )

    async def generate():
        """Stream tokens from the LLM as SSE events."""
        try:
            full_content = ""
            in_thinking = False
            thinking_buffer = ""
            content_buffer = ""

            async for chunk in llm.astream(llm_messages):
                token = chunk.content
                if not token:
                    continue

                full_content += token

                # Parse thinking tags in real-time
                # We need to handle partial <think> and </think> tags
                if "<think>" in full_content and not in_thinking:
                    in_thinking = True
                    # Split: everything before <think> is content, after is thinking
                    before_think = full_content.split("<think>", 1)[0]
                    if before_think and before_think != content_buffer:
                        new_content = before_think[len(content_buffer):]
                        if new_content:
                            content_buffer = before_think
                            yield f"data: {json.dumps({'type': 'content', 'text': new_content})}\n\n"
                    thinking_start = full_content.split("<think>", 1)[1]
                    if "</think>" in thinking_start:
                        thinking_text = thinking_start.split("</think>", 1)[0]
                        in_thinking = False
                        yield f"data: {json.dumps({'type': 'thinking', 'text': thinking_text})}\n\n"
                        after_think = thinking_start.split("</think>", 1)[1]
                        if after_think:
                            content_buffer += after_think
                            yield f"data: {json.dumps({'type': 'content', 'text': after_think})}\n\n"
                    else:
                        new_thinking = thinking_start[len(thinking_buffer):]
                        if new_thinking:
                            thinking_buffer = thinking_start
                            yield f"data: {json.dumps({'type': 'thinking', 'text': new_thinking})}\n\n"
                elif in_thinking:
                    after_think_tag = full_content.split("<think>", 1)[1]
                    if "</think>" in after_think_tag:
                        thinking_text = after_think_tag.split("</think>", 1)[0]
                        new_thinking = thinking_text[len(thinking_buffer):]
                        if new_thinking:
                            yield f"data: {json.dumps({'type': 'thinking', 'text': new_thinking})}\n\n"
                        in_thinking = False
                        thinking_buffer = ""
                        after_close = after_think_tag.split("</think>", 1)[1]
                        if after_close:
                            new_content = after_close[len(content_buffer):]
                            if new_content:
                                content_buffer = after_close
                                yield f"data: {json.dumps({'type': 'content', 'text': new_content})}\n\n"
                    else:
                        new_thinking = after_think_tag[len(thinking_buffer):]
                        if new_thinking:
                            thinking_buffer = after_think_tag
                            yield f"data: {json.dumps({'type': 'thinking', 'text': new_thinking})}\n\n"
                else:
                    # No thinking tags, just content
                    new_content = full_content[len(content_buffer):]
                    if new_content:
                        content_buffer = full_content
                        yield f"data: {json.dumps({'type': 'content', 'text': new_content})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'text': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

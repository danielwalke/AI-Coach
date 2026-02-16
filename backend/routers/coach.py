import json
import os
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from pydantic import BaseModel
import httpx

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
    model_source: str = "web"  # "web" or "local"


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


async def stream_web_llm(messages: list, system_prompt: str):
    """Stream from OpenRouter (primary) or Pollinations (fallback).
    
    OpenRouter offers free access to high-quality models like Llama 3.3 70B.
    Set OPENROUTER_API_KEY env var for best quality (free, no credit card).
    Falls back to Pollinations if no key is set.
    """
    
    # Prepare messages — skip the first "system" tuple since we add it explicitly
    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        role_key = msg[0]
        content = msg[1]
        if role_key == "system":
            continue
        role = "assistant" if role_key == "ai" else "user"
        api_messages.append({"role": role, "content": content})
    
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
    
    if openrouter_key:
        # Use OpenRouter with a high-quality free model
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {openrouter_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "messages": api_messages,
            "model": os.environ.get("OPENROUTER_MODEL", "nvidia/nemotron-nano-9b-v2:free"),
            "stream": True,
            "temperature": 0.7,
        }
    else:
        # Fallback to Pollinations (lower quality, no API key needed)
        url = "https://text.pollinations.ai/openai/chat/completions"
        headers = {"Content-Type": "application/json"}
        payload = {
            "messages": api_messages,
            "model": "openai",
            "stream": True,
        }

    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST", url, json=payload, headers=headers, timeout=90.0
        ) as response:
            if response.status_code != 200:
                error_body = await response.aread()
                print(f"[stream_web_llm] Error {response.status_code}: {error_body.decode('utf-8', errors='replace')}")
                yield f"Error: LLM API returned status {response.status_code}. Please check your API key."
                return
            
            buffer = ""
            async for chunk in response.aiter_bytes():
                if not chunk:
                    continue
                try:
                    buffer += chunk.decode("utf-8")
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line:
                            continue
                        if line == "data: [DONE]":
                            return
                        if line.startswith("data: "):
                            json_str = line[6:]
                            try:
                                data = json.loads(json_str)
                                if "error" in data:
                                    print(f"[stream_web_llm] API error: {data['error']}")
                                    yield f"Error: {data['error'].get('message', 'Unknown API error')}"
                                    return
                                if "choices" in data and len(data["choices"]) > 0:
                                    delta = data["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                pass
                except Exception as e:
                    print(f"[stream_web_llm] Exception: {e}")
                    pass


@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    """Stream a chat response from the chosen LLM source."""
    
    # Fetch session context
    context_md = ""
    if request.session_ids:
        sessions_data = fetch_session_data(request.session_ids, current_user.id, db)
        context_md = format_sessions_as_markdown(sessions_data)

    # Build system prompt
    system_prompt = (
        "You are an expert fitness and health coach. You analyze workout data "
        "and provide personalized training recommendations. Be specific and "
        "actionable in your advice. "
    )
    
    if request.model_source == "local":
        system_prompt += (
            "Consider exercise selection, volume, intensity, and recovery.\n"
            "When thinking through a problem, use <think> tags to show your reasoning process."
        )
    else:
        # Web/Pollinations — explicit formatting for weaker models
        system_prompt += (
            "Keep your advice concise, well-structured, and motivating. "
            "Always use proper markdown formatting: "
            "use **bold** for emphasis, use bullet points (- ) for lists, "
            "use numbered lists (1. 2. 3.) for steps, "
            "and use headings (## ) to organize sections. "
            "Write complete sentences. Never skip words or leave sentences incomplete. "
            "Do NOT use <think> tags."
        )

    if context_md:
        system_prompt += f"\n\nHere is the user's workout history:\n\n{context_md}"

    # Prepare messages for internal logic
    llm_messages = [("system", system_prompt)]
    for msg in request.messages:
        if msg.role == "user":
            llm_messages.append(("human", msg.content))
        elif msg.role == "assistant":
            llm_messages.append(("ai", msg.content))
    llm_messages.append(("human", request.question))

    async def generate():
        """Stream tokens as SSE events."""
        try:
            full_content = ""
            in_thinking = False
            thinking_buffer = ""
            content_buffer = ""
            
            # Select the token generator based on source
            if request.model_source == "local":
                from langchain_ollama import ChatOllama
                ollama_host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
                ollama_model = os.environ.get("OLLAMA_MODEL", "qwen3:8b")
                
                llm = ChatOllama(
                    model=ollama_model,
                    num_ctx=16000,
                    temperature=0.7,
                    base_url=ollama_host,
                )
                # Helper to normalize LangChain chunk to string
                async def local_stream():
                    async for chunk in llm.astream(llm_messages):
                        if chunk.content:
                            yield chunk.content

                token_generator = local_stream()

            else:
                # Web / Pollinations
                token_generator = stream_web_llm(llm_messages, system_prompt)

            # Process tokens from the selected generator
            async for token in token_generator:
                full_content += token

                # Parse thinking tags in real-time
                if "<think>" in full_content and not in_thinking:
                    in_thinking = True
                    before_think = full_content.split("<think>", 1)[0]
                    
                    # Output content before the open tag
                    if before_think and before_think != content_buffer:
                        new_content = before_think[len(content_buffer):]
                        if new_content:
                            content_buffer = before_think
                            yield f"data: {json.dumps({'type': 'content', 'text': new_content})}\n\n"
                    
                    thinking_start = full_content.split("<think>", 1)[1]
                    
                    # Check if it was closed immediately in the same chunk
                    if "</think>" in thinking_start:
                        thinking_text = thinking_start.split("</think>", 1)[0]
                        in_thinking = False
                        yield f"data: {json.dumps({'type': 'thinking', 'text': thinking_text})}\n\n"
                        
                        after_think = thinking_start.split("</think>", 1)[1]
                        if after_think:
                            content_buffer += after_think
                            yield f"data: {json.dumps({'type': 'content', 'text': after_think})}\n\n"
                    else:
                        # Thinking started but not finished
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
                        # Still thinking
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


class MotivateRequest(BaseModel):
    duration_seconds: int = 0
    exercise_count: int = 0
    total_sets: int = 0
    template_name: Optional[str] = None


FALLBACK_QUOTES = [
    "Every rep counts. You showed up, and that's what matters! 💪",
    "Consistency beats perfection. Another session in the books! 🔥",
    "You didn't come this far to only come this far. Keep pushing! 🚀",
    "The only bad workout is the one that didn't happen. Great job! ⭐",
    "Your future self will thank you for today's effort! 💯",
    "Champions are made in the sessions nobody watches. Well done! 🏆",
    "Discipline is choosing between what you want now and what you want most. 🎯",
    "You're building something great, one workout at a time! 🏗️",
]


@router.post("/motivate")
async def get_motivation(
    request: MotivateRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate a short motivational phrase after a workout using LLM, with local fallback."""
    import random

    duration_min = request.duration_seconds // 60

    prompt = (
        f"The user just finished a workout. "
        f"Duration: {duration_min} minutes. "
        f"Exercises: {request.exercise_count}. "
        f"Total sets: {request.total_sets}. "
        f"{f'Template: {request.template_name}. ' if request.template_name else ''}"
        f"Write a SHORT (1-2 sentences max) motivational and encouraging message. "
        f"Be warm, personal, and use one emoji. Don't be generic. "
        f"Reference the actual stats to make it feel personal."
    )

    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")

    if openrouter_key:
        try:
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {openrouter_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "messages": [
                    {"role": "system", "content": "You are an enthusiastic fitness coach. Keep responses very short."},
                    {"role": "user", "content": prompt},
                ],
                "model": os.environ.get("OPENROUTER_MODEL", "nvidia/nemotron-nano-9b-v2:free"),
                "temperature": 0.9,
                "max_tokens": 100,
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, headers=headers, timeout=15.0)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    return {"quote": content}
        except Exception as e:
            print(f"[motivate] LLM error, falling back: {e}")

    # Fallback: pick a random local quote
    return {"quote": random.choice(FALLBACK_QUOTES)}


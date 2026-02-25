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
    User, TrainingSession, SessionExercise, TrainingSet, Exercise,
    WorkoutTemplate, TemplateExercise, TemplateSet
)
from backend.auth import get_current_user
from .template_helper import save_generated_template

import logging
logging.basicConfig(
    filename='backend_debug.log', 
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import MCP tool logic for function calling
import sys as _sys
_mcp_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _mcp_dir not in _sys.path:
    _sys.path.append(_mcp_dir)
from backend.mcp_server import (
    list_exercises_logic,
    create_workout_template_logic,
    design_workout_logic,
    get_training_recommendations_logic,
    ExerciseInput as MCPExerciseInput,
    SetInput as MCPSetInput,
)

router = APIRouter(prefix="/coach", tags=["coach"])

# OpenAI-format tool definitions for function calling
OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_exercises",
            "description": "List available exercises in the database, optionally filtered by category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category to filter by (e.g. Push, Pull, Legs, Chest, Back, Core)"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_workout_template",
            "description": "Create and save a workout template for the user. Call this AFTER using design_workout to get the exercise plan. Pass the exercises from the design_workout output directly.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name of the workout template"
                    },
                    "exercises": {
                        "type": "array",
                        "description": "List of exercises in the template",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string", "description": "Exercise name"},
                                "category": {"type": "string", "description": "Category (Push, Pull, Legs, etc)"},
                                "sets": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "goal_weight": {"type": "number", "description": "Target weight in kg"},
                                            "goal_reps": {"type": "integer", "description": "Target reps"}
                                        },
                                        "required": ["goal_weight", "goal_reps"]
                                    }
                                }
                            },
                            "required": ["name", "category", "sets"]
                        }
                    }
                },
                "required": ["name", "exercises"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "design_workout",
            "description": "Design a workout plan using evidence-based programming strategies. Call this BEFORE create_workout_template. Returns a scientifically-backed exercise plan with sets, reps, and rationale.",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal": {
                        "type": "string",
                        "description": "Training goal: upper_body_hypertrophy, upper_body_strength, lower_body_hypertrophy, lower_body_strength, push, pull, legs, full_body_strength, full_body_hypertrophy, push_pull_legs"
                    },
                    "experience_level": {
                        "type": "string",
                        "enum": ["beginner", "intermediate", "advanced"],
                        "description": "User experience level"
                    },
                    "available_minutes": {
                        "type": "integer",
                        "description": "Available workout time in minutes (default 60)"
                    },
                    "equipment": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Available equipment (barbell, dumbbell, cable, machine, bench)"
                    }
                },
                "required": ["goal"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_training_recommendations",
            "description": "Analyze the user's workout history to find neglected muscle groups, stagnating exercises, and recovery status. Call this FIRST to personalize the workout plan.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "integer",
                        "description": "The user ID (default: current user)"
                    }
                },
                "required": []
            }
        }
    }
]


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


def _execute_tool_call(func_name: str, func_args: dict, user_id: int) -> str:
    """Execute an MCP tool and return the result string."""
    print(f"[tool_call] Executing {func_name}({func_args})")
    try:
        if func_name == "list_exercises":
            return list_exercises_logic(func_args.get("category"))
        elif func_name == "create_workout_template":
            # Parse exercises into MCPExerciseInput objects
            exercises = []
            for ex in func_args.get("exercises", []):
                sets = [MCPSetInput(**s) for s in ex.get("sets", [])]
                exercises.append(MCPExerciseInput(
                    name=ex["name"],
                    category=ex.get("category", "Uncategorized"),
                    sets=sets
                ))
            return create_workout_template_logic(
                name=func_args.get("name", "AI Workout"),
                exercises=exercises,
                user_id=user_id
            )
        elif func_name == "design_workout":
            return design_workout_logic(
                goal=func_args.get("goal", "full_body_hypertrophy"),
                experience_level=func_args.get("experience_level", "intermediate"),
                available_minutes=func_args.get("available_minutes", 60),
                equipment=func_args.get("equipment"),
            )
        elif func_name == "get_training_recommendations":
            return get_training_recommendations_logic(
                user_id=func_args.get("user_id", user_id),
            )
        else:
            return f"Unknown tool: {func_name}"
    except Exception as e:
        print(f"[tool_call] Error executing {func_name}: {e}")
        return f"Error executing tool: {e}"


async def stream_web_llm(messages: list, system_prompt: str, user_id: int = 1):
    """Stream from OpenRouter (primary) or Pollinations (fallback).
    
    OpenRouter: uses function calling for reliable template creation.
    Pollinations: falls back to XML-tag-based template parsing.
    """
    logger.info(f"Starting stream_web_llm for user {user_id}")
    
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
    use_tools = bool(openrouter_key)  # Only OpenRouter supports tool calling
    
    if openrouter_key:
        model_name = os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct")
        logger.info(f"[OpenRouter] ✅ Using API key (key=...{openrouter_key[-6:]}) with model={model_name} | tools enabled")
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {openrouter_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://antigravity.fitness", # Optional, for including your app on openrouter.ai rankings.
            "X-Title": "Antigravity Fitness", # Optional. Shows in rankings on openrouter.ai.
        }
    else:
        # Fallback to local Ollama if no key
        model_name = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b") # Default local model
        # ... (rest of logic handles local url) ...
        
        # NOTE: Local LLM logic in this function is legacy/fallback for now. 
        # Ideally we'd use a unified interface. For now, we focus on OpenRouter.
        pass

    async with httpx.AsyncClient() as client:
        try:
            max_iterations = 5
            iteration = 0
            
            while iteration < max_iterations:
                iteration += 1
                
                # Prepare payload for this iteration
                if openrouter_key:
                    payload = {
                        "messages": api_messages,
                        "model": model_name,
                        "stream": True,
                        "temperature": 0.7,
                        "tools": OPENAI_TOOLS,
                    }
                else:
                    payload = {
                        "messages": api_messages,
                        "model": "openai",
                        "stream": True,
                    }
                
                logger.info(f"[stream_web_llm] Iteration {iteration} request messages: {json.dumps(api_messages, default=str)}")

                full_content = ""
                async with client.stream("POST", url, json=payload, headers=headers, timeout=90.0) as response:
                    if response.status_code != 200:
                        error_body = await response.aread()
                        logger.error(f"[stream_web_llm] Error {response.status_code}: {error_body.decode('utf-8', errors='replace')}")
                        yield f"Error: LLM API returned status {response.status_code}. Please check your API key."
                        return
                    
                    # Track tool calls from streaming deltas for THIS iteration
                    tool_calls_acc = {}  # index -> {"id": ..., "name": ..., "arguments": ...}
                    
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue
                        if line == "data: [DONE]":
                            break
                        if line.startswith("data: "):
                            try:
                                data = json.loads(line[6:])
                                if "error" in data:
                                    logger.error(f"[stream_web_llm] API error: {data['error']}")
                                    yield f"Error: {data['error'].get('message', 'Unknown API error')}"
                                    return
                                    
                                if "choices" in data and len(data["choices"]) > 0:
                                    delta = data["choices"][0].get("delta", {})
                                    
                                    # Handle content tokens - yield immediately
                                    content = delta.get("content")
                                    if content:
                                        full_content += content
                                        yield content
                                    
                                    # Handle tool call deltas
                                    tc_deltas = delta.get("tool_calls", [])
                                    for tc_delta in tc_deltas:
                                        idx = tc_delta.get("index", 0)
                                        if idx not in tool_calls_acc:
                                            tool_calls_acc[idx] = {
                                                "id": tc_delta.get("id", ""),
                                                "name": "",
                                                "arguments": ""
                                            }
                                        if tc_delta.get("id"):
                                            tool_calls_acc[idx]["id"] = tc_delta["id"]
                                        func = tc_delta.get("function", {})
                                        if func.get("name"):
                                            tool_calls_acc[idx]["name"] += func["name"]
                                        if func.get("arguments"):
                                            tool_calls_acc[idx]["arguments"] += func["arguments"]
                            except json.JSONDecodeError:
                                pass
                
                # End of stream for this iteration.
                
                # If NO tool calls, we check if we missed one or are done.
                if not tool_calls_acc:
                    # Heuristic: If user asked to create a template, and we didn't call the tool, prompt again.
                    # Check the last user message in the chain
                    last_user_content = ""
                    for m in reversed(api_messages):
                        if m["role"] == "user":
                            last_user_content = m["content"].lower()
                            break
                    
                    must_create = "create" in last_user_content and ("template" in last_user_content or "workout" in last_user_content)
                    
                    logger.info(f"[stream_web_llm] Iteration {iteration}: Checking for missing tools. last_user_content='{last_user_content[:50]}...', must_create={must_create}")

                    if must_create and iteration <= 2:
                        logger.warning(f"[stream_web_llm] Iteration {iteration}: Missing mandatory tool call detected. Auto-correcting.")
                        # We must add the assistant's text response to history so context is preserved
                        api_messages.append({"role": "assistant", "content": full_content})
                        
                        # Add correction prompt
                        correction_msg = "You listed the exercises (or discussed them) but you did NOT call the `create_workout_template` tool. You MUST call this tool to strictly follow the protocol. Please call `create_workout_template` now."
                        api_messages.append({"role": "user", "content": correction_msg})
                        
                        # Notify user of auto-correction (optional, but good for debugging/transparency)
                        yield f"\n\n*(System: Auto-correcting to ensure template creation...)*\n\n"
                        continue
                    
                    # Otherwise, really done.
                    break
                
                # If successful tool calls:
                logger.info(f"[stream_web_llm] Iteration {iteration}: Processing {len(tool_calls_acc)} tool call(s)")
                
                # 1. Append Assistant Message with Tool Calls to history
                assistant_tool_calls_json = []
                for idx in sorted(tool_calls_acc.keys()):
                    tc = tool_calls_acc[idx]
                    assistant_tool_calls_json.append({
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": tc["arguments"]
                        }
                    })
                
                # Note: The 'content' (if any) was already yielded to user. 
                # Ideally we should also add it to the assistant message history if it existed.
                # But for simplicity in tool loops, usually content is empty or just "Thinking...". 
                # Let's assume content is negligible for the logic history or optional.
                # OpenRouter/OpenAI usually expects the assistant message to match what was generated.
                api_messages.append({
                    "role": "assistant",
                    "tool_calls": assistant_tool_calls_json
                })
                
                # 2. Execute Tools and Append Results
                for tc_msg in assistant_tool_calls_json:
                    func_name = tc_msg["function"]["name"]
                    try:
                        func_args = json.loads(tc_msg["function"]["arguments"])
                    except json.JSONDecodeError:
                        func_args = {}
                    
                    result = _execute_tool_call(func_name, func_args, user_id)
                    logger.info(f"[stream_web_llm] Tool {func_name} result: {result[:100]}...")
                    
                    api_messages.append({
                        "role": "tool",
                        "tool_call_id": tc_msg["id"],
                        "content": result
                    })
                
                # Loop continues to next iteration (sending all messages including tool results)

        except Exception as e:
            logger.error(f"[stream_web_llm] CRITICAL ERROR: {e}")
            import traceback
            traceback.print_exc()
            yield f"Error: An unexpected error occurred in the AI Coach: {str(e)}"


@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    """Stream a chat response from the chosen LLM source."""
    logger.info(f"Chat request from user {current_user.id}: {request.question} (model={request.model_source})")
    
    # Fetch session context
    context_md = ""
    if request.session_ids:
        sessions_data = fetch_session_data(request.session_ids, current_user.id, db)
        context_md = format_sessions_as_markdown(sessions_data)

    # Build system prompt
    use_function_calling = bool(os.environ.get("OPENROUTER_API_KEY", "")) and request.model_source == "web"
    
    system_prompt = (
        "You are an expert fitness and health coach. You analyze workout data "
        "and provide personalized training recommendations. "
        "Your style is direct and focused on results. "
        "PRIORITIZE main compound exercises (Squat, Deadlift, Bench Press, Overhead Press, Rows, Pull-ups, Dips). "
        "Avoid exotic or overly complex exercises unless specifically necessary. "
        "Do NOT include warm-up or cool-down sets unless explicitly asked by the user. "
        "Focus on hypertrophy and strength. "
        "Be specific and actionable in your advice. "
    )
    
    if use_function_calling:
        system_prompt += (
            "You have access to tools. "
            "When the user asks you to create, design, or generate a workout plan or template, "
            "you MUST follow the Workout Creation Pipeline below. "
            "Always use the tools when designing workouts — never just describe them in text without saving. "
            "\n\n**Workout Creation Pipeline (MUST follow this order):**\n"
            "1. **Recommend**: Call `get_training_recommendations` to analyze the user's history and find neglected muscles / stagnation.\n"
            "2. **Design**: Call `design_workout` with the appropriate goal (use the recommendation's `suggested_focus` if the user didn't specify). This returns a scientifically-backed plan.\n"
            "3. **Save**: Call `create_workout_template` with the exercises from the design_workout output.\n"
            "4. **Explain**: Briefly explain the programming rationale to the user (use the `programming_notes` from design_workout).\n"
            "\n**IMPORTANT**: You can also use `list_exercises` to find video/gif URLs for exercises and pass them as `video_url`.\n"
            "\n**CRITICAL**: You MUST call `create_workout_template` to save the plan. Never just describe it in text.\n"
            "Keep your advice concise, well-structured, and motivating. "
            "Always use proper markdown formatting: use **bold** for emphasis, use bullet points (- ) for lists, "
            "use numbered lists (1. 2. 3.) for steps, and use headings (## ) to organize sections. "
            "Write complete sentences. Never skip words or leave sentences incomplete. "
            "Do NOT use <think> tags."
        )
    else:
        system_prompt += (
            "If you design a workout plan for the user, you MUST output it as a JSON block "
            "wrapped in <workout_template> tags at the END of your response. "
            "Schema: <workout_template>{ \"name\": \"...\", \"exercises\": [ { \"name\": \"...\", \"category\": \"...\", \"sets\": [ { \"goal_weight\": 0, \"goal_reps\": 10 } ] } ] }</workout_template>"
        )
    
    if request.model_source == "local":
        system_prompt += (
            "You have access to tools `list_exercises` and `create_workout_template`. "
            "If the user asks for a workout plan, you MUST use `create_workout_template`. "
            "Do not just list exercises in text. Create the template using the tool. "
            "Before calling the tool, use <think> tags to plan the workout structure (Exercises, Sets, Reps). "
            "Keep the plan simple: 3-5 main compound exercises. "
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
            # Select the token generator based on source
            if request.model_source == "local":
                # Send immediate feedback to keep connection alive
                yield f"data: {json.dumps({'type': 'thinking', 'text': 'Initializing local AI...'})}\n\n"
                
                try:
                    from langchain_ollama import ChatOllama
                    from langchain_core.tools import tool
                    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
                except ImportError as e:
                    yield f"data: {json.dumps({'type': 'error', 'text': f'Missing dependency: {e}. Please run pip install langchain-ollama'})}\n\n"
                    return

                # Import logic functions from mcp_server (which we ensured is importable)
                try:
                    from backend.mcp_server import list_exercises_logic, create_workout_template_logic, ExerciseInput
                except ImportError as e:
                    yield f"data: {json.dumps({'type': 'error', 'text': f'Backend error: {e}'})}\n\n"
                    return
                
                # Wrap logic as LangChain tools
                @tool
                def list_exercises_tool(category: str = None) -> str:
                    """List available exercises, optionally filtered by category."""
                    return list_exercises_logic(category)

                @tool
                def create_workout_template_tool(name: str, exercises: list[dict], user_id: int = 1) -> str:
                    """Create a new workout template for a user.
                    
                    Args:
                        name: The name of the workout template.
                        exercises: A visible list of exercises (e.g. [{"name": "Squat", "sets": [{"goal_reps": 5, "goal_weight": 100}]}]).
                        user_id: The ID of the user (default: 1).
                    """
                    # Convert dicts back to ExerciseInput for the logic function
                    try:
                        # Validate input structure by mapping manually if needed or trusting dict
                        # The logic function expects List[ExerciseInput], and Pydantic can often coerce dicts
                        # But let's be safe and construct the objects
                        ex_inputs = []
                        for ex in exercises:
                            # If it's already a dict matching the schema, Pydantic coercion in `create_workout_template_logic` might work 
                            # if we modified the signature there, but it expects Pydantic models.
                            # Actually, `create_workout_template_logic` signature: exercises: List[ExerciseInput]
                            # So we need to convert.
                            ex_inputs.append(ExerciseInput(**ex))
                        
                        return create_workout_template_logic(name, ex_inputs, user_id)
                    except Exception as e:
                        return f"Error parsing input: {str(e)}"

                tools = [list_exercises_tool, create_workout_template_tool]

                ollama_host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
                ollama_model = os.environ.get("OLLAMA_MODEL", "qwen3:8b")
                
                llm = ChatOllama(
                    model=ollama_model,
                    num_ctx=16000,
                    temperature=0.7,
                    base_url=ollama_host,
                )
                llm_with_tools = llm.bind_tools(tools)

                async def local_stream():
                    # Check if tools are needed by invoking first (robustness)
                    # We convert internal messages format to LangChain messages
                    lc_messages = [SystemMessage(content=system_prompt)]
                    for role, content in llm_messages[1:]: # skip system which we just added
                        if role == "human":
                            lc_messages.append(HumanMessage(content=content))
                        elif role == "ai":
                            lc_messages.append(AIMessage(content=content))
                    
                    # First call: see if it wants to use a tool
                    response = await llm_with_tools.ainvoke(lc_messages)
                    
                    if response.tool_calls:
                        lc_messages.append(response) # Add the AI's tool call message
                        for tool_call in response.tool_calls:
                            tool_name = tool_call["name"]
                            tool_args = tool_call["args"]
                            tool_call_id = tool_call["id"]
                            
                            # Execute tool
                            tool_output = "Error: Tool not found"
                            if tool_name == "list_exercises_tool":
                                tool_output = list_exercises_tool.invoke(tool_args)
                            elif tool_name == "create_workout_template_tool":
                                # OpenRouter uses current_user.id injection, do the same here if needed
                                # But the tool arg has user_id, which the LLM might guess or skip.
                                # Let's inject current_user.id if not present or default
                                if "user_id" not in tool_args or tool_args["user_id"] == 1:
                                    tool_args["user_id"] = current_user.id
                                tool_output = create_workout_template_tool.invoke(tool_args)
                            
                            # Append tool output
                            lc_messages.append(ToolMessage(tool_call_id=tool_call_id, content=str(tool_output)))
                        
                        # Stream the final response after tool execution
                        async for chunk in llm_with_tools.astream(lc_messages):
                            if chunk.content:
                                yield chunk.content
                    else:
                        # No tool calls, just yield the content we already got
                        # (We could have streamed from start, but we chose robustness)
                        yield response.content
                        if not response.content:
                            # Fallback if empty content (maybe thinking?)
                            pass

                token_generator = local_stream()

            else:
                # Web / Pollinations — pass user_id for tool execution
                token_generator = stream_web_llm(llm_messages, system_prompt, user_id=current_user.id)


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
                    # Logic for Template Parsing
                    # Only look at what we haven't processed yet
                    unprocessed = full_content[len(content_buffer):]
                    start_marker = "<workout_template>"
                    end_marker = "</workout_template>"

                    if start_marker in unprocessed:
                        if end_marker in unprocessed:
                            # It is closed. Process it.
                            pre_temp_unproc = unprocessed.split(start_marker, 1)[0]
                            
                            # Yield anything before the template
                            if pre_temp_unproc:
                                yield f"data: {json.dumps({'type': 'content', 'text': pre_temp_unproc})}\n\n"
                                content_buffer += pre_temp_unproc

                            # Extract json
                            template_block = unprocessed.split(start_marker, 1)[1].split(end_marker, 1)[0]
                            try:
                                template_data = json.loads(template_block)
                                # Save to DB
                                template_id = save_generated_template(db, current_user.id, template_data)
                                
                                # Generate Link
                                link_text = f"\n\n✨ **New Workout Created!**\n[View {template_data.get('name', 'Workout')}]({os.environ.get('VITE_APP_URL', '')}/templates/{template_id})"
                                
                                yield f"data: {json.dumps({'type': 'content', 'text': link_text})}\n\n"
                                
                                # Consume the template block
                                content_buffer += start_marker + template_block + end_marker

                            except json.JSONDecodeError:
                                yield f"data: {json.dumps({'type': 'content', 'text': '\n*(Error parsing generated template)*'})}\n\n"
                                content_buffer += start_marker + template_block + end_marker

                        else:
                            # Template started but not finished.
                            # Yield pre-template stuff if we haven't
                            pre_temp_unproc = unprocessed.split(start_marker, 1)[0]
                            if pre_temp_unproc:
                                yield f"data: {json.dumps({'type': 'content', 'text': pre_temp_unproc})}\n\n"
                                content_buffer += pre_temp_unproc
                            # Wait for end marker

                    else:
                        # Normal content
                        if unprocessed:
                            yield f"data: {json.dumps({'type': 'content', 'text': unprocessed})}\n\n"
                            content_buffer += unprocessed

            # --- Post-loop: final template extraction from full_content ---
            # The inline parser may miss tags split across streaming tokens.
            # Do a final check on the complete accumulated text.
            start_marker = "<workout_template>"
            end_marker = "</workout_template>"
            template_saved = False
            
            if start_marker in full_content and end_marker in full_content:
                try:
                    template_block = full_content.split(start_marker, 1)[1].split(end_marker, 1)[0]
                    template_data = json.loads(template_block)
                    template_id = save_generated_template(db, current_user.id, template_data)
                    if template_id:
                        template_saved = True
                        link_text = f"\n\n✨ **Workout Template Saved!**\n[View {template_data.get('name', 'Workout')}]({os.environ.get('VITE_APP_URL', '')}/templates/{template_id})"
                        yield f"data: {json.dumps({'type': 'content', 'text': link_text})}\n\n"
                        print(f"[post-loop] Template saved with ID {template_id}")
                except (json.JSONDecodeError, IndexError) as ex:
                    print(f"[post-loop] Template parse error: {ex}")
            
            # Fallback: if no template saved and the text describes a workout, extract via LLM
            if not template_saved and request.model_source == "web":
                workout_keywords = any(kw in full_content.lower() for kw in [
                    "sets", "reps", "bench press", "squat", "deadlift",
                    "push-up", "pull-up", "overhead press", "curl", "row"
                ])
                if workout_keywords:
                    print("[post-process] LLM described a workout but no template saved. Extracting...")
                    yield f"data: {json.dumps({'type': 'content', 'text': chr(10) + chr(10) + '⏳ *Saving workout template...*'})}\n\n"
                    
                    try:
                        extraction_prompt = [
                            {"role": "system", "content": (
                                "Extract the workout plan from the text below into this exact JSON format. "
                                "Return ONLY the JSON, no explanation:\n"
                                '{"name": "...", "exercises": [{"name": "...", "category": "Push|Pull|Legs|Core|Cardio", '
                                '"sets": [{"goal_weight": 0, "goal_reps": 10}]}]}'
                            )},
                            {"role": "user", "content": full_content}
                        ]
                        
                        extract_url = "https://text.pollinations.ai/openai/chat/completions"
                        extract_payload = {
                            "messages": extraction_prompt,
                            "model": "openai",
                            "stream": False,
                        }
                        
                        async with httpx.AsyncClient() as extract_client:
                            extract_resp = await extract_client.post(
                                extract_url, json=extract_payload,
                                headers={"Content-Type": "application/json"},
                                timeout=30.0
                            )
                            if extract_resp.status_code == 200:
                                extract_data = extract_resp.json()
                                raw_json = extract_data["choices"][0]["message"]["content"]
                                
                                cleaned = raw_json.strip()
                                if cleaned.startswith("```"):
                                    cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
                                    if cleaned.endswith("```"):
                                        cleaned = cleaned[:-3].strip()
                                
                                template_data = json.loads(cleaned)
                                template_id = save_generated_template(db, current_user.id, template_data)
                                
                                if template_id:
                                    link_text = f"\n\n✨ **Workout Template Saved!**\n[View {template_data.get('name', 'Workout')}]({os.environ.get('VITE_APP_URL', '')}/templates/{template_id})"
                                    yield f"data: {json.dumps({'type': 'content', 'text': link_text})}\n\n"
                                    print(f"[post-process] Template saved with ID {template_id}")
                                else:
                                    yield f"data: {json.dumps({'type': 'content', 'text': chr(10) + '*(Could not save template)*'})}\n\n"
                            else:
                                print(f"[post-process] Extraction API error: {extract_resp.status_code}")
                    except Exception as ex:
                        print(f"[post-process] Extraction failed: {ex}")
                        import traceback
                        traceback.print_exc()
            
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

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText
from deps import db, get_current_user, sanitize_picture, send_push_notification
from datetime import datetime, timezone, timedelta
import uuid
import json
import os
import logging
import tempfile

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_family_context(user):
    """Gather comprehensive family data for Pixie's context."""
    family_id = user.get('current_family_id') or user.get('parent_id', user['user_id'])
    user_id = user['user_id']
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")

    # Get family members (from memberships + legacy)
    membership_ids = set()
    memberships = await db.family_memberships.find({"family_id": family_id}, {"_id": 0, "user_id": 1}).to_list(50)
    for m in memberships:
        membership_ids.add(m['user_id'])
    legacy = await db.family_memberships.find({"family_id": user.get('parent_id', user['user_id'])}, {"_id": 0, "user_id": 1}).to_list(50)
    for m in legacy:
        membership_ids.add(m['user_id'])

    q = [{"family_id": family_id}, {"parent_id": family_id}, {"user_id": family_id}]
    if membership_ids:
        q.append({"user_id": {"$in": list(membership_ids)}})
    members_raw = await db.users.find({"$or": q}, {"_id": 0, "password_hash": 0, "pin": 0, "picture": 0}).to_list(50)
    seen = set()
    members = []
    for m in members_raw:
        if m['user_id'] not in seen and m.get('role') != 'homehub':
            seen.add(m['user_id'])
            members.append({"user_id": m['user_id'], "name": m.get('nickname') or m.get('name'), "role": m.get('role')})

    parent_id = user.get('parent_id', user['user_id'])

    # Today's chores
    chores = await db.chores.find(
        {"$or": [{"family_id": parent_id}, {"family_id": family_id}], "scheduled_date": today},
        {"_id": 0, "chore_id": 1, "title": 1, "assigned_to": 1, "status": 1, "points": 1}
    ).to_list(100)
    member_map = {m['user_id']: m['name'] for m in members}
    for c in chores:
        c['assignee_name'] = member_map.get(c.get('assigned_to'), 'Unassigned')

    # Today + tomorrow events
    events = await db.events.find(
        {"family_id": parent_id, "event_date": {"$in": [today, tomorrow]}},
        {"_id": 0, "event_id": 1, "title": 1, "event_date": 1, "event_time": 1, "event_type": 1, "status": 1}
    ).sort("event_date", 1).to_list(50)

    # Shopping list
    shopping = await db.shopping_items.find(
        {}, {"_id": 0, "item_id": 1, "name": 1, "status": 1, "requested_by_name": 1}
    ).to_list(100)

    # Pantry items
    pantry = await db.pantry.find(
        {"family_id": parent_id}, {"_id": 0, "item_id": 1, "name": 1, "category": 1, "quantity": 1, "unit": 1, "low_stock": 1, "expiration_date": 1}
    ).to_list(200)

    # Recent messages (last 10)
    messages = await db.messages.find(
        {}, {"_id": 0, "message_id": 1, "user_name": 1, "content": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(10)

    # Recent wall posts (last 5)
    wall_posts = await db.family_wall.find(
        {}, {"_id": 0, "post_id": 1, "author_name": 1, "content": 1, "type": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(5)

    # Pending approvals (for parents)
    pending_chores = []
    pending_shopping = []
    if user.get('role') == 'parent':
        pending_chores = await db.chores.find(
            {"$or": [{"family_id": parent_id}, {"family_id": family_id}], "status": "completed"},
            {"_id": 0, "chore_id": 1, "title": 1, "completed_by": 1}
        ).to_list(20)
        for pc in pending_chores:
            pc['completed_by_name'] = member_map.get(pc.get('completed_by'), 'Unknown')
        pending_shopping = await db.shopping_items.find(
            {"status": "pending"},
            {"_id": 0, "item_id": 1, "name": 1, "requested_by_name": 1}
        ).to_list(20)

    # Routines
    routines = await db.routines.find(
        {"family_id": parent_id, "active": True},
        {"_id": 0, "routine_id": 1, "title": 1, "time_of_day": 1, "assigned_to": 1}
    ).to_list(50)
    for r in routines:
        r['assignee_name'] = member_map.get(r.get('assigned_to'), 'Everyone')

    return {
        "members": members,
        "chores_today": chores,
        "events_today_tomorrow": events,
        "shopping_list": shopping,
        "pantry_items": pantry,
        "recent_messages": messages,
        "recent_wall_posts": wall_posts,
        "pending_chore_approvals": pending_chores,
        "pending_shopping_approvals": pending_shopping,
        "routines": routines,
        "today": today,
        "tomorrow": tomorrow
    }


def build_system_prompt(user, context, mode="normal"):
    user_name = user.get('nickname') or user.get('name', 'Friend')
    user_role = user.get('role', 'child')
    members_str = ", ".join([f"{m['name']} ({m['role']})" for m in context['members']])

    chores_str = json.dumps(context['chores_today'], default=str) if context['chores_today'] else "No chores scheduled today"
    events_str = json.dumps(context['events_today_tomorrow'], default=str) if context['events_today_tomorrow'] else "No events today/tomorrow"
    shopping_str = json.dumps(context['shopping_list'], default=str) if context['shopping_list'] else "Shopping list is empty"
    pantry_str = json.dumps(context['pantry_items'], default=str) if context['pantry_items'] else "Pantry is empty"
    messages_str = json.dumps(context['recent_messages'], default=str) if context['recent_messages'] else "No recent messages"
    wall_str = json.dumps(context['recent_wall_posts'], default=str) if context['recent_wall_posts'] else "No recent posts"
    routines_str = json.dumps(context['routines'], default=str) if context['routines'] else "No active routines"

    pending_str = ""
    if user_role == 'parent':
        pending_str = f"""
PENDING APPROVALS (parent only):
- Chores waiting approval: {json.dumps(context['pending_chore_approvals'], default=str) if context['pending_chore_approvals'] else 'None'}
- Shopping items waiting approval: {json.dumps(context['pending_shopping_approvals'], default=str) if context['pending_shopping_approvals'] else 'None'}"""

    hub_instructions = ""
    if mode == "homehub":
        hub_instructions = """
HOMEHUB MODE: This device is the shared Family Home Hub. For ANY action that modifies data (adding items, completing chores, sending messages, etc.), you MUST:
1. Ask which family member is making this request
2. Ask them to verify with their PIN
3. Include in your action: "needs_pin": true, "ask_who": "Which family member is making this request?"
DO NOT execute write actions without identifying the user first."""

    permission_note = ""
    if user_role == 'child':
        permission_note = """
PERMISSIONS (child): You can read all data. You can mark your own chores as complete, send messages, and post to the wall. You CANNOT approve/deny anything, create chores, or send reminders. Shopping items you add will be submitted for parent approval."""
    elif user_role == 'parent':
        permission_note = """
PERMISSIONS (parent): Full access. Can approve/deny chores and shopping items, send reminders to the family, create events, and moderate content."""

    return f"""You are Pixie, the smart and friendly AI assistant for the FamFocus Hub family app.
You're talking to {user_name} ({user_role}).
Family members: {members_str}
{hub_instructions}
{permission_note}

CURRENT APP DATA:
Today: {context['today']}

CHORES TODAY:
{chores_str}

CALENDAR (today/tomorrow):
{events_str}

SHOPPING LIST:
{shopping_str}

PANTRY INVENTORY:
{pantry_str}

RECENT CHAT (newest first):
{messages_str}

FAMILY WALL (newest first):
{wall_str}

ROUTINES:
{routines_str}
{pending_str}

RESPONSE FORMAT: You MUST respond with valid JSON only. No markdown, no extra text. Structure:
{{
  "response": "Your conversational response to the user (keep concise, warm, helpful)",
  "actions": [
    {{
      "type": "action_type",
      "params": {{}}
    }}
  ]
}}

AVAILABLE ACTIONS (use "actions" array, can be empty if just answering a question):
- {{"type": "add_shopping_item", "params": {{"name": "item name"}}}}
- {{"type": "add_calendar_event", "params": {{"title": "event title", "event_date": "YYYY-MM-DD", "event_time": "HH:MM", "event_type": "appointment|activity|reminder"}}}}
- {{"type": "post_to_wall", "params": {{"content": "post text"}}}}
- {{"type": "send_message", "params": {{"content": "message text"}}}}
- {{"type": "complete_chore", "params": {{"chore_id": "id"}}}}
- {{"type": "approve_chore", "params": {{"chore_id": "id", "approved": true/false}}}} (parent only)
- {{"type": "approve_shopping", "params": {{"item_id": "id", "approved": true/false}}}} (parent only)
- {{"type": "send_reminder", "params": {{"message": "reminder text", "recipients": "all" or ["user_id1"]}}}} (parent only)
- {{"type": "add_pantry_item", "params": {{"name": "item", "category": "fridge|freezer|shelf|produce|other", "quantity": "amount"}}}}

If the user asks a question you can answer from the data (like "what's for dinner" or "did everyone finish chores"), just respond with info - no action needed.
If the user's request is unclear, ask for clarification in your response.
Keep responses concise and family-friendly. Use the user's name occasionally."""


async def execute_actions(actions, user, family_context):
    """Execute Pixie's planned actions and return results."""
    results = []
    parent_id = user.get('parent_id', user['user_id'])
    family_id = user.get('current_family_id') or parent_id

    for action in actions:
        a_type = action.get('type')
        params = action.get('params', {})

        try:
            if a_type == 'add_shopping_item':
                item_id = f"item_{uuid.uuid4().hex[:12]}"
                is_parent = user['role'] == 'parent'
                doc = {
                    "item_id": item_id,
                    "family_id": parent_id,
                    "name": params.get('name', ''),
                    "requested_by": user['user_id'],
                    "requested_by_name": user.get('nickname') or user.get('name'),
                    "status": "approved" if is_parent else "pending",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.shopping_items.insert_one(doc)
                results.append({"type": a_type, "success": True, "item": params.get('name'), "status": doc['status']})

            elif a_type == 'add_calendar_event':
                event_id = f"event_{uuid.uuid4().hex[:12]}"
                is_parent = user['role'] == 'parent'
                doc = {
                    "event_id": event_id,
                    "family_id": parent_id,
                    "title": params.get('title', ''),
                    "event_date": params.get('event_date', ''),
                    "event_time": params.get('event_time'),
                    "event_type": params.get('event_type', 'appointment'),
                    "created_by": user['user_id'],
                    "created_by_name": user.get('nickname') or user.get('name'),
                    "status": "approved" if is_parent else "pending",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.events.insert_one(doc)
                results.append({"type": a_type, "success": True, "event": params.get('title')})

            elif a_type == 'post_to_wall':
                post_id = f"post_{uuid.uuid4().hex[:12]}"
                author_name = user.get('nickname') or user.get('name', 'Pixie User')
                doc = {
                    "post_id": post_id,
                    "family_id": parent_id,
                    "author_id": user['user_id'],
                    "author_name": author_name,
                    "author_picture": sanitize_picture(user.get('picture'), fallback_name=author_name),
                    "content": params.get('content', ''),
                    "type": "text",
                    "likes_count": 0, "liked_by": [], "comments_count": 0,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.family_wall.insert_one(doc)
                results.append({"type": a_type, "success": True})

            elif a_type == 'send_message':
                msg_id = f"msg_{uuid.uuid4().hex[:12]}"
                sender_name = user.get('nickname') or user.get('name', 'Pixie User')
                doc = {
                    "message_id": msg_id,
                    "family_id": parent_id,
                    "user_id": user['user_id'],
                    "user_name": sender_name,
                    "user_picture": sanitize_picture(user.get('picture'), fallback_name=sender_name),
                    "content": params.get('content', ''),
                    "read_by": [user['user_id']],
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.messages.insert_one(doc)
                results.append({"type": a_type, "success": True, "message": params.get('content', '')[:50]})

            elif a_type == 'complete_chore':
                chore_id = params.get('chore_id')
                chore = await db.chores.find_one({"chore_id": chore_id})
                if chore:
                    update = {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat(), "completed_by": user['user_id']}
                    if user['role'] == 'parent':
                        update["status"] = "approved"
                        update["approved_at"] = datetime.now(timezone.utc).isoformat()
                    await db.chores.update_one({"chore_id": chore_id}, {"$set": update})
                    results.append({"type": a_type, "success": True, "chore": chore.get('title')})
                else:
                    results.append({"type": a_type, "success": False, "error": "Chore not found"})

            elif a_type == 'approve_chore':
                if user['role'] != 'parent':
                    results.append({"type": a_type, "success": False, "error": "Only parents can approve"})
                    continue
                chore_id = params.get('chore_id')
                approved = params.get('approved', True)
                new_status = "approved" if approved else "pending"
                await db.chores.update_one({"chore_id": chore_id}, {"$set": {"status": new_status, "approved_at": datetime.now(timezone.utc).isoformat()}})
                results.append({"type": a_type, "success": True, "approved": approved})

            elif a_type == 'approve_shopping':
                if user['role'] != 'parent':
                    results.append({"type": a_type, "success": False, "error": "Only parents can approve"})
                    continue
                item_id = params.get('item_id')
                approved = params.get('approved', True)
                new_status = "approved" if approved else "rejected"
                await db.shopping_items.update_one({"item_id": item_id}, {"$set": {"status": new_status}})
                results.append({"type": a_type, "success": True, "approved": approved})

            elif a_type == 'send_reminder':
                if user['role'] != 'parent':
                    results.append({"type": a_type, "success": False, "error": "Only parents can send reminders"})
                    continue
                msg = params.get('message', 'Reminder from Pixie')
                recipients = params.get('recipients', 'all')
                member_ids = []
                if recipients == 'all':
                    member_ids = [m['user_id'] for m in family_context['members'] if m['user_id'] != user['user_id']]
                elif isinstance(recipients, list):
                    member_ids = recipients

                for mid in member_ids:
                    await send_push_notification(mid, "Family Reminder", msg)
                results.append({"type": a_type, "success": True, "sent_to": len(member_ids)})

            elif a_type == 'add_pantry_item':
                item_id = f"pantry_{uuid.uuid4().hex[:12]}"
                doc = {
                    "item_id": item_id,
                    "family_id": parent_id,
                    "name": params.get('name', ''),
                    "category": params.get('category', 'shelf'),
                    "quantity": params.get('quantity', ''),
                    "unit": params.get('unit', ''),
                    "low_stock": False,
                    "added_by": user['user_id'],
                    "added_by_name": user.get('nickname') or user.get('name'),
                    "source": "pixie",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.pantry.insert_one(doc)
                results.append({"type": a_type, "success": True, "item": params.get('name')})

        except Exception as e:
            logger.error(f"Pixie action {a_type} failed: {e}")
            results.append({"type": a_type, "success": False, "error": str(e)[:100]})

    return results


@router.post("/pixie/command")
async def pixie_command(request: Request, data: dict):
    """Main Pixie command endpoint - understands natural language, reads app data, executes actions."""
    current_user = await get_current_user(request)
    message = data.get('message', '')
    context_history = data.get('context', [])
    mode = data.get('mode', 'normal')

    if not message.strip():
        raise HTTPException(status_code=400, detail="Message required")

    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    # For HomeHub PIN verification flow
    acting_user = current_user
    if mode == 'homehub' and data.get('acting_user_id'):
        resolved = await db.users.find_one({"user_id": data['acting_user_id']}, {"_id": 0, "password_hash": 0})
        if resolved:
            # Verify PIN
            pin = data.get('acting_user_pin', '')
            if str(resolved.get('pin', '')) != str(pin):
                return {"response": "That PIN doesn't match. Please try again.", "actions_taken": [], "needs_pin": True}
            acting_user = resolved

    # Gather family context
    family_ctx = await get_family_context(acting_user)
    system_prompt = build_system_prompt(acting_user, family_ctx, mode)

    # Build conversation history
    history_str = ""
    if context_history:
        items = []
        for h in context_history[-4:]:
            role = 'User' if h.get('role') == 'user' else 'Pixie'
            items.append(f"{role}: {h.get('content', '')}")
        history_str = "\n".join(items)

    history_prefix = ""
    if history_str:
        history_prefix = "Previous conversation:\n" + history_str + "\n\n"
    prompt = f"""{history_prefix}User: {message}

Remember: respond with ONLY valid JSON. No markdown backticks."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"pixie_cmd_{uuid.uuid4().hex[:8]}",
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")

        raw_response = await chat.send_message(UserMessage(text=prompt))

        # Parse JSON response
        response_text = raw_response.strip()
        if response_text.startswith('```'):
            response_text = response_text.split('\n', 1)[1]
            if response_text.endswith('```'):
                response_text = response_text[:-3].strip()

        parsed = json.loads(response_text)
        pixie_text = parsed.get('response', 'Sorry, I had trouble understanding that.')
        actions = parsed.get('actions', [])

        # Check if HomeHub mode needs user identification
        if mode == 'homehub' and actions and not data.get('acting_user_id'):
            needs_pin = any(a.get('needs_pin') for a in actions)
            if not needs_pin and actions:
                needs_pin = True
            if needs_pin:
                return {
                    "response": pixie_text,
                    "actions_planned": actions,
                    "needs_pin": True,
                    "needs_user_selection": True,
                    "family_members": [{"user_id": m['user_id'], "name": m['name'], "role": m['role']} for m in family_ctx['members']],
                    "actions_taken": []
                }

        # Execute actions
        action_results = await execute_actions(actions, acting_user, family_ctx) if actions else []

        return {
            "response": pixie_text,
            "actions_taken": action_results,
            "needs_pin": False
        }

    except json.JSONDecodeError:
        # If AI didn't return valid JSON, just use the raw text as response
        return {"response": raw_response.strip() if raw_response else "I'm not sure how to help with that.", "actions_taken": []}
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Pixie command error: {error_msg}")
        if 'balance' in error_msg.lower() or 'credit' in error_msg.lower():
            return {"response": "My AI credits are running low! Ask a parent to go to Profile > Universal Key > Add Balance.", "actions_taken": []}
        return {"response": "Oops! I had a little hiccup. Can you try again?", "actions_taken": []}


@router.post("/pixie/voice-command")
async def pixie_voice_command(request: Request, audio: UploadFile = File(...), context: str = Form(default="[]"), mode: str = Form(default="normal")):
    """Voice command for Pixie: transcribe audio then process as command."""
    current_user = await get_current_user(request)

    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    # Step 1: Transcribe
    try:
        stt = OpenAISpeechToText(api_key=api_key)
        audio_bytes = await audio.read()

        suffix = ".webm"
        if audio.content_type:
            ext_map = {"audio/webm": ".webm", "audio/wav": ".wav", "audio/mp3": ".mp3", "audio/mpeg": ".mp3", "audio/ogg": ".webm", "audio/m4a": ".m4a"}
            suffix = ext_map.get(audio.content_type, ".webm")

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        with open(tmp_path, "rb") as audio_file:
            stt_response = await stt.transcribe(file=audio_file, model="whisper-1", response_format="json", language="en")

        os.unlink(tmp_path)
        transcribed = stt_response.text if hasattr(stt_response, 'text') else str(stt_response)

        if not transcribed.strip():
            return {"transcription": "", "response": "I couldn't hear anything. Could you try again?", "actions_taken": [], "success": True}

    except Exception as e:
        logger.error(f"Voice transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    # Step 2: Process as command
    try:
        ctx = json.loads(context) if context else []
    except Exception:
        ctx = []

    # Reuse the command endpoint logic
    cmd_data = {"message": transcribed, "context": ctx, "mode": mode}

    # Gather family context
    family_ctx = await get_family_context(current_user)
    system_prompt = build_system_prompt(current_user, family_ctx, mode)

    history_str = ""
    if ctx:
        items = []
        for h in ctx[-4:]:
            role = 'User' if h.get('role') == 'user' else 'Pixie'
            items.append(f"{role}: {h.get('content', '')}")
        history_str = "\n".join(items)

    voice_prefix = ""
    if history_str:
        voice_prefix = "Previous conversation:\n" + history_str + "\n\n"
    prompt = f"""{voice_prefix}User (via voice): {transcribed}

Remember: respond with ONLY valid JSON. No markdown backticks."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"pixie_voice_{uuid.uuid4().hex[:8]}",
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")

        raw_response = await chat.send_message(UserMessage(text=prompt))

        response_text = raw_response.strip()
        if response_text.startswith('```'):
            response_text = response_text.split('\n', 1)[1]
            if response_text.endswith('```'):
                response_text = response_text[:-3].strip()

        parsed = json.loads(response_text)
        pixie_text = parsed.get('response', 'Sorry, I had trouble understanding that.')
        actions = parsed.get('actions', [])

        if mode == 'homehub' and actions:
            return {
                "transcription": transcribed,
                "response": pixie_text,
                "actions_planned": actions,
                "needs_pin": True,
                "needs_user_selection": True,
                "family_members": [{"user_id": m['user_id'], "name": m['name'], "role": m['role']} for m in family_ctx['members']],
                "actions_taken": [],
                "success": True
            }

        action_results = await execute_actions(actions, current_user, family_ctx) if actions else []
        return {"transcription": transcribed, "response": pixie_text, "actions_taken": action_results, "success": True}

    except json.JSONDecodeError:
        return {"transcription": transcribed, "response": raw_response.strip() if raw_response else "I didn't understand that.", "actions_taken": [], "success": True}
    except Exception as e:
        logger.error(f"Pixie voice command error: {e}")
        return {"transcription": transcribed, "response": "Oops! Something went wrong. Try again?", "actions_taken": [], "success": True}

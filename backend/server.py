from fastapi import FastAPI, WebSocket, WebSocketDisconnect, APIRouter
from starlette.middleware.cors import CORSMiddleware
from deps import db, client, get_current_user, ensure_indexes
from datetime import datetime, timezone
from typing import Dict, List
import os
import uuid
import logging

# Import all routers
from routers.auth import router as auth_router
from routers.family import router as family_router
from routers.users import router as users_router
from routers.chores import router as chores_router
from routers.shopping import router as shopping_router
from routers.wall import router as wall_router
from routers.messages import router as messages_router
from routers.calendar_routes import router as calendar_router
from routers.reading import router as reading_router
from routers.food import router as food_router
from routers.ai import router as ai_router
from routers.rewards import router as rewards_router
from routers.location import router as location_router
from routers.notifications import router as notifications_router
from routers.weather import router as weather_router
from routers.gifs import router as gifs_router
from routers.achievements import router as achievements_router
from routers.misc import router as misc_router

app = FastAPI()

# Main API router with /api prefix
api_router = APIRouter(prefix="/api")

# Health check
@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "famfocus-api"
    }

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(family_router)
api_router.include_router(users_router)
api_router.include_router(chores_router)
api_router.include_router(shopping_router)
api_router.include_router(wall_router)
api_router.include_router(messages_router)
api_router.include_router(calendar_router)
api_router.include_router(reading_router)
api_router.include_router(food_router)
api_router.include_router(ai_router)
api_router.include_router(rewards_router)
api_router.include_router(location_router)
api_router.include_router(notifications_router)
api_router.include_router(weather_router)
api_router.include_router(gifs_router)
api_router.include_router(achievements_router)
api_router.include_router(misc_router)


# ============ WebSocket Chat ============

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.user_connections: Dict[str, WebSocket] = {}
        self.typing_users: Dict[str, set] = {}

    async def connect(self, websocket: WebSocket, user_id: str, family_id: str):
        await websocket.accept()
        if family_id not in self.active_connections:
            self.active_connections[family_id] = []
        self.active_connections[family_id].append(websocket)
        self.user_connections[user_id] = websocket
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"online_status": True, "last_seen": datetime.now(timezone.utc).isoformat()}}
        )
        await self.broadcast_status(family_id, user_id, "online")

    def disconnect(self, websocket: WebSocket, user_id: str, family_id: str):
        if family_id in self.active_connections:
            if websocket in self.active_connections[family_id]:
                self.active_connections[family_id].remove(websocket)
        if user_id in self.user_connections:
            del self.user_connections[user_id]

    async def broadcast_message(self, family_id: str, message: dict):
        if family_id in self.active_connections:
            for connection in self.active_connections[family_id]:
                try:
                    await connection.send_json({"type": "message", "data": message})
                except:
                    pass

    async def broadcast_typing(self, family_id: str, user_id: str, user_name: str, is_typing: bool):
        if family_id not in self.typing_users:
            self.typing_users[family_id] = set()
        if is_typing:
            self.typing_users[family_id].add(user_id)
        else:
            self.typing_users[family_id].discard(user_id)
        if family_id in self.active_connections:
            for connection in self.active_connections[family_id]:
                try:
                    await connection.send_json({
                        "type": "typing",
                        "data": {"user_id": user_id, "user_name": user_name, "is_typing": is_typing}
                    })
                except:
                    pass

    async def broadcast_status(self, family_id: str, user_id: str, status: str):
        if family_id in self.active_connections:
            for connection in self.active_connections[family_id]:
                try:
                    await connection.send_json({
                        "type": "status",
                        "data": {"user_id": user_id, "status": status}
                    })
                except:
                    pass

manager = ConnectionManager()

@app.websocket("/api/ws/chat/{session_token}")
async def websocket_chat(websocket: WebSocket, session_token: str):
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        await websocket.close(code=4001)
        return
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        await websocket.close(code=4001)
        return
    family_id = user.get('parent_id', user['user_id'])
    user_id = user['user_id']
    await manager.connect(websocket, user_id, family_id)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "message":
                message_id = f"msg_{uuid.uuid4().hex[:12]}"
                message_doc = {
                    "message_id": message_id,
                    "family_id": family_id,
                    "user_id": user_id,
                    "user_name": user['name'],
                    "user_picture": user.get('picture'),
                    "content": data.get("content", ""),
                    "media_url": data.get("media_url"),
                    "media_type": data.get("media_type"),
                    "read_by": [user_id],
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.messages.insert_one(message_doc)
                await manager.broadcast_message(family_id, message_doc)
            elif data.get("type") == "typing":
                await manager.broadcast_typing(
                    family_id, user_id, user['name'], data.get("is_typing", False)
                )
            elif data.get("type") == "read":
                message_ids = data.get("message_ids", [])
                for msg_id in message_ids:
                    await db.messages.update_one(
                        {"message_id": msg_id},
                        {"$addToSet": {"read_by": user_id}}
                    )
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.now(timezone.utc).isoformat()})
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id, family_id)
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"online_status": False, "last_seen": datetime.now(timezone.utc).isoformat()}}
        )
        await manager.broadcast_status(family_id, user_id, "offline")


# Include API router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    await ensure_indexes()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

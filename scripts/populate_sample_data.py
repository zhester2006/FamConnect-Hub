#!/usr/bin/env python3
"""
Sample data script for FamilyHub
Populates MongoDB with realistic family data for preview/demo
"""

from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from datetime import datetime, timezone, timedelta
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

async def populate_sample_data():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🧹 Cleaning existing data...")
    await db.users.delete_many({})
    await db.user_sessions.delete_many({})
    await db.chores.delete_many({})
    await db.shopping_items.delete_many({})
    await db.family_wall.delete_many({})
    await db.messages.delete_many({})
    await db.events.delete_many({})
    await db.reading_logs.delete_many({})
    await db.rewards.delete_many({})
    await db.daily_quotes.delete_many({})
    await db.checkins.delete_many({})
    
    print("👥 Creating family members...")
    
    # Parent 1 (Main)
    parent1 = {
        "user_id": "user_parent001",
        "email": "parent@familyhub.demo",
        "name": "Sarah Johnson",
        "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
        "role": "parent",
        "points": 0,
        "badges": [],
        "settings": {"theme": "cosmic_explorer", "notifications_enabled": True},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "online_status": True,
        "last_seen": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(parent1)
    
    # Parent 2
    parent2 = {
        "user_id": "user_parent002",
        "email": "dad@familyhub.demo",
        "name": "Mike Johnson",
        "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
        "role": "parent",
        "points": 0,
        "badges": [],
        "settings": {"theme": "cosmic_explorer", "notifications_enabled": True},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "online_status": True,
        "last_seen": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(parent2)
    
    # Member (Grandma)
    member1 = {
        "user_id": "user_member001",
        "email": "grandma@familyhub.demo",
        "name": "Emma Wilson",
        "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
        "role": "member",
        "parent_id": "user_parent001",
        "points": 0,
        "badges": [],
        "settings": {"theme": "ocean_breeze", "notifications_enabled": True},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "online_status": False,
        "last_seen": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    }
    await db.users.insert_one(member1)
    
    # Child 1 (Top performer)
    child1 = {
        "user_id": "user_child001",
        "email": "child1@family.local",
        "name": "Alex Johnson",
        "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
        "role": "child",
        "parent_id": "user_parent001",
        "points": 250,
        "badges": ["early_bird", "star_performer", "reading_champion"],
        "settings": {"theme": "cosmic_explorer", "notifications_enabled": True, "excluded_chores": []},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "online_status": True,
        "last_seen": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(child1)
    
    # Child 2
    child2 = {
        "user_id": "user_child002",
        "email": "child2@family.local",
        "name": "Lily Johnson",
        "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Lily",
        "role": "child",
        "parent_id": "user_parent001",
        "points": 180,
        "badges": ["helpful_hand", "team_player"],
        "settings": {"theme": "candy_pop", "notifications_enabled": True, "excluded_chores": []},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "online_status": True,
        "last_seen": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(child2)
    
    # Child 3
    child3 = {
        "user_id": "user_child003",
        "email": "child3@family.local",
        "name": "Max Johnson",
        "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Max",
        "role": "child",
        "parent_id": "user_parent001",
        "points": 95,
        "badges": ["newcomer"],
        "settings": {"theme": "neon_nights", "notifications_enabled": True, "excluded_chores": []},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "online_status": False,
        "last_seen": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    }
    await db.users.insert_one(child3)
    
    print("📋 Creating chores...")
    today = datetime.now(timezone.utc).date()
    chores_data = [
        # Today's chores
        {"title": "Clean your room", "assigned_to": "user_child001", "date_offset": 0, "points": 15, "status": "approved"},
        {"title": "Do the dishes", "assigned_to": "user_child002", "date_offset": 0, "points": 10, "status": "completed"},
        {"title": "Take out trash", "assigned_to": "user_child003", "date_offset": 0, "points": 10, "status": "pending"},
        {"title": "Feed the dog", "assigned_to": "user_child001", "date_offset": 0, "points": 5, "status": "pending"},
        
        # Tomorrow
        {"title": "Vacuum living room", "assigned_to": "user_child002", "date_offset": 1, "points": 20, "status": "pending"},
        {"title": "Water plants", "assigned_to": "user_child001", "date_offset": 1, "points": 10, "status": "pending"},
        {"title": "Organize toys", "assigned_to": "user_child003", "date_offset": 1, "points": 15, "status": "pending"},
    ]
    
    for chore_data in chores_data:
        chore_date = (today + timedelta(days=chore_data["date_offset"])).isoformat()
        chore = {
            "chore_id": f"chore_{chore_data['title'][:5]}_{chore_data['assigned_to'][-3:]}",
            "family_id": "user_parent001",
            "title": chore_data["title"],
            "description": f"Please complete {chore_data['title'].lower()} today",
            "assigned_to": chore_data["assigned_to"],
            "scheduled_date": chore_date,
            "points": chore_data["points"],
            "status": chore_data["status"],
            "created_by": "user_parent001",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "recurring": True
        }
        if chore_data["status"] in ["completed", "approved"]:
            chore["completed_at"] = datetime.now(timezone.utc).isoformat()
            chore["completed_by"] = chore_data["assigned_to"]
        await db.chores.insert_one(chore)
    
    print("🛒 Creating shopping list...")
    shopping_items = [
        {"name": "Milk", "status": "approved", "requested_by": "user_parent001"},
        {"name": "Bread", "status": "approved", "requested_by": "user_parent001"},
        {"name": "New soccer ball", "status": "pending", "requested_by": "user_child001"},
        {"name": "Art supplies", "status": "approved", "requested_by": "user_child002"},
        {"name": "Video game", "status": "pending", "requested_by": "user_child003"},
        {"name": "Eggs", "status": "approved", "requested_by": "user_parent002"},
    ]
    
    for item_data in shopping_items:
        item = {
            "item_id": f"item_{item_data['name'].replace(' ', '_').lower()}",
            "family_id": "user_parent001",
            "name": item_data["name"],
            "requested_by": item_data["requested_by"],
            "status": item_data["status"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        if item_data["status"] == "approved":
            item["approved_by"] = "user_parent001"
        await db.shopping_items.insert_one(item)
    
    print("📅 Creating events...")
    events = [
        {"title": "Soccer Practice", "date_offset": 0, "event_type": "appointment"},
        {"title": "Doctor's Appointment", "date_offset": 2, "event_type": "appointment"},
        {"title": "Piano Lessons", "date_offset": 3, "event_type": "appointment"},
        {"title": "Family Movie Night", "date_offset": 5, "event_type": "appointment"},
        {"title": "Parent Work Meeting", "date_offset": 1, "event_type": "work_schedule"},
    ]
    
    for event_data in events:
        event_date = (today + timedelta(days=event_data["date_offset"])).isoformat()
        event = {
            "event_id": f"event_{event_data['title'][:5].replace(' ', '_').lower()}",
            "family_id": "user_parent001",
            "title": event_data["title"],
            "description": f"Scheduled {event_data['title']}",
            "event_date": event_date,
            "event_type": event_data["event_type"],
            "created_by": "user_parent001",
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.events.insert_one(event)
    
    print("💬 Creating messages...")
    messages = [
        {"user": "user_parent001", "name": "Sarah Johnson", "content": "Don't forget soccer practice at 4 PM today!", "time_offset": -60},
        {"user": "user_child001", "name": "Alex Johnson", "content": "Got it Mom! Can't wait!", "time_offset": -55},
        {"user": "user_child002", "name": "Lily Johnson", "content": "Can I invite Emma over this weekend?", "time_offset": -30},
        {"user": "user_parent002", "name": "Mike Johnson", "content": "Sure sweetie, let's check with her parents first", "time_offset": -25},
        {"user": "user_member001", "name": "Emma Wilson", "content": "I'll bring cookies for movie night! 🍪", "time_offset": -10},
    ]
    
    for msg_data in messages:
        msg_time = datetime.now(timezone.utc) + timedelta(minutes=msg_data["time_offset"])
        msg = {
            "message_id": f"msg_{msg_data['user'][-3:]}_{abs(msg_data['time_offset'])}",
            "family_id": "user_parent001",
            "user_id": msg_data["user"],
            "user_name": msg_data["name"],
            "content": msg_data["content"],
            "read_by": [msg_data["user"], "user_parent001"],
            "created_at": msg_time.isoformat()
        }
        await db.messages.insert_one(msg)
    
    print("📱 Creating family wall posts...")
    posts = [
        {"user": "user_parent001", "name": "Sarah Johnson", "content": "So proud of Alex for getting an A on the math test! 🌟", "time_offset": -120},
        {"user": "user_child002", "name": "Lily Johnson", "content": "Look at this drawing I made today!", "time_offset": -90},
        {"user": "user_parent002", "name": "Mike Johnson", "content": "Who wants to vote for pizza or tacos for dinner Friday?", "time_offset": -60, "type": "poll"},
        {"user": "user_member001", "name": "Emma Wilson", "content": "Missing you all! Can't wait to visit next week ❤️", "time_offset": -30},
    ]
    
    for post_data in posts:
        post_time = datetime.now(timezone.utc) + timedelta(minutes=post_data["time_offset"])
        post = {
            "post_id": f"post_{post_data['user'][-3:]}_{abs(post_data['time_offset'])}",
            "family_id": "user_parent001",
            "user_id": post_data["user"],
            "user_name": post_data["name"],
            "content": post_data["content"],
            "post_type": post_data.get("type", "text"),
            "created_at": post_time.isoformat()
        }
        await db.family_wall.insert_one(post)
    
    print("🏆 Creating rewards...")
    rewards = [
        {"name": "Extra Screen Time (30 min)", "points": 50, "desc": "Get 30 extra minutes of screen time"},
        {"name": "Choose Dinner Menu", "points": 75, "desc": "Pick what the family eats for dinner"},
        {"name": "$10 Gift Card", "points": 150, "desc": "Amazon or iTunes gift card"},
        {"name": "Sleepover with Friend", "points": 200, "desc": "Host a friend for a sleepover"},
        {"name": "New Video Game", "points": 500, "desc": "Get a new game of your choice"},
    ]
    
    for reward_data in rewards:
        reward = {
            "reward_id": f"reward_{reward_data['name'][:8].replace(' ', '_').lower()}",
            "family_id": "user_parent001",
            "name": reward_data["name"],
            "description": reward_data["desc"],
            "points_required": reward_data["points"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.rewards.insert_one(reward)
    
    print("📖 Creating reading logs...")
    reading_log = {
        "log_id": "log_001",
        "user_id": "user_child001",
        "family_id": "user_parent001",
        "book_name": "Harry Potter and the Sorcerer's Stone",
        "pages_read": 45,
        "summary": "Harry discovers he's a wizard and gets invited to Hogwarts. He meets Ron and Hermione on the train!",
        "date": datetime.now(timezone.utc).date().isoformat(),
        "status": "approved",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reading_logs.insert_one(reading_log)
    
    print("✨ Creating daily quote...")
    daily_quote = {
        "date": datetime.now(timezone.utc).date().isoformat(),
        "quote": "Family is not an important thing. It's everything. - Michael J. Fox",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.daily_quotes.insert_one(daily_quote)
    
    print("✅ Sample data created successfully!")
    print("\n🔑 Login credentials:")
    print("   Parent: parent@familyhub.demo")
    print("   Child (Alex): Use parent account to create session")
    print("\n💡 Tip: Sign in with Google and the app will use your real account")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(populate_sample_data())

"""
Comprehensive API Test Suite for FamFocus Hub - Iteration 20
Tests all major API endpoints for mobile app connectivity and data sync

Endpoints tested:
- Dev login for parent and child roles
- Family members API (/api/family/members)
- Chores CRUD operations (/api/chores)
- Tasks endpoint with claimant info (/api/tasks)
- Rewards shop and redemption (/api/rewards)
- Shopping list CRUD (/api/shopping)
- Calendar events (/api/events)
- Family Wall posts and daily quote (/api/family-wall, /api/family-wall/daily-quote)
- Leaderboard with timeframe filter (/api/leaderboard)
- Reading logs (/api/reading-logs)
- Location/Checkin endpoints (/api/checkins, /api/geofences)
- AI features - Pixie, meal suggestions, chore tips (/api/ai/*)
- Theme and user settings persistence (/api/users/*)
- Firebase auth login and signup endpoints
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        assert data['service'] == 'famfocus-api'
        print(f"✓ Health endpoint working: {data}")
    
    def test_dev_login_parent(self):
        """Test dev login with parent role"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        data = response.json()
        assert 'user' in data
        assert 'session_token' in data
        assert data['user']['role'] == 'parent'
        print(f"✓ Dev login (parent) working: user_id={data['user']['user_id']}")
        return data
    
    def test_dev_login_child(self):
        """Test dev login with child role"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        assert response.status_code == 200
        data = response.json()
        assert 'user' in data
        assert 'session_token' in data
        assert data['user']['role'] == 'child'
        print(f"✓ Dev login (child) working: user_id={data['user']['user_id']}")
        return data
    
    def test_auth_me_with_token(self):
        """Test /auth/me endpoint with valid token"""
        # First login
        login_resp = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        token = login_resp.json()['session_token']
        
        # Test auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'user_id' in data
        print(f"✓ Auth/me working: {data['name']}")
    
    def test_auth_me_without_token(self):
        """Test /auth/me endpoint without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Auth/me correctly returns 401 without token")


class TestFirebaseAuth:
    """Firebase authentication endpoint tests"""
    
    def test_firebase_login_new_user(self):
        """Test Firebase login creates new user"""
        unique_email = f"test_firebase_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/firebase-login", json={
            "user": {
                "email": unique_email,
                "displayName": "Test Firebase User",
                "uid": f"firebase_{uuid.uuid4().hex[:12]}",
                "photoURL": "https://example.com/photo.jpg"
            }
        })
        assert response.status_code == 200
        data = response.json()
        assert 'session_token' in data
        assert 'user' in data
        assert data['user']['email'] == unique_email
        print(f"✓ Firebase login (new user) working: {data['user']['email']}")
    
    def test_firebase_login_missing_email(self):
        """Test Firebase login validates required email"""
        response = requests.post(f"{BASE_URL}/api/auth/firebase-login", json={
            "user": {
                "displayName": "No Email User",
                "uid": "firebase_test"
            }
        })
        assert response.status_code == 400
        print("✓ Firebase login correctly validates email requirement")
    
    def test_firebase_signup_new_user(self):
        """Test Firebase signup creates new user"""
        unique_email = f"test_signup_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/firebase-signup", json={
            "user": {
                "email": unique_email,
                "uid": f"firebase_{uuid.uuid4().hex[:12]}"
            },
            "displayName": "Test Signup User"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'session_token' in data
        assert 'user' in data
        print(f"✓ Firebase signup working: {data['user']['email']}")


class TestFamilyMembers:
    """Family members API tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_family_members(self, parent_auth):
        """Test getting family members list"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/family/members", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'members' in data
        assert isinstance(data['members'], list)
        print(f"✓ Family members endpoint working: {len(data['members'])} members")
    
    def test_create_child_profile(self, parent_auth):
        """Test creating a child profile"""
        headers, user = parent_auth
        child_name = f"TEST_Child_{uuid.uuid4().hex[:6]}"
        response = requests.post(
            f"{BASE_URL}/api/users/child",
            headers=headers,
            json={"name": child_name}
        )
        assert response.status_code == 200
        data = response.json()
        assert data['name'] == child_name
        assert data['role'] == 'child'
        print(f"✓ Create child profile working: {data['name']}")


class TestChoresCRUD:
    """Chores CRUD operations tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    @pytest.fixture
    def child_auth(self):
        """Get child authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_chores(self, parent_auth):
        """Test getting chores list"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/chores", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'chores' in data
        print(f"✓ Get chores working: {len(data['chores'])} chores")
    
    def test_create_chore(self, parent_auth):
        """Test creating a new chore"""
        headers, user = parent_auth
        today = datetime.now().strftime("%Y-%m-%d")
        chore_data = {
            "title": f"TEST_Chore_{uuid.uuid4().hex[:6]}",
            "description": "Test chore description",
            "scheduled_date": today,
            "points": 15
        }
        response = requests.post(f"{BASE_URL}/api/chores", headers=headers, json=chore_data)
        assert response.status_code == 200
        data = response.json()
        assert data['title'] == chore_data['title']
        assert data['points'] == 15
        assert 'chore_id' in data
        print(f"✓ Create chore working: {data['chore_id']}")
        return data
    
    def test_complete_chore(self, parent_auth, child_auth):
        """Test completing a chore"""
        parent_headers, parent_user = parent_auth
        child_headers, child_user = child_auth
        
        # Create chore first
        today = datetime.now().strftime("%Y-%m-%d")
        create_resp = requests.post(
            f"{BASE_URL}/api/chores",
            headers=parent_headers,
            json={"title": f"TEST_Complete_{uuid.uuid4().hex[:6]}", "scheduled_date": today, "points": 10}
        )
        chore_id = create_resp.json()['chore_id']
        
        # Complete chore
        response = requests.put(
            f"{BASE_URL}/api/chores/{chore_id}/complete",
            headers=child_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'completed'
        print(f"✓ Complete chore working: {chore_id}")
    
    def test_approve_chore(self, parent_auth):
        """Test approving a completed chore"""
        headers, user = parent_auth
        
        # Create and complete chore
        today = datetime.now().strftime("%Y-%m-%d")
        create_resp = requests.post(
            f"{BASE_URL}/api/chores",
            headers=headers,
            json={"title": f"TEST_Approve_{uuid.uuid4().hex[:6]}", "scheduled_date": today, "points": 10}
        )
        chore_id = create_resp.json()['chore_id']
        
        # Complete it
        requests.put(f"{BASE_URL}/api/chores/{chore_id}/complete", headers=headers)
        
        # Approve it
        response = requests.put(
            f"{BASE_URL}/api/chores/{chore_id}/approve",
            headers=headers,
            json={"approved": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'approved'
        print(f"✓ Approve chore working: {chore_id}")
    
    def test_delete_chore(self, parent_auth):
        """Test deleting a chore"""
        headers, user = parent_auth
        
        # Create chore first
        today = datetime.now().strftime("%Y-%m-%d")
        create_resp = requests.post(
            f"{BASE_URL}/api/chores",
            headers=headers,
            json={"title": f"TEST_Delete_{uuid.uuid4().hex[:6]}", "scheduled_date": today, "points": 5}
        )
        chore_id = create_resp.json()['chore_id']
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/chores/{chore_id}", headers=headers)
        assert response.status_code == 200
        print(f"✓ Delete chore working: {chore_id}")
    
    def test_get_chore_types(self, parent_auth):
        """Test getting chore types"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/chores/types", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'chore_types' in data
        print(f"✓ Get chore types working: {len(data['chore_types'])} types")


class TestTasksEndpoint:
    """Tasks endpoint tests with claimant info"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_tasks(self, parent_auth):
        """Test getting tasks list"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/tasks", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'tasks' in data
        print(f"✓ Get tasks working: {len(data['tasks'])} tasks")
    
    def test_create_task(self, parent_auth):
        """Test creating a task"""
        headers, user = parent_auth
        task_data = {
            "title": f"TEST_Task_{uuid.uuid4().hex[:6]}",
            "description": "Test task description",
            "points": 20
        }
        response = requests.post(f"{BASE_URL}/api/tasks", headers=headers, json=task_data)
        assert response.status_code == 200
        data = response.json()
        # API returns {"task_id": "...", "success": true}
        assert data['success'] == True
        assert 'task_id' in data
        print(f"✓ Create task working: {data['task_id']}")


class TestRewardsShop:
    """Rewards shop and redemption tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_rewards(self, parent_auth):
        """Test getting rewards list"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/rewards", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'rewards' in data
        print(f"✓ Get rewards working: {len(data['rewards'])} rewards")
    
    def test_create_reward(self, parent_auth):
        """Test creating a reward"""
        headers, user = parent_auth
        reward_data = {
            "name": f"TEST_Reward_{uuid.uuid4().hex[:6]}",
            "description": "Test reward description",
            "points_required": 50
        }
        response = requests.post(f"{BASE_URL}/api/rewards", headers=headers, json=reward_data)
        assert response.status_code == 200
        data = response.json()
        assert data['name'] == reward_data['name']
        assert data['points_required'] == 50
        print(f"✓ Create reward working: {data['reward_id']}")
        return data
    
    def test_update_reward(self, parent_auth):
        """Test updating a reward"""
        headers, user = parent_auth
        
        # Create reward first
        create_resp = requests.post(
            f"{BASE_URL}/api/rewards",
            headers=headers,
            json={"name": f"TEST_Update_{uuid.uuid4().hex[:6]}", "points_required": 30}
        )
        reward_id = create_resp.json()['reward_id']
        
        # Update it
        response = requests.put(
            f"{BASE_URL}/api/rewards/{reward_id}",
            headers=headers,
            json={"points_required": 40}
        )
        assert response.status_code == 200
        data = response.json()
        assert data['points_required'] == 40
        print(f"✓ Update reward working: {reward_id}")
    
    def test_delete_reward(self, parent_auth):
        """Test deleting a reward"""
        headers, user = parent_auth
        
        # Create reward first
        create_resp = requests.post(
            f"{BASE_URL}/api/rewards",
            headers=headers,
            json={"name": f"TEST_Delete_{uuid.uuid4().hex[:6]}", "points_required": 25}
        )
        reward_id = create_resp.json()['reward_id']
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/rewards/{reward_id}", headers=headers)
        assert response.status_code == 200
        print(f"✓ Delete reward working: {reward_id}")
    
    def test_get_pending_redemptions(self, parent_auth):
        """Test getting pending redemptions"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/rewards/pending", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # API returns {"pending": [...]} not {"redemptions": [...]}
        assert 'pending' in data
        print(f"✓ Get pending redemptions working: {len(data['pending'])} pending")


class TestShoppingList:
    """Shopping list CRUD tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_shopping_list(self, parent_auth):
        """Test getting shopping list"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/shopping", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'items' in data
        print(f"✓ Get shopping list working: {len(data['items'])} items")
    
    def test_add_shopping_item(self, parent_auth):
        """Test adding a shopping item"""
        headers, user = parent_auth
        item_data = {"name": f"TEST_Item_{uuid.uuid4().hex[:6]}"}
        response = requests.post(f"{BASE_URL}/api/shopping", headers=headers, json=item_data)
        assert response.status_code == 200
        data = response.json()
        assert data['name'] == item_data['name']
        assert 'item_id' in data
        print(f"✓ Add shopping item working: {data['item_id']}")
        return data
    
    def test_update_shopping_item(self, parent_auth):
        """Test updating a shopping item"""
        headers, user = parent_auth
        
        # Create item first
        create_resp = requests.post(
            f"{BASE_URL}/api/shopping",
            headers=headers,
            json={"name": f"TEST_Update_{uuid.uuid4().hex[:6]}"}
        )
        item_id = create_resp.json()['item_id']
        
        # Update it
        response = requests.put(
            f"{BASE_URL}/api/shopping/{item_id}",
            headers=headers,
            json={"status": "purchased"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'purchased'
        print(f"✓ Update shopping item working: {item_id}")
    
    def test_delete_shopping_item(self, parent_auth):
        """Test deleting a shopping item"""
        headers, user = parent_auth
        
        # Create item first
        create_resp = requests.post(
            f"{BASE_URL}/api/shopping",
            headers=headers,
            json={"name": f"TEST_Delete_{uuid.uuid4().hex[:6]}"}
        )
        item_id = create_resp.json()['item_id']
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/shopping/{item_id}", headers=headers)
        assert response.status_code == 200
        print(f"✓ Delete shopping item working: {item_id}")


class TestCalendarEvents:
    """Calendar events API tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_events(self, parent_auth):
        """Test getting events list"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/events", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'events' in data
        print(f"✓ Get events working: {len(data['events'])} events")
    
    def test_create_event(self, parent_auth):
        """Test creating an event"""
        headers, user = parent_auth
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        event_data = {
            "title": f"TEST_Event_{uuid.uuid4().hex[:6]}",
            "description": "Test event description",
            "event_date": tomorrow,
            "event_time": "14:00",
            "event_type": "appointment"
        }
        response = requests.post(f"{BASE_URL}/api/events", headers=headers, json=event_data)
        assert response.status_code == 200
        data = response.json()
        assert data['title'] == event_data['title']
        assert 'event_id' in data
        print(f"✓ Create event working: {data['event_id']}")
    
    def test_create_work_schedule(self, parent_auth):
        """Test creating a work schedule event"""
        headers, user = parent_auth
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        schedule_data = {
            "event_date": tomorrow,
            "start_time": "09:00",
            "end_time": "17:00",
            "description": "Regular work day"
        }
        response = requests.post(f"{BASE_URL}/api/events/work-schedule", headers=headers, json=schedule_data)
        assert response.status_code == 200
        data = response.json()
        assert data['event_type'] == 'work_schedule'
        print(f"✓ Create work schedule working: {data['event_id']}")


class TestFamilyWall:
    """Family Wall posts and daily quote tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_family_wall(self, parent_auth):
        """Test getting family wall posts"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/family-wall", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'posts' in data
        print(f"✓ Get family wall working: {len(data['posts'])} posts")
    
    def test_create_text_post(self, parent_auth):
        """Test creating a text post"""
        headers, user = parent_auth
        post_data = {
            "content": f"TEST_Post_{uuid.uuid4().hex[:6]} - Hello family!",
            "type": "text"
        }
        response = requests.post(f"{BASE_URL}/api/family-wall", headers=headers, json=post_data)
        assert response.status_code == 200
        data = response.json()
        assert 'post_id' in data
        assert data['content'] == post_data['content']
        print(f"✓ Create text post working: {data['post_id']}")
    
    def test_create_poll_post(self, parent_auth):
        """Test creating a poll post"""
        headers, user = parent_auth
        poll_data = {
            "content": f"TEST_Poll_{uuid.uuid4().hex[:6]} - What should we have for dinner?",
            "type": "poll",
            "poll_options": ["Pizza", "Tacos", "Pasta"]
        }
        response = requests.post(f"{BASE_URL}/api/family-wall", headers=headers, json=poll_data)
        assert response.status_code == 200
        data = response.json()
        assert 'post_id' in data
        assert data['type'] == 'poll'
        assert len(data['poll_options']) == 3
        print(f"✓ Create poll post working: {data['post_id']}")
    
    def test_get_daily_quote(self, parent_auth):
        """Test getting daily quote (AI-generated)"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/family-wall/daily-quote", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'quote' in data
        assert 'date' in data
        print(f"✓ Get daily quote working: {data['quote'][:50]}...")


class TestLeaderboard:
    """Leaderboard with timeframe filter tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_leaderboard_all_time(self, parent_auth):
        """Test leaderboard with all-time filter"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/leaderboard?timeframe=all-time", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'leaderboard' in data
        print(f"✓ Leaderboard (all-time) working: {len(data['leaderboard'])} entries")
    
    def test_leaderboard_this_week(self, parent_auth):
        """Test leaderboard with this-week filter"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/leaderboard?timeframe=this-week", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'leaderboard' in data
        print(f"✓ Leaderboard (this-week) working: {len(data['leaderboard'])} entries")
    
    def test_leaderboard_this_month(self, parent_auth):
        """Test leaderboard with this-month filter"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/leaderboard?timeframe=this-month", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'leaderboard' in data
        print(f"✓ Leaderboard (this-month) working: {len(data['leaderboard'])} entries")


class TestReadingLogs:
    """Reading logs API tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    @pytest.fixture
    def child_auth(self):
        """Get child authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_reading_logs(self, parent_auth):
        """Test getting reading logs"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/reading-logs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'logs' in data
        print(f"✓ Get reading logs working: {len(data['logs'])} logs")
    
    def test_create_reading_log(self, child_auth):
        """Test creating a reading log"""
        headers, user = child_auth
        log_data = {
            "book_name": f"TEST_Book_{uuid.uuid4().hex[:6]}",
            "pages_read": 25,
            "summary": "Great chapter about adventure!",
            "date": datetime.now().strftime("%Y-%m-%d")
        }
        response = requests.post(f"{BASE_URL}/api/reading-logs", headers=headers, json=log_data)
        assert response.status_code == 200
        data = response.json()
        assert data['book_name'] == log_data['book_name']
        assert 'log_id' in data
        print(f"✓ Create reading log working: {data['log_id']}")
    
    def test_approve_reading_log(self, parent_auth, child_auth):
        """Test approving a reading log"""
        parent_headers, parent_user = parent_auth
        child_headers, child_user = child_auth
        
        # Create log as child
        create_resp = requests.post(
            f"{BASE_URL}/api/reading-logs",
            headers=child_headers,
            json={
                "book_name": f"TEST_Approve_{uuid.uuid4().hex[:6]}",
                "pages_read": 15,
                "summary": "Test summary"
            }
        )
        log_id = create_resp.json()['log_id']
        
        # Approve as parent
        response = requests.put(
            f"{BASE_URL}/api/reading-logs/{log_id}/approve",
            headers=parent_headers,
            json={"approved": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'approved'
        print(f"✓ Approve reading log working: {log_id}")


class TestLocationCheckins:
    """Location and checkin endpoint tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    @pytest.fixture
    def child_auth(self):
        """Get child authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_create_checkin(self, child_auth):
        """Test creating a location checkin"""
        headers, user = child_auth
        checkin_data = {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "address": "San Francisco, CA"
        }
        response = requests.post(f"{BASE_URL}/api/checkins", headers=headers, json=checkin_data)
        assert response.status_code == 200
        data = response.json()
        assert 'checkin_id' in data
        assert data['latitude'] == checkin_data['latitude']
        print(f"✓ Create checkin working: {data['checkin_id']}")
    
    def test_get_user_checkins(self, child_auth):
        """Test getting user checkins"""
        headers, user = child_auth
        user_id = user['user_id']
        response = requests.get(f"{BASE_URL}/api/checkins/{user_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'checkins' in data
        print(f"✓ Get user checkins working: {len(data['checkins'])} checkins")
    
    def test_get_geofences(self, parent_auth):
        """Test getting geofences"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/geofences", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'geofences' in data
        print(f"✓ Get geofences working: {len(data['geofences'])} geofences")
    
    def test_create_geofence(self, parent_auth):
        """Test creating a geofence"""
        headers, user = parent_auth
        geofence_data = {
            "name": f"TEST_Fence_{uuid.uuid4().hex[:6]}",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "radius_feet": 100,
            "notify_on_exit": True
        }
        response = requests.post(f"{BASE_URL}/api/geofences", headers=headers, json=geofence_data)
        assert response.status_code == 200
        data = response.json()
        assert 'geofence_id' in data
        assert data['name'] == geofence_data['name']
        print(f"✓ Create geofence working: {data['geofence_id']}")
    
    def test_delete_geofence(self, parent_auth):
        """Test deleting a geofence"""
        headers, user = parent_auth
        
        # Create geofence first
        create_resp = requests.post(
            f"{BASE_URL}/api/geofences",
            headers=headers,
            json={
                "name": f"TEST_Delete_{uuid.uuid4().hex[:6]}",
                "latitude": 37.7749,
                "longitude": -122.4194
            }
        )
        geofence_id = create_resp.json()['geofence_id']
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/geofences/{geofence_id}", headers=headers)
        assert response.status_code == 200
        print(f"✓ Delete geofence working: {geofence_id}")
    
    def test_location_update(self, child_auth):
        """Test updating user location"""
        headers, user = child_auth
        location_data = {
            "latitude": 37.7849,
            "longitude": -122.4094
        }
        response = requests.post(f"{BASE_URL}/api/location/update", headers=headers, json=location_data)
        assert response.status_code == 200
        print("✓ Location update working")
    
    def test_get_location_alerts(self, parent_auth):
        """Test getting location alerts"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/location/alerts", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'alerts' in data
        print(f"✓ Get location alerts working: {len(data['alerts'])} alerts")


class TestAIFeatures:
    """AI features tests - Pixie, meal suggestions, chore tips"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_pixie_assistant(self, parent_auth):
        """Test Pixie AI assistant"""
        headers, user = parent_auth
        pixie_data = {
            "message": "What's a good family activity for the weekend?",
            "user_name": "Test User",
            "user_role": "parent"
        }
        response = requests.post(f"{BASE_URL}/api/ai/pixie", headers=headers, json=pixie_data, timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert 'response' in data
        print(f"✓ Pixie AI working: {str(data['response'])[:50]}...")
    
    def test_meal_plan_suggestion(self, parent_auth):
        """Test AI meal plan suggestion"""
        headers, user = parent_auth
        meal_data = {
            "preferences": "vegetarian",
            "servings": 4,
            "meal_type": "dinner"
        }
        response = requests.post(f"{BASE_URL}/api/ai/meal-plan", headers=headers, json=meal_data, timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data or 'meal' in data or 'suggestion' in data
        print(f"✓ AI meal plan working")
    
    def test_chore_tips(self, parent_auth):
        """Test AI chore tips"""
        headers, user = parent_auth
        tips_data = {
            "title": "Clean bedroom",
            "child_age": 10
        }
        response = requests.post(f"{BASE_URL}/api/ai/chore-tips", headers=headers, json=tips_data, timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert 'tips' in data
        print(f"✓ AI chore tips working: {str(data['tips'])[:50]}...")
    
    def test_family_activity_suggestion(self, parent_auth):
        """Test AI family activity suggestion"""
        headers, user = parent_auth
        activity_data = {
            "num_kids": 2,
            "ages": [8, 12],
            "weather": "sunny",
            "duration": "2 hours"
        }
        response = requests.post(f"{BASE_URL}/api/ai/family-activity", headers=headers, json=activity_data, timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data or 'data' in data or 'suggestion' in data
        print(f"✓ AI family activity working")


class TestUserSettings:
    """User settings and theme persistence tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_user(self, parent_auth):
        """Test getting user profile"""
        headers, user = parent_auth
        user_id = user['user_id']
        response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data['user_id'] == user_id
        print(f"✓ Get user profile working: {data['name']}")
    
    def test_update_user_settings(self, parent_auth):
        """Test updating user settings"""
        headers, user = parent_auth
        user_id = user['user_id']
        update_data = {
            "settings": {
                "theme": "ocean_breeze",
                "notifications_enabled": True
            }
        }
        response = requests.put(f"{BASE_URL}/api/users/{user_id}", headers=headers, json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data['settings']['theme'] == 'ocean_breeze'
        print(f"✓ Update user settings working: theme={data['settings']['theme']}")
    
    def test_update_user_nickname(self, parent_auth):
        """Test updating user nickname"""
        headers, user = parent_auth
        user_id = user['user_id']
        nickname = f"TestNick_{uuid.uuid4().hex[:4]}"
        response = requests.put(
            f"{BASE_URL}/api/users/{user_id}/nickname",
            headers=headers,
            json={"nickname": nickname}
        )
        assert response.status_code == 200
        data = response.json()
        assert data['nickname'] == nickname
        print(f"✓ Update nickname working: {nickname}")
    
    def test_modify_child_points(self, parent_auth):
        """Test modifying child points"""
        headers, user = parent_auth
        
        # First create a child
        child_resp = requests.post(
            f"{BASE_URL}/api/users/child",
            headers=headers,
            json={"name": f"TEST_Points_{uuid.uuid4().hex[:6]}"}
        )
        child_id = child_resp.json()['user_id']
        
        # Modify points
        response = requests.post(
            f"{BASE_URL}/api/users/{child_id}/points",
            headers=headers,
            json={"amount": 25, "reason": "Test bonus"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data['change'] == 25
        print(f"✓ Modify child points working: +{data['change']} points")


class TestMessages:
    """Messages/Chat endpoint tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_messages(self, parent_auth):
        """Test getting messages"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/messages", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'messages' in data
        print(f"✓ Get messages working: {len(data['messages'])} messages")
    
    def test_send_message(self, parent_auth):
        """Test sending a message"""
        headers, user = parent_auth
        message_data = {
            "content": f"TEST_Message_{uuid.uuid4().hex[:6]} - Hello family!"
        }
        response = requests.post(f"{BASE_URL}/api/messages", headers=headers, json=message_data)
        assert response.status_code == 200
        data = response.json()
        assert 'message_id' in data
        assert data['content'] == message_data['content']
        print(f"✓ Send message working: {data['message_id']}")


class TestNotifications:
    """Notifications endpoint tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_notifications(self, parent_auth):
        """Test getting notifications"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'notifications' in data
        print(f"✓ Get notifications working: {len(data['notifications'])} notifications")


class TestWeather:
    """Weather endpoint tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_weather(self, parent_auth):
        """Test getting weather data"""
        headers, user = parent_auth
        response = requests.get(
            f"{BASE_URL}/api/weather?lat=37.7749&lon=-122.4194",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        # Weather endpoint should return weather data or error gracefully
        print(f"✓ Weather endpoint working")


class TestDashboardConfig:
    """Dashboard configuration tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_dashboard_config(self, parent_auth):
        """Test getting dashboard configuration"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/dashboard/config", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'sections' in data
        print(f"✓ Get dashboard config working: {len(data['sections'])} sections")


class TestGoals:
    """Goals endpoint tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_goals(self, parent_auth):
        """Test getting goals"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/goals", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'goals' in data
        print(f"✓ Get goals working: {len(data['goals'])} goals")
    
    def test_create_goal(self, parent_auth):
        """Test creating a goal"""
        headers, user = parent_auth
        goal_data = {
            "title": f"TEST_Goal_{uuid.uuid4().hex[:6]}",
            "target_value": 100,
            "current_value": 0
        }
        response = requests.post(f"{BASE_URL}/api/goals", headers=headers, json=goal_data)
        assert response.status_code == 200
        data = response.json()
        assert 'goal_id' in data
        print(f"✓ Create goal working: {data['goal_id']}")


class TestAchievements:
    """Achievements endpoint tests"""
    
    @pytest.fixture
    def parent_auth(self):
        """Get parent authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        data = response.json()
        return {"Authorization": f"Bearer {data['session_token']}"}, data['user']
    
    def test_get_achievements(self, parent_auth):
        """Test getting achievements"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/achievements", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'achievements' in data
        print(f"✓ Get achievements working: {len(data['achievements'])} achievements")
    
    def test_get_family_achievements(self, parent_auth):
        """Test getting family achievements"""
        headers, user = parent_auth
        response = requests.get(f"{BASE_URL}/api/achievements/family", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'achievements' in data
        print(f"✓ Get family achievements working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

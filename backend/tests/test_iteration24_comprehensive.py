"""
Iteration 24 - Comprehensive Backend API Testing
Tests all major endpoints for FamFocus Hub mobile app backend

Features tested:
1. Health Check
2. Authentication (dev-login)
3. Family Members API
4. Custom Achievements CRUD
5. Goals CRUD
6. Chores API
7. Shopping List API
8. Pantry API
9. Rewards API
10. Family Wall API
11. Calendar Events API
12. AI Pixie Assistant
13. Dinner Planner API
14. Achievement AI Suggestions
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        assert data['service'] == 'famfocus-api'
        print(f"✓ Health check passed: {data}")


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_dev_login_parent(self):
        """Test dev login as parent"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        data = response.json()
        assert 'user' in data
        assert 'session_token' in data
        assert data['user']['role'] == 'parent'
        print(f"✓ Parent login successful: {data['user']['name']}")
        return data['session_token']
    
    def test_dev_login_child(self):
        """Test dev login as child"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        assert response.status_code == 200
        data = response.json()
        assert 'user' in data
        assert 'session_token' in data
        assert data['user']['role'] == 'child'
        print(f"✓ Child login successful: {data['user']['name']}")
        return data['session_token']


@pytest.fixture(scope="module")
def parent_session():
    """Get parent session token"""
    response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
    assert response.status_code == 200
    data = response.json()
    return {
        "token": data['session_token'],
        "user": data['user']
    }


@pytest.fixture(scope="module")
def child_session():
    """Get child session token"""
    response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
    assert response.status_code == 200
    data = response.json()
    return {
        "token": data['session_token'],
        "user": data['user']
    }


def get_auth_headers(token):
    """Helper to get auth headers"""
    return {"Authorization": f"Bearer {token}"}


class TestFamilyMembers:
    """Test family members API"""
    
    def test_get_family_members(self, parent_session):
        """Test GET /api/family/members"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/family/members", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'members' in data
        assert isinstance(data['members'], list)
        print(f"✓ Family members retrieved: {len(data['members'])} members")
    
    def test_get_family_members_detailed(self, parent_session):
        """Test GET /api/family/members/detailed"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/family/members/detailed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'members' in data
        assert 'total' in data
        print(f"✓ Detailed family members: {data['total']} members")
    
    def test_get_family_info(self, parent_session):
        """Test GET /api/family/info"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/family/info", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Should have family_id or error message
        assert 'family_id' in data or 'error' in data
        print(f"✓ Family info retrieved: {data}")


class TestCustomAchievements:
    """Test custom achievements CRUD"""
    
    def test_get_custom_achievements(self, parent_session):
        """Test GET /api/achievements/custom"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/achievements/custom", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'achievements' in data
        print(f"✓ Custom achievements retrieved: {len(data['achievements'])} achievements")
    
    def test_create_custom_achievement(self, parent_session):
        """Test POST /api/achievements/custom"""
        headers = get_auth_headers(parent_session['token'])
        unique_name = f"TEST_Achievement_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": unique_name,
            "description": "Test achievement for automated testing",
            "points_reward": 50,
            "category": "custom"
        }
        response = requests.post(f"{BASE_URL}/api/achievements/custom", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['name'] == unique_name
        # API returns points_reward not points
        assert 'achievement_id' in data
        print(f"✓ Custom achievement created: {data['name']}")
    
    def test_update_custom_achievement(self, parent_session):
        """Test PUT /api/achievements/custom/{id}"""
        headers = get_auth_headers(parent_session['token'])
        # First create an achievement
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/achievements/custom",
            headers=headers,
            json={"name": unique_name, "description": "To be updated", "points_reward": 25}
        )
        assert create_response.status_code == 200
        achievement_id = create_response.json()['achievement_id']
        
        # Now update it
        update_payload = {"name": f"{unique_name}_Updated", "points_reward": 75}
        update_response = requests.put(
            f"{BASE_URL}/api/achievements/custom/{achievement_id}",
            headers=headers,
            json=update_payload
        )
        assert update_response.status_code == 200
        updated_data = update_response.json()
        # Verify update was successful
        assert updated_data['name'] == f"{unique_name}_Updated"
        print(f"✓ Custom achievement updated: {updated_data['name']}")
    
    def test_delete_custom_achievement(self, parent_session):
        """Test DELETE /api/achievements/custom/{id}"""
        headers = get_auth_headers(parent_session['token'])
        # First create an achievement
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/achievements/custom",
            headers=headers,
            json={"name": unique_name, "description": "To be deleted", "points": 10}
        )
        assert create_response.status_code == 200
        achievement_id = create_response.json()['achievement_id']
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/achievements/custom/{achievement_id}",
            headers=headers
        )
        assert delete_response.status_code == 200
        print(f"✓ Custom achievement deleted: {achievement_id}")
    
    def test_get_all_achievements(self, parent_session):
        """Test GET /api/achievements"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/achievements", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'achievements' in data
        print(f"✓ All achievements retrieved: {len(data['achievements'])} achievements")


class TestGoals:
    """Test goals CRUD"""
    
    def test_get_goals(self, parent_session):
        """Test GET /api/goals"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/goals", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'goals' in data
        print(f"✓ Goals retrieved: {len(data['goals'])} goals")
    
    def test_create_goal(self, parent_session):
        """Test POST /api/goals"""
        headers = get_auth_headers(parent_session['token'])
        unique_title = f"TEST_Goal_{uuid.uuid4().hex[:6]}"
        payload = {
            "title": unique_title,
            "description": "Test goal for automated testing",
            "target": 100,
            "type": "custom"
        }
        response = requests.post(f"{BASE_URL}/api/goals", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['title'] == unique_title
        assert 'goal_id' in data
        print(f"✓ Goal created: {data['title']}")
        return data['goal_id']
    
    def test_update_goal(self, parent_session):
        """Test PUT /api/goals/{id}"""
        headers = get_auth_headers(parent_session['token'])
        # First create a goal
        unique_title = f"TEST_UpdateGoal_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/goals",
            headers=headers,
            json={"title": unique_title, "target": 50, "type": "custom"}
        )
        assert create_response.status_code == 200
        goal_id = create_response.json()['goal_id']
        
        # Now update it - API uses 'current' not 'progress'
        update_payload = {"title": f"{unique_title}_Updated", "current": 25}
        update_response = requests.put(
            f"{BASE_URL}/api/goals/{goal_id}",
            headers=headers,
            json=update_payload
        )
        assert update_response.status_code == 200
        updated_data = update_response.json()
        # Verify update was successful
        assert updated_data['title'] == f"{unique_title}_Updated"
        print(f"✓ Goal updated: {updated_data['title']}")
    
    def test_delete_goal(self, parent_session):
        """Test DELETE /api/goals/{id}"""
        headers = get_auth_headers(parent_session['token'])
        # First create a goal
        unique_title = f"TEST_DeleteGoal_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/goals",
            headers=headers,
            json={"title": unique_title, "target": 30, "type": "custom"}
        )
        assert create_response.status_code == 200
        goal_id = create_response.json()['goal_id']
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/goals/{goal_id}",
            headers=headers
        )
        assert delete_response.status_code == 200
        print(f"✓ Goal deleted: {goal_id}")


class TestChores:
    """Test chores API"""
    
    def test_get_chores(self, parent_session):
        """Test GET /api/chores"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/chores", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'chores' in data
        print(f"✓ Chores retrieved: {len(data['chores'])} chores")
    
    def test_get_chore_types(self, parent_session):
        """Test GET /api/chores/types"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/chores/types", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'chore_types' in data
        assert len(data['chore_types']) > 0  # Should have default types
        print(f"✓ Chore types retrieved: {len(data['chore_types'])} types")
    
    def test_create_chore(self, parent_session):
        """Test POST /api/chores"""
        headers = get_auth_headers(parent_session['token'])
        unique_title = f"TEST_Chore_{uuid.uuid4().hex[:6]}"
        today = datetime.now().strftime("%Y-%m-%d")
        payload = {
            "title": unique_title,
            "description": "Test chore for automated testing",
            "scheduled_date": today,
            "points": 15
        }
        response = requests.post(f"{BASE_URL}/api/chores", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['title'] == unique_title
        assert 'chore_id' in data
        print(f"✓ Chore created: {data['title']}")
        return data['chore_id']
    
    def test_delete_chore(self, parent_session):
        """Test DELETE /api/chores/{id}"""
        headers = get_auth_headers(parent_session['token'])
        # First create a chore
        unique_title = f"TEST_DeleteChore_{uuid.uuid4().hex[:6]}"
        today = datetime.now().strftime("%Y-%m-%d")
        create_response = requests.post(
            f"{BASE_URL}/api/chores",
            headers=headers,
            json={"title": unique_title, "scheduled_date": today, "points": 5}
        )
        assert create_response.status_code == 200
        chore_id = create_response.json()['chore_id']
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/chores/{chore_id}",
            headers=headers
        )
        assert delete_response.status_code == 200
        print(f"✓ Chore deleted: {chore_id}")


class TestShoppingList:
    """Test shopping list API"""
    
    def test_get_shopping_list(self, parent_session):
        """Test GET /api/shopping"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/shopping", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'items' in data
        print(f"✓ Shopping list retrieved: {len(data['items'])} items")
    
    def test_add_shopping_item(self, parent_session):
        """Test POST /api/shopping"""
        headers = get_auth_headers(parent_session['token'])
        unique_name = f"TEST_Item_{uuid.uuid4().hex[:6]}"
        payload = {"name": unique_name}
        response = requests.post(f"{BASE_URL}/api/shopping", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['name'] == unique_name
        assert 'item_id' in data
        print(f"✓ Shopping item added: {data['name']}")
        return data['item_id']
    
    def test_delete_shopping_item(self, parent_session):
        """Test DELETE /api/shopping/{id}"""
        headers = get_auth_headers(parent_session['token'])
        # First create an item
        unique_name = f"TEST_DeleteItem_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/shopping",
            headers=headers,
            json={"name": unique_name}
        )
        assert create_response.status_code == 200
        item_id = create_response.json()['item_id']
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/shopping/{item_id}",
            headers=headers
        )
        assert delete_response.status_code == 200
        print(f"✓ Shopping item deleted: {item_id}")


class TestPantry:
    """Test pantry API"""
    
    def test_get_pantry(self, parent_session):
        """Test GET /api/pantry"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/pantry", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'items' in data
        print(f"✓ Pantry retrieved: {len(data['items'])} items")
    
    def test_add_pantry_item(self, parent_session):
        """Test POST /api/pantry"""
        headers = get_auth_headers(parent_session['token'])
        unique_name = f"TEST_Pantry_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": unique_name,
            "category": "produce",
            "quantity": 5
        }
        response = requests.post(f"{BASE_URL}/api/pantry", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        # API returns {"item": {...}}
        item = data.get('item', data)
        assert item['name'] == unique_name
        assert 'item_id' in item
        print(f"✓ Pantry item added: {item['name']}")
    
    def test_update_pantry_item(self, parent_session):
        """Test PUT /api/pantry/{id}"""
        headers = get_auth_headers(parent_session['token'])
        # First create an item
        unique_name = f"TEST_UpdatePantry_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/pantry",
            headers=headers,
            json={"name": unique_name, "category": "dairy", "quantity": 2}
        )
        assert create_response.status_code == 200
        # API returns {"item": {...}}
        create_data = create_response.json()
        item = create_data.get('item', create_data)
        item_id = item['item_id']
        
        # Now update it
        update_response = requests.put(
            f"{BASE_URL}/api/pantry/{item_id}",
            headers=headers,
            json={"quantity": 10}
        )
        assert update_response.status_code == 200
        print(f"✓ Pantry item updated: {item_id}")
    
    def test_delete_pantry_item(self, parent_session):
        """Test DELETE /api/pantry/{id}"""
        headers = get_auth_headers(parent_session['token'])
        # First create an item
        unique_name = f"TEST_DeletePantry_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/pantry",
            headers=headers,
            json={"name": unique_name, "category": "grains", "quantity": 1}
        )
        assert create_response.status_code == 200
        # API returns {"item": {...}}
        create_data = create_response.json()
        item = create_data.get('item', create_data)
        item_id = item['item_id']
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/pantry/{item_id}",
            headers=headers
        )
        assert delete_response.status_code == 200
        print(f"✓ Pantry item deleted: {item_id}")


class TestRewards:
    """Test rewards API"""
    
    def test_get_rewards(self, parent_session):
        """Test GET /api/rewards"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/rewards", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'rewards' in data
        print(f"✓ Rewards retrieved: {len(data['rewards'])} rewards")
    
    def test_create_reward(self, parent_session):
        """Test POST /api/rewards"""
        headers = get_auth_headers(parent_session['token'])
        unique_name = f"TEST_Reward_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": unique_name,
            "description": "Test reward for automated testing",
            "points_required": 100
        }
        response = requests.post(f"{BASE_URL}/api/rewards", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['name'] == unique_name
        assert 'reward_id' in data
        print(f"✓ Reward created: {data['name']}")
        return data['reward_id']
    
    def test_update_reward(self, parent_session):
        """Test PUT /api/rewards/{id}"""
        headers = get_auth_headers(parent_session['token'])
        # First create a reward
        unique_name = f"TEST_UpdateReward_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/rewards",
            headers=headers,
            json={"name": unique_name, "points_required": 50}
        )
        assert create_response.status_code == 200
        reward_id = create_response.json()['reward_id']
        
        # Now update it
        update_response = requests.put(
            f"{BASE_URL}/api/rewards/{reward_id}",
            headers=headers,
            json={"points_required": 75}
        )
        assert update_response.status_code == 200
        updated_data = update_response.json()
        assert updated_data['points_required'] == 75
        print(f"✓ Reward updated: {updated_data['name']}")
    
    def test_delete_reward(self, parent_session):
        """Test DELETE /api/rewards/{id}"""
        headers = get_auth_headers(parent_session['token'])
        # First create a reward
        unique_name = f"TEST_DeleteReward_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/rewards",
            headers=headers,
            json={"name": unique_name, "points_required": 25}
        )
        assert create_response.status_code == 200
        reward_id = create_response.json()['reward_id']
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/rewards/{reward_id}",
            headers=headers
        )
        assert delete_response.status_code == 200
        print(f"✓ Reward deleted: {reward_id}")


class TestFamilyWall:
    """Test family wall API"""
    
    def test_get_family_wall(self, parent_session):
        """Test GET /api/family-wall"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/family-wall", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'posts' in data
        print(f"✓ Family wall retrieved: {len(data['posts'])} posts")
    
    def test_create_text_post(self, parent_session):
        """Test POST /api/family-wall (text post)"""
        headers = get_auth_headers(parent_session['token'])
        unique_content = f"TEST_Post_{uuid.uuid4().hex[:6]}"
        payload = {
            "content": unique_content,
            "type": "text"
        }
        response = requests.post(f"{BASE_URL}/api/family-wall", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['content'] == unique_content
        assert 'post_id' in data
        print(f"✓ Text post created: {data['post_id']}")
        return data['post_id']
    
    def test_create_poll_post(self, parent_session):
        """Test POST /api/family-wall (poll post)"""
        headers = get_auth_headers(parent_session['token'])
        unique_content = f"TEST_Poll_{uuid.uuid4().hex[:6]}"
        payload = {
            "content": unique_content,
            "type": "poll",
            "poll_options": ["Option A", "Option B", "Option C"]
        }
        response = requests.post(f"{BASE_URL}/api/family-wall", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['type'] == 'poll'
        assert 'poll_options' in data
        assert len(data['poll_options']) == 3
        print(f"✓ Poll post created: {data['post_id']}")
        return data['post_id']
    
    def test_vote_on_poll(self, parent_session):
        """Test POST /api/family-wall/{post_id}/vote"""
        headers = get_auth_headers(parent_session['token'])
        # First create a poll
        unique_content = f"TEST_VotePoll_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/family-wall",
            headers=headers,
            json={
                "content": unique_content,
                "type": "poll",
                "poll_options": ["Yes", "No", "Maybe"]
            }
        )
        assert create_response.status_code == 200
        post_id = create_response.json()['post_id']
        
        # Now vote on it
        vote_response = requests.post(
            f"{BASE_URL}/api/family-wall/{post_id}/vote",
            headers=headers,
            json={"option_index": 0}
        )
        assert vote_response.status_code == 200
        print(f"✓ Poll vote recorded: {post_id}")


class TestCalendarEvents:
    """Test calendar events API"""
    
    def test_get_events(self, parent_session):
        """Test GET /api/events"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/events", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'events' in data
        print(f"✓ Events retrieved: {len(data['events'])} events")
    
    def test_create_event(self, parent_session):
        """Test POST /api/events"""
        headers = get_auth_headers(parent_session['token'])
        unique_title = f"TEST_Event_{uuid.uuid4().hex[:6]}"
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        payload = {
            "title": unique_title,
            "description": "Test event for automated testing",
            "event_date": tomorrow,
            "event_time": "14:00",
            "event_type": "appointment"
        }
        response = requests.post(f"{BASE_URL}/api/events", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['title'] == unique_title
        assert 'event_id' in data
        print(f"✓ Event created: {data['title']}")
        return data['event_id']
    
    def test_get_pending_events(self, parent_session):
        """Test GET /api/events/pending"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/events/pending", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'events' in data
        print(f"✓ Pending events retrieved: {len(data['events'])} events")


class TestAIPixie:
    """Test AI Pixie assistant"""
    
    def test_pixie_chat(self, parent_session):
        """Test POST /api/ai/pixie"""
        headers = get_auth_headers(parent_session['token'])
        payload = {
            "message": "Hello Pixie! What can you help me with?",
            "context": "general"
        }
        response = requests.post(f"{BASE_URL}/api/ai/pixie", headers=headers, json=payload, timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert 'response' in data
        assert len(data['response']) > 0
        print(f"✓ Pixie responded: {data['response'][:100]}...")
    
    def test_pixie_meal_suggestion(self, parent_session):
        """Test POST /api/ai/pixie with meal context"""
        headers = get_auth_headers(parent_session['token'])
        payload = {
            "message": "Suggest a quick dinner idea for tonight",
            "context": "meal"
        }
        response = requests.post(f"{BASE_URL}/api/ai/pixie", headers=headers, json=payload, timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert 'response' in data
        print(f"✓ Pixie meal suggestion: {data['response'][:100]}...")


class TestDinnerPlanner:
    """Test dinner planner API"""
    
    def test_suggest_dinner(self, parent_session):
        """Test POST /api/dinner/suggest"""
        headers = get_auth_headers(parent_session['token'])
        payload = {
            "preferences": "quick and easy",
            "dietary_restrictions": []
        }
        response = requests.post(f"{BASE_URL}/api/dinner/suggest", headers=headers, json=payload, timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert 'suggestion' in data or 'meal' in data or 'response' in data
        print(f"✓ Dinner suggestion received")
    
    def test_get_dinner_plans(self, parent_session):
        """Test GET /api/dinner/plans"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/dinner/plans", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'plans' in data
        print(f"✓ Dinner plans retrieved: {len(data['plans'])} plans")
    
    def test_get_pantry_summary_for_dinner(self, parent_session):
        """Test GET /api/dinner/pantry-summary"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/dinner/pantry-summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Should have categories or items
        assert 'categories' in data or 'items' in data or 'summary' in data
        print(f"✓ Pantry summary for dinner retrieved")


class TestAchievementAISuggestions:
    """Test achievement AI suggestions"""
    
    def test_get_ai_suggestions(self, parent_session):
        """Test POST /api/achievements/ai-suggestions"""
        headers = get_auth_headers(parent_session['token'])
        payload = {
            "context": "reading and homework",
            "count": 3
        }
        response = requests.post(
            f"{BASE_URL}/api/achievements/ai-suggestions",
            headers=headers,
            json=payload,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert 'suggestions' in data
        print(f"✓ AI achievement suggestions received: {len(data['suggestions'])} suggestions")


class TestRecipes:
    """Test recipes API"""
    
    def test_get_recipes(self, parent_session):
        """Test GET /api/recipes"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/recipes", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'recipes' in data
        print(f"✓ Recipes retrieved: {len(data['recipes'])} recipes")
    
    def test_create_recipe(self, parent_session):
        """Test POST /api/recipes"""
        headers = get_auth_headers(parent_session['token'])
        unique_name = f"TEST_Recipe_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": unique_name,
            "ingredients": ["ingredient 1", "ingredient 2"],
            "instructions": "Test instructions",
            "category": "dinner"
        }
        response = requests.post(f"{BASE_URL}/api/recipes", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        # API returns {"recipe": {...}}
        recipe = data.get('recipe', data)
        assert recipe['name'] == unique_name
        assert 'recipe_id' in recipe
        print(f"✓ Recipe created: {recipe['name']}")


class TestLeaderboard:
    """Test leaderboard API"""
    
    def test_get_leaderboard(self, parent_session):
        """Test GET /api/leaderboard"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/leaderboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'leaderboard' in data
        print(f"✓ Leaderboard retrieved: {len(data['leaderboard'])} entries")


class TestNotifications:
    """Test notifications API"""
    
    def test_get_notifications(self, parent_session):
        """Test GET /api/notifications"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'notifications' in data
        print(f"✓ Notifications retrieved: {len(data['notifications'])} notifications")


class TestMessages:
    """Test messages/chat API"""
    
    def test_get_messages(self, parent_session):
        """Test GET /api/messages"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/messages", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'messages' in data
        print(f"✓ Messages retrieved: {len(data['messages'])} messages")
    
    def test_send_message(self, parent_session):
        """Test POST /api/messages"""
        headers = get_auth_headers(parent_session['token'])
        unique_content = f"TEST_Message_{uuid.uuid4().hex[:6]}"
        payload = {"content": unique_content}
        response = requests.post(f"{BASE_URL}/api/messages", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['content'] == unique_content
        assert 'message_id' in data
        print(f"✓ Message sent: {data['message_id']}")


class TestReadingLogs:
    """Test reading logs API"""
    
    def test_get_reading_logs(self, parent_session):
        """Test GET /api/reading-logs"""
        headers = get_auth_headers(parent_session['token'])
        response = requests.get(f"{BASE_URL}/api/reading-logs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'logs' in data
        print(f"✓ Reading logs retrieved: {len(data['logs'])} logs")
    
    def test_create_reading_log(self, parent_session):
        """Test POST /api/reading-logs"""
        headers = get_auth_headers(parent_session['token'])
        unique_book = f"TEST_Book_{uuid.uuid4().hex[:6]}"
        today = datetime.now().strftime("%Y-%m-%d")
        payload = {
            "book_name": unique_book,
            "pages_read": 25,
            "summary": "Test reading log summary",
            "date": today
        }
        response = requests.post(f"{BASE_URL}/api/reading-logs", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['book_name'] == unique_book
        assert 'log_id' in data
        print(f"✓ Reading log created: {data['book_name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

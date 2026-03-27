"""
Iteration 39 Tests - 8 New Features Testing
Tests for:
1. Chore Streaks & Achievements - GET /api/streaks
2. Family Weekly Recap - GET /api/weekly-recap
3. Routines (Morning/Evening Checklists) - GET/POST/DELETE /api/routines, POST /api/routines/{id}/complete
4. Sticky Notes/Message Board - GET/POST/DELETE /api/hub/notes
5. Hub Themes - GET /api/hub/themes, PUT /api/hub/theme, GET /api/hub/settings
6. Recipes (Meal Planning) - GET/POST/DELETE /api/recipes, POST /api/recipes/{id}/to-shopping
7. Calendar Drag & Drop - PUT /api/events/{id}/move
8. Push Notifications - POST /api/push/subscribe, DELETE /api/push/unsubscribe
9. Family Members - GET /api/family/members (Elizabeth co-parent should appear)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ZACHERY_EMAIL = "zhesterusar@gmail.com"
ELIZABETH_EMAIL = "ebuss980@gmail.com"

class TestStreaksAPI:
    """Tests for GET /api/streaks - Chore Streaks & Achievements"""
    
    @pytest.fixture
    def parent_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_get_streaks_returns_200(self, parent_session):
        """Test GET /api/streaks returns 200 with streaks data"""
        response = parent_session.get(f"{BASE_URL}/api/streaks")
        assert response.status_code == 200, f"Failed to get streaks: {response.text}"
        
        data = response.json()
        assert 'streaks' in data, "Response should contain 'streaks' key"
        assert isinstance(data['streaks'], list), "Streaks should be a list"
        
        # Verify streak structure if any exist
        if len(data['streaks']) > 0:
            streak = data['streaks'][0]
            assert 'user_id' in streak
            assert 'name' in streak
            assert 'current_streak' in streak
            assert 'longest_streak' in streak
            assert 'total_completed' in streak
        
        print(f"✓ GET /api/streaks returns {len(data['streaks'])} family member streaks")


class TestWeeklyRecapAPI:
    """Tests for GET /api/weekly-recap - Family Weekly Recap"""
    
    @pytest.fixture
    def parent_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_get_weekly_recap_returns_200(self, parent_session):
        """Test GET /api/weekly-recap returns 200 with recap data"""
        response = parent_session.get(f"{BASE_URL}/api/weekly-recap")
        assert response.status_code == 200, f"Failed to get weekly recap: {response.text}"
        
        data = response.json()
        assert 'week_start' in data, "Response should contain 'week_start'"
        assert 'week_end' in data, "Response should contain 'week_end'"
        assert 'member_stats' in data, "Response should contain 'member_stats'"
        assert 'total_chores_completed' in data, "Response should contain 'total_chores_completed'"
        assert 'total_events' in data, "Response should contain 'total_events'"
        assert 'total_points_earned' in data, "Response should contain 'total_points_earned'"
        
        print(f"✓ GET /api/weekly-recap returns week {data['week_start']} to {data['week_end']}")


class TestRoutinesAPI:
    """Tests for Routines CRUD - Morning/Evening Checklists"""
    
    @pytest.fixture
    def parent_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_get_routines_returns_200(self, parent_session):
        """Test GET /api/routines returns 200"""
        response = parent_session.get(f"{BASE_URL}/api/routines")
        assert response.status_code == 200, f"Failed to get routines: {response.text}"
        
        data = response.json()
        assert 'routines' in data, "Response should contain 'routines' key"
        print(f"✓ GET /api/routines returns {len(data['routines'])} routines")
    
    def test_create_routine_returns_routine(self, parent_session):
        """Test POST /api/routines creates a routine"""
        routine_data = {
            "name": f"TEST_Morning Routine {uuid.uuid4().hex[:6]}",
            "type": "morning",
            "items": ["Brush teeth", "Make bed", "Get dressed"],
            "assigned_to": []
        }
        
        response = parent_session.post(
            f"{BASE_URL}/api/routines",
            json=routine_data
        )
        assert response.status_code == 200, f"Failed to create routine: {response.text}"
        
        data = response.json()
        assert 'routine_id' in data, "Response should contain 'routine_id'"
        assert data['name'] == routine_data['name']
        assert data['type'] == 'morning'
        assert len(data['items']) == 3
        
        print(f"✓ POST /api/routines created routine: {data['routine_id']}")
        return data['routine_id']
    
    def test_complete_routine_item(self, parent_session):
        """Test POST /api/routines/{id}/complete toggles item completion"""
        # First create a routine
        routine_data = {
            "name": f"TEST_Complete Test {uuid.uuid4().hex[:6]}",
            "type": "evening",
            "items": ["Test item 1", "Test item 2"],
            "assigned_to": []
        }
        create_response = parent_session.post(f"{BASE_URL}/api/routines", json=routine_data)
        assert create_response.status_code == 200
        routine_id = create_response.json()['routine_id']
        
        # Complete an item
        response = parent_session.post(
            f"{BASE_URL}/api/routines/{routine_id}/complete",
            json={"item_index": 0}
        )
        assert response.status_code == 200, f"Failed to complete routine item: {response.text}"
        
        data = response.json()
        assert 'completed' in data
        assert 'message' in data
        
        print(f"✓ POST /api/routines/{routine_id}/complete toggled item completion")
        
        # Cleanup
        parent_session.delete(f"{BASE_URL}/api/routines/{routine_id}")
    
    def test_delete_routine(self, parent_session):
        """Test DELETE /api/routines/{id} deletes a routine"""
        # First create a routine
        routine_data = {
            "name": f"TEST_Delete Test {uuid.uuid4().hex[:6]}",
            "type": "custom",
            "items": ["Delete me"],
            "assigned_to": []
        }
        create_response = parent_session.post(f"{BASE_URL}/api/routines", json=routine_data)
        assert create_response.status_code == 200
        routine_id = create_response.json()['routine_id']
        
        # Delete the routine
        response = parent_session.delete(f"{BASE_URL}/api/routines/{routine_id}")
        assert response.status_code == 200, f"Failed to delete routine: {response.text}"
        
        data = response.json()
        assert data['message'] == 'Routine deleted'
        
        print(f"✓ DELETE /api/routines/{routine_id} deleted routine")


class TestStickyNotesAPI:
    """Tests for Sticky Notes/Message Board - GET/POST/DELETE /api/hub/notes"""
    
    @pytest.fixture
    def parent_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_get_hub_notes_returns_200(self, parent_session):
        """Test GET /api/hub/notes returns 200"""
        response = parent_session.get(f"{BASE_URL}/api/hub/notes")
        assert response.status_code == 200, f"Failed to get hub notes: {response.text}"
        
        data = response.json()
        assert 'notes' in data, "Response should contain 'notes' key"
        print(f"✓ GET /api/hub/notes returns {len(data['notes'])} notes")
    
    def test_create_hub_note(self, parent_session):
        """Test POST /api/hub/notes creates a sticky note"""
        note_data = {
            "text": f"TEST_Note {uuid.uuid4().hex[:6]}",
            "color": "bg-yellow-300",
            "pinned": False
        }
        
        response = parent_session.post(f"{BASE_URL}/api/hub/notes", json=note_data)
        assert response.status_code == 200, f"Failed to create note: {response.text}"
        
        data = response.json()
        assert 'note_id' in data, "Response should contain 'note_id'"
        assert data['text'] == note_data['text']
        assert data['color'] == note_data['color']
        
        print(f"✓ POST /api/hub/notes created note: {data['note_id']}")
        
        # Cleanup
        parent_session.delete(f"{BASE_URL}/api/hub/notes/{data['note_id']}")
    
    def test_delete_hub_note(self, parent_session):
        """Test DELETE /api/hub/notes/{id} deletes a note"""
        # First create a note
        note_data = {"text": f"TEST_Delete {uuid.uuid4().hex[:6]}", "color": "bg-pink-300"}
        create_response = parent_session.post(f"{BASE_URL}/api/hub/notes", json=note_data)
        assert create_response.status_code == 200
        note_id = create_response.json()['note_id']
        
        # Delete the note
        response = parent_session.delete(f"{BASE_URL}/api/hub/notes/{note_id}")
        assert response.status_code == 200, f"Failed to delete note: {response.text}"
        
        data = response.json()
        assert data['message'] == 'Note deleted'
        
        print(f"✓ DELETE /api/hub/notes/{note_id} deleted note")


class TestHubThemesAPI:
    """Tests for Hub Themes - GET /api/hub/themes, PUT /api/hub/theme, GET /api/hub/settings"""
    
    @pytest.fixture
    def parent_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_get_hub_themes_returns_200(self, parent_session):
        """Test GET /api/hub/themes returns available themes"""
        response = parent_session.get(f"{BASE_URL}/api/hub/themes")
        assert response.status_code == 200, f"Failed to get hub themes: {response.text}"
        
        data = response.json()
        assert 'themes' in data, "Response should contain 'themes' key"
        assert len(data['themes']) > 0, "Should have at least one theme"
        
        # Verify theme structure
        theme = data['themes'][0]
        assert 'id' in theme
        assert 'name' in theme
        assert 'preview' in theme
        
        print(f"✓ GET /api/hub/themes returns {len(data['themes'])} themes")
    
    def test_set_hub_theme(self, parent_session):
        """Test PUT /api/hub/theme sets the hub theme"""
        response = parent_session.put(
            f"{BASE_URL}/api/hub/theme",
            json={"theme": "ocean"}
        )
        assert response.status_code == 200, f"Failed to set hub theme: {response.text}"
        
        data = response.json()
        assert data['success'] == True
        assert data['theme'] == 'ocean'
        
        print(f"✓ PUT /api/hub/theme set theme to 'ocean'")
        
        # Reset to classic
        parent_session.put(f"{BASE_URL}/api/hub/theme", json={"theme": "classic"})
    
    def test_get_hub_settings(self, parent_session):
        """Test GET /api/hub/settings returns hub settings"""
        response = parent_session.get(f"{BASE_URL}/api/hub/settings")
        assert response.status_code == 200, f"Failed to get hub settings: {response.text}"
        
        data = response.json()
        assert 'theme' in data, "Response should contain 'theme' key"
        
        print(f"✓ GET /api/hub/settings returns theme: {data['theme']}")


class TestRecipesAPI:
    """Tests for Recipes (Meal Planning) - GET/POST/DELETE /api/recipes"""
    
    @pytest.fixture
    def parent_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_get_recipes_returns_200(self, parent_session):
        """Test GET /api/recipes returns 200"""
        response = parent_session.get(f"{BASE_URL}/api/recipes")
        assert response.status_code == 200, f"Failed to get recipes: {response.text}"
        
        data = response.json()
        assert 'recipes' in data, "Response should contain 'recipes' key"
        print(f"✓ GET /api/recipes returns {len(data['recipes'])} recipes")
    
    def test_create_recipe(self, parent_session):
        """Test POST /api/recipes creates a recipe"""
        recipe_data = {
            "name": f"TEST_Pasta {uuid.uuid4().hex[:6]}",
            "category": "dinner",
            "prep_time": "15 min",
            "cook_time": "20 min",
            "ingredients": ["Pasta", "Tomato sauce", "Cheese"],
            "steps": ["Boil pasta", "Add sauce", "Top with cheese"],
            "servings": 4
        }
        
        response = parent_session.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert response.status_code == 200, f"Failed to create recipe: {response.text}"
        
        data = response.json()
        assert 'recipe_id' in data, "Response should contain 'recipe_id'"
        assert data['name'] == recipe_data['name']
        assert len(data['ingredients']) == 3
        assert len(data['steps']) == 3
        
        print(f"✓ POST /api/recipes created recipe: {data['recipe_id']}")
        
        # Cleanup
        parent_session.delete(f"{BASE_URL}/api/recipes/{data['recipe_id']}")
    
    def test_recipe_to_shopping(self, parent_session):
        """Test POST /api/recipes/{id}/to-shopping adds ingredients to shopping list"""
        # First create a recipe
        recipe_data = {
            "name": f"TEST_Shopping Recipe {uuid.uuid4().hex[:6]}",
            "category": "dinner",
            "ingredients": ["TEST_Ingredient1", "TEST_Ingredient2"],
            "steps": ["Step 1"],
            "servings": 2
        }
        create_response = parent_session.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert create_response.status_code == 200
        recipe_id = create_response.json()['recipe_id']
        
        # Add to shopping
        response = parent_session.post(f"{BASE_URL}/api/recipes/{recipe_id}/to-shopping")
        assert response.status_code == 200, f"Failed to add to shopping: {response.text}"
        
        data = response.json()
        assert 'added' in data
        assert data['added'] == 2
        
        print(f"✓ POST /api/recipes/{recipe_id}/to-shopping added {data['added']} ingredients")
        
        # Cleanup
        parent_session.delete(f"{BASE_URL}/api/recipes/{recipe_id}")
    
    def test_delete_recipe(self, parent_session):
        """Test DELETE /api/recipes/{id} deletes a recipe"""
        # First create a recipe
        recipe_data = {
            "name": f"TEST_Delete Recipe {uuid.uuid4().hex[:6]}",
            "category": "lunch",
            "ingredients": ["Delete me"],
            "steps": ["Delete step"],
            "servings": 1
        }
        create_response = parent_session.post(f"{BASE_URL}/api/recipes", json=recipe_data)
        assert create_response.status_code == 200
        recipe_id = create_response.json()['recipe_id']
        
        # Delete the recipe
        response = parent_session.delete(f"{BASE_URL}/api/recipes/{recipe_id}")
        assert response.status_code == 200, f"Failed to delete recipe: {response.text}"
        
        data = response.json()
        assert data['message'] == 'Recipe deleted'
        
        print(f"✓ DELETE /api/recipes/{recipe_id} deleted recipe")


class TestEventMoveAPI:
    """Tests for Calendar Drag & Drop - PUT /api/events/{id}/move"""
    
    @pytest.fixture
    def parent_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_move_event(self, parent_session):
        """Test PUT /api/events/{id}/move moves an event to a new date"""
        # First create an event
        event_data = {
            "title": f"TEST_Move Event {uuid.uuid4().hex[:6]}",
            "event_date": "2026-03-28",
            "event_type": "appointment"
        }
        create_response = parent_session.post(f"{BASE_URL}/api/events", json=event_data)
        assert create_response.status_code == 200, f"Failed to create event: {create_response.text}"
        event_id = create_response.json()['event_id']
        
        # Move the event
        response = parent_session.put(
            f"{BASE_URL}/api/events/{event_id}/move",
            json={"new_date": "2026-03-30"}
        )
        assert response.status_code == 200, f"Failed to move event: {response.text}"
        
        data = response.json()
        assert 'event' in data
        assert data['event']['event_date'] == '2026-03-30'
        
        print(f"✓ PUT /api/events/{event_id}/move moved event to 2026-03-30")
        
        # Cleanup - delete the event
        parent_session.delete(f"{BASE_URL}/api/events/{event_id}")
    
    def test_move_event_missing_date_returns_400(self, parent_session):
        """Test PUT /api/events/{id}/move returns 400 if new_date is missing"""
        response = parent_session.put(
            f"{BASE_URL}/api/events/fake_event_id/move",
            json={}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ PUT /api/events/move returns 400 when new_date is missing")


class TestPushNotificationsAPI:
    """Tests for Push Notifications - POST /api/push/subscribe, DELETE /api/push/unsubscribe"""
    
    @pytest.fixture
    def parent_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_push_subscribe(self, parent_session):
        """Test POST /api/push/subscribe subscribes to push notifications"""
        subscription_data = {
            "subscription": {
                "endpoint": f"https://test.push.endpoint/{uuid.uuid4().hex}",
                "keys": {
                    "p256dh": "test_p256dh_key",
                    "auth": "test_auth_key"
                }
            }
        }
        
        response = parent_session.post(f"{BASE_URL}/api/push/subscribe", json=subscription_data)
        assert response.status_code == 200, f"Failed to subscribe: {response.text}"
        
        data = response.json()
        assert data['success'] == True
        
        print(f"✓ POST /api/push/subscribe enabled push notifications")
    
    def test_push_unsubscribe(self, parent_session):
        """Test DELETE /api/push/unsubscribe unsubscribes from push notifications"""
        response = parent_session.delete(f"{BASE_URL}/api/push/unsubscribe")
        assert response.status_code == 200, f"Failed to unsubscribe: {response.text}"
        
        data = response.json()
        assert data['success'] == True
        
        print(f"✓ DELETE /api/push/unsubscribe disabled push notifications")


class TestFamilyMembersAPI:
    """Tests for Family Members - Elizabeth co-parent should appear"""
    
    @pytest.fixture
    def parent_session(self):
        """Login as Zachery (parent)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/dev-login",
            json={"email": ZACHERY_EMAIL, "role": "parent"}
        )
        assert response.status_code == 200
        data = response.json()
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_family_members_includes_elizabeth(self, parent_session):
        """Test GET /api/family/members includes Elizabeth (co-parent)"""
        response = parent_session.get(f"{BASE_URL}/api/family/members")
        assert response.status_code == 200, f"Failed to get family members: {response.text}"
        
        data = response.json()
        assert 'members' in data, "Response should contain 'members' key"
        
        # Find Elizabeth in the members list
        elizabeth = next((m for m in data['members'] if m.get('email') == ELIZABETH_EMAIL), None)
        assert elizabeth is not None, f"Elizabeth not found in family members. Members: {[m.get('email') for m in data['members']]}"
        assert elizabeth['role'] == 'parent', f"Elizabeth should have role 'parent', got '{elizabeth['role']}'"
        
        print(f"✓ GET /api/family/members includes Elizabeth (co-parent) with role='parent'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

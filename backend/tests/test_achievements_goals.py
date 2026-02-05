"""
Test suite for Achievement System and Customizable Child Dashboard features
- Achievements: list all, user achievements, family achievements, seasonal
- Goals: CRUD operations, increment progress
- Shortcuts: get and update
- Dashboard config: get config
- Family Wall: create poll with string array options, vote on poll
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDevLogin:
    """Test Dev Login functionality"""
    
    def test_dev_login_parent(self):
        """Test parent dev login"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "parent"
        print(f"Parent login successful: {data['user']['name']}")
    
    def test_dev_login_child(self):
        """Test child dev login"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "child"
        print(f"Child login successful: {data['user']['name']}")


class TestAchievements:
    """Test Achievement System endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        data = response.json()
        self.session_token = data["session_token"]
        self.user_id = data["user"]["user_id"]
        self.headers = {"Authorization": f"Bearer {self.session_token}"}
    
    def test_get_all_achievements(self):
        """GET /api/achievements - list all achievements (23 total)"""
        response = requests.get(f"{BASE_URL}/api/achievements", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "achievements" in data
        achievements = data["achievements"]
        print(f"Total achievements: {len(achievements)}")
        # Verify we have achievements
        assert len(achievements) > 0
        # Check achievement structure
        if achievements:
            first = achievements[0]
            assert "achievement_id" in first
            assert "name" in first
            assert "description" in first
            assert "icon" in first
            assert "category" in first
            print(f"Sample achievement: {first['name']} ({first['category']})")
    
    def test_get_user_achievements(self):
        """GET /api/achievements/user/{user_id} - get user achievements with progress"""
        response = requests.get(f"{BASE_URL}/api/achievements/user/{self.user_id}", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "achievements" in data
        assert "stats" in data
        # Check stats structure
        stats = data["stats"]
        print(f"User stats: {stats}")
        # Check achievements have progress info
        achievements = data["achievements"]
        if achievements:
            first = achievements[0]
            assert "progress" in first or "earned" in first
            print(f"User has {len(achievements)} achievements tracked")
    
    def test_get_family_achievements(self):
        """GET /api/achievements/family - get family achievements"""
        response = requests.get(f"{BASE_URL}/api/achievements/family", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "achievements" in data
        assert "family_stats" in data
        print(f"Family achievements: {len(data['achievements'])}")
        print(f"Family stats: {data['family_stats']}")
    
    def test_get_seasonal_achievements(self):
        """GET /api/achievements/seasonal - get seasonal challenges"""
        response = requests.get(f"{BASE_URL}/api/achievements/seasonal", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        # Should have default_challenges or custom_challenges
        assert "default_challenges" in data or "custom_challenges" in data
        print(f"Seasonal data: {data}")
    
    def test_check_achievements(self):
        """POST /api/achievements/check - check and award new achievements"""
        response = requests.post(f"{BASE_URL}/api/achievements/check", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "newly_earned" in data
        print(f"Newly earned achievements: {data['newly_earned']}")
    
    def test_achievements_no_auth(self):
        """Test achievements endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/achievements")
        assert response.status_code == 401


class TestGoals:
    """Test Personal Goals CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        assert response.status_code == 200
        data = response.json()
        self.session_token = data["session_token"]
        self.user_id = data["user"]["user_id"]
        self.headers = {"Authorization": f"Bearer {self.session_token}"}
    
    def test_get_goals_empty(self):
        """GET /api/goals - get user's personal goals"""
        response = requests.get(f"{BASE_URL}/api/goals", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "goals" in data
        print(f"Current goals count: {len(data['goals'])}")
    
    def test_create_goal(self):
        """POST /api/goals - create a new personal goal"""
        goal_data = {
            "title": f"TEST_Read 5 books_{uuid.uuid4().hex[:6]}",
            "description": "Read 5 books this month",
            "target": 5,
            "type": "books"
        }
        response = requests.post(f"{BASE_URL}/api/goals", headers=self.headers, json=goal_data)
        assert response.status_code == 200
        data = response.json()
        assert "goal_id" in data
        assert data["title"] == goal_data["title"]
        assert data["target"] == goal_data["target"]
        assert data["current"] == 0
        assert data["completed"] == False
        print(f"Created goal: {data['goal_id']}")
        return data["goal_id"]
    
    def test_create_and_get_goal(self):
        """Create goal and verify it appears in GET"""
        # Create
        goal_data = {
            "title": f"TEST_Complete 10 chores_{uuid.uuid4().hex[:6]}",
            "description": "Complete 10 chores",
            "target": 10,
            "type": "chores"
        }
        create_res = requests.post(f"{BASE_URL}/api/goals", headers=self.headers, json=goal_data)
        assert create_res.status_code == 200
        created = create_res.json()
        goal_id = created["goal_id"]
        
        # Get and verify
        get_res = requests.get(f"{BASE_URL}/api/goals", headers=self.headers)
        assert get_res.status_code == 200
        goals = get_res.json()["goals"]
        found = [g for g in goals if g["goal_id"] == goal_id]
        assert len(found) == 1
        assert found[0]["title"] == goal_data["title"]
        print(f"Goal verified in list: {goal_id}")
    
    def test_increment_goal_progress(self):
        """POST /api/goals/{goal_id}/increment - increment goal progress"""
        # Create a goal first
        goal_data = {
            "title": f"TEST_Increment test_{uuid.uuid4().hex[:6]}",
            "target": 3,
            "type": "custom"
        }
        create_res = requests.post(f"{BASE_URL}/api/goals", headers=self.headers, json=goal_data)
        assert create_res.status_code == 200
        goal_id = create_res.json()["goal_id"]
        
        # Increment progress
        inc_res = requests.post(f"{BASE_URL}/api/goals/{goal_id}/increment", headers=self.headers)
        assert inc_res.status_code == 200
        data = inc_res.json()
        assert data["current"] == 1
        assert data["completed"] == False
        print(f"Goal progress: {data['current']}/{data['target']}")
        
        # Increment again
        inc_res2 = requests.post(f"{BASE_URL}/api/goals/{goal_id}/increment", headers=self.headers)
        assert inc_res2.status_code == 200
        assert inc_res2.json()["current"] == 2
        
        # Increment to complete
        inc_res3 = requests.post(f"{BASE_URL}/api/goals/{goal_id}/increment", headers=self.headers)
        assert inc_res3.status_code == 200
        data3 = inc_res3.json()
        assert data3["current"] == 3
        assert data3["completed"] == True
        print(f"Goal completed: {data3['completed']}")
    
    def test_update_goal(self):
        """PUT /api/goals/{goal_id} - update a goal"""
        # Create a goal first
        goal_data = {
            "title": f"TEST_Update test_{uuid.uuid4().hex[:6]}",
            "target": 5,
            "type": "custom"
        }
        create_res = requests.post(f"{BASE_URL}/api/goals", headers=self.headers, json=goal_data)
        assert create_res.status_code == 200
        goal_id = create_res.json()["goal_id"]
        
        # Update the goal
        update_data = {
            "title": "Updated Goal Title",
            "target": 10
        }
        update_res = requests.put(f"{BASE_URL}/api/goals/{goal_id}", headers=self.headers, json=update_data)
        assert update_res.status_code == 200
        data = update_res.json()
        assert data["title"] == "Updated Goal Title"
        assert data["target"] == 10
        print(f"Goal updated: {data['title']}")
    
    def test_delete_goal(self):
        """DELETE /api/goals/{goal_id} - delete a goal"""
        # Create a goal first
        goal_data = {
            "title": f"TEST_Delete test_{uuid.uuid4().hex[:6]}",
            "target": 1,
            "type": "custom"
        }
        create_res = requests.post(f"{BASE_URL}/api/goals", headers=self.headers, json=goal_data)
        assert create_res.status_code == 200
        goal_id = create_res.json()["goal_id"]
        
        # Delete the goal
        delete_res = requests.delete(f"{BASE_URL}/api/goals/{goal_id}", headers=self.headers)
        assert delete_res.status_code == 200
        
        # Verify it's gone
        get_res = requests.get(f"{BASE_URL}/api/goals", headers=self.headers)
        goals = get_res.json()["goals"]
        found = [g for g in goals if g["goal_id"] == goal_id]
        assert len(found) == 0
        print(f"Goal deleted successfully: {goal_id}")
    
    def test_goals_no_auth(self):
        """Test goals endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/goals")
        assert response.status_code == 401


class TestShortcuts:
    """Test Quick Shortcuts functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        assert response.status_code == 200
        data = response.json()
        self.session_token = data["session_token"]
        self.headers = {"Authorization": f"Bearer {self.session_token}"}
    
    def test_get_shortcuts(self):
        """GET /api/shortcuts - get user's shortcuts"""
        response = requests.get(f"{BASE_URL}/api/shortcuts", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "active" in data
        assert "available" in data
        print(f"Active shortcuts: {len(data['active'])}")
        print(f"Available shortcuts: {len(data['available'])}")
        # Check structure
        if data["available"]:
            shortcut = data["available"][0]
            assert "id" in shortcut
            assert "name" in shortcut
            assert "icon" in shortcut
            assert "color" in shortcut
    
    def test_update_shortcuts(self):
        """PUT /api/shortcuts - update user's shortcuts"""
        new_shortcuts = ["chat", "rewards", "achievements", "calendar"]
        response = requests.put(
            f"{BASE_URL}/api/shortcuts",
            headers=self.headers,
            json={"shortcuts": new_shortcuts}
        )
        assert response.status_code == 200
        data = response.json()
        assert "shortcuts" in data
        assert data["shortcuts"] == new_shortcuts
        print(f"Updated shortcuts: {data['shortcuts']}")
    
    def test_shortcuts_max_limit(self):
        """Test shortcuts are limited to 6 max"""
        many_shortcuts = ["chat", "rewards", "achievements", "calendar", "shopping", "reading", "dinner", "family_wall"]
        response = requests.put(
            f"{BASE_URL}/api/shortcuts",
            headers=self.headers,
            json={"shortcuts": many_shortcuts}
        )
        assert response.status_code == 200
        data = response.json()
        # Should be limited to 6
        assert len(data["shortcuts"]) <= 6
        print(f"Shortcuts limited to: {len(data['shortcuts'])}")


class TestDashboardConfig:
    """Test Dashboard Configuration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "child"})
        assert response.status_code == 200
        data = response.json()
        self.session_token = data["session_token"]
        self.headers = {"Authorization": f"Bearer {self.session_token}"}
    
    def test_get_dashboard_config(self):
        """GET /api/dashboard/config - get dashboard configuration"""
        response = requests.get(f"{BASE_URL}/api/dashboard/config", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        # Config should have user_id and shortcuts at minimum
        assert "user_id" in data
        # May have sections (default) or shortcuts (if previously configured)
        has_sections = "sections" in data
        has_shortcuts = "shortcuts" in data
        assert has_sections or has_shortcuts, "Config should have sections or shortcuts"
        print(f"Dashboard config: {data}")


class TestFamilyWallPolls:
    """Test Family Wall poll creation and voting"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        assert response.status_code == 200
        data = response.json()
        self.session_token = data["session_token"]
        self.user_id = data["user"]["user_id"]
        self.headers = {"Authorization": f"Bearer {self.session_token}"}
    
    def test_create_poll_with_string_options(self):
        """POST /api/family-wall - create poll with string array options"""
        poll_data = {
            "content": f"TEST_What should we have for dinner?_{uuid.uuid4().hex[:6]}",
            "type": "poll",
            "poll_options": ["Pizza", "Tacos", "Pasta", "Sushi"]  # String array
        }
        response = requests.post(f"{BASE_URL}/api/family-wall", headers=self.headers, json=poll_data)
        assert response.status_code == 200
        data = response.json()
        assert "post_id" in data
        assert data["type"] == "poll"
        assert "poll_options" in data
        # Verify options were converted to objects
        options = data["poll_options"]
        assert len(options) == 4
        for opt in options:
            assert "text" in opt
            assert "votes" in opt
            assert isinstance(opt["votes"], list)
        print(f"Poll created: {data['post_id']}")
        print(f"Options: {[o['text'] for o in options]}")
        return data["post_id"]
    
    def test_vote_on_poll(self):
        """POST /api/family-wall/{post_id}/vote - vote on poll"""
        # Create a poll first
        poll_data = {
            "content": f"TEST_Vote test poll_{uuid.uuid4().hex[:6]}",
            "type": "poll",
            "poll_options": ["Option A", "Option B", "Option C"]
        }
        create_res = requests.post(f"{BASE_URL}/api/family-wall", headers=self.headers, json=poll_data)
        assert create_res.status_code == 200
        post_id = create_res.json()["post_id"]
        
        # Vote on option 1 (index 1)
        vote_res = requests.post(
            f"{BASE_URL}/api/family-wall/{post_id}/vote",
            headers=self.headers,
            json={"option_index": 1}
        )
        assert vote_res.status_code == 200
        data = vote_res.json()
        assert "poll_options" in data
        # Verify vote was recorded
        options = data["poll_options"]
        assert self.user_id in options[1]["votes"]
        assert "user_voted_option" in data
        assert data["user_voted_option"] == 1
        print(f"Voted on option: {options[1]['text']}")
    
    def test_cannot_vote_twice(self):
        """Test that user cannot vote twice on same poll"""
        # Create a poll
        poll_data = {
            "content": f"TEST_Double vote test_{uuid.uuid4().hex[:6]}",
            "type": "poll",
            "poll_options": ["Yes", "No"]
        }
        create_res = requests.post(f"{BASE_URL}/api/family-wall", headers=self.headers, json=poll_data)
        post_id = create_res.json()["post_id"]
        
        # First vote
        vote_res1 = requests.post(
            f"{BASE_URL}/api/family-wall/{post_id}/vote",
            headers=self.headers,
            json={"option_index": 0}
        )
        assert vote_res1.status_code == 200
        
        # Second vote should fail
        vote_res2 = requests.post(
            f"{BASE_URL}/api/family-wall/{post_id}/vote",
            headers=self.headers,
            json={"option_index": 1}
        )
        assert vote_res2.status_code == 400
        assert "Already voted" in vote_res2.json().get("detail", "")
        print("Double vote correctly rejected")
    
    def test_invalid_vote_option(self):
        """Test voting with invalid option index"""
        # Create a poll
        poll_data = {
            "content": f"TEST_Invalid vote test_{uuid.uuid4().hex[:6]}",
            "type": "poll",
            "poll_options": ["A", "B"]
        }
        create_res = requests.post(f"{BASE_URL}/api/family-wall", headers=self.headers, json=poll_data)
        post_id = create_res.json()["post_id"]
        
        # Vote with invalid index
        vote_res = requests.post(
            f"{BASE_URL}/api/family-wall/{post_id}/vote",
            headers=self.headers,
            json={"option_index": 99}
        )
        assert vote_res.status_code == 400
        print("Invalid option index correctly rejected")
    
    def test_get_family_wall_shows_user_vote(self):
        """GET /api/family-wall - verify user_voted_option is included"""
        # Create and vote on a poll
        poll_data = {
            "content": f"TEST_User vote display_{uuid.uuid4().hex[:6]}",
            "type": "poll",
            "poll_options": ["Red", "Blue", "Green"]
        }
        create_res = requests.post(f"{BASE_URL}/api/family-wall", headers=self.headers, json=poll_data)
        post_id = create_res.json()["post_id"]
        
        # Vote
        requests.post(
            f"{BASE_URL}/api/family-wall/{post_id}/vote",
            headers=self.headers,
            json={"option_index": 2}
        )
        
        # Get family wall and check
        get_res = requests.get(f"{BASE_URL}/api/family-wall", headers=self.headers)
        assert get_res.status_code == 200
        posts = get_res.json()["posts"]
        poll = [p for p in posts if p["post_id"] == post_id][0]
        assert "user_voted_option" in poll
        assert poll["user_voted_option"] == 2
        print(f"User vote displayed correctly: option {poll['user_voted_option']}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/dev-login", json={"role": "parent"})
        self.session_token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.session_token}"}
    
    def test_cleanup_test_goals(self):
        """Clean up TEST_ prefixed goals"""
        # Get all goals
        response = requests.get(f"{BASE_URL}/api/goals", headers=self.headers)
        if response.status_code == 200:
            goals = response.json().get("goals", [])
            for goal in goals:
                if goal.get("title", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/goals/{goal['goal_id']}", headers=self.headers)
                    print(f"Deleted test goal: {goal['goal_id']}")
        print("Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

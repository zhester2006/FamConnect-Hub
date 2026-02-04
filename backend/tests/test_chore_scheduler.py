"""
Test suite for Chore Scheduler feature (Iteration 8)
Tests drag-and-drop chore scheduling functionality
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
PARENT_SESSION = None
CHILD_USER_ID = None
FAMILY_ID = None


class TestChoreSchedulerSetup:
    """Setup tests - create test users and sessions"""
    
    @pytest.fixture(autouse=True, scope="class")
    def setup_test_data(self):
        """Create test parent and child users with session"""
        global PARENT_SESSION, CHILD_USER_ID, FAMILY_ID
        
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            
            // Create or find test parent
            var parentUserId = 'test_scheduler_parent_' + Date.now();
            var familyId = 'test_scheduler_family_' + Date.now();
            var sessionToken = 'test_scheduler_session_' + Date.now();
            var childUserId = 'test_scheduler_child_' + Date.now();
            
            db.users.insertOne({
                user_id: parentUserId,
                email: 'scheduler.parent@test.com',
                name: 'Scheduler Test Parent',
                role: 'parent',
                family_id: familyId,
                points: 0,
                created_at: new Date()
            });
            
            db.users.insertOne({
                user_id: childUserId,
                email: 'scheduler.child@test.com',
                name: 'Scheduler Test Child',
                nickname: 'TestKid',
                role: 'child',
                family_id: familyId,
                parent_id: parentUserId,
                points: 100,
                created_at: new Date()
            });
            
            db.user_sessions.insertOne({
                user_id: parentUserId,
                session_token: sessionToken,
                expires_at: new Date(Date.now() + 7*24*60*60*1000),
                created_at: new Date()
            });
            
            print('SESSION=' + sessionToken);
            print('CHILD_ID=' + childUserId);
            print('FAMILY_ID=' + familyId);
            '''
        ], capture_output=True, text=True)
        
        for line in result.stdout.strip().split('\n'):
            if line.startswith('SESSION='):
                PARENT_SESSION = line.split('=')[1]
            elif line.startswith('CHILD_ID='):
                CHILD_USER_ID = line.split('=')[1]
            elif line.startswith('FAMILY_ID='):
                FAMILY_ID = line.split('=')[1]
        
        yield
        
        # Cleanup
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
            use('test_database');
            db.users.deleteMany({{family_id: '{FAMILY_ID}'}});
            db.user_sessions.deleteMany({{session_token: '{PARENT_SESSION}'}});
            db.chores.deleteMany({{family_id: /test_scheduler/}});
            '''
        ])


class TestChoreTypes:
    """Test chore types endpoint"""
    
    def test_get_chore_types_authenticated(self):
        """GET /api/chores/types - should return default chore types"""
        response = requests.get(
            f"{BASE_URL}/api/chores/types",
            cookies={"session_token": PARENT_SESSION}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "chore_types" in data
        assert len(data["chore_types"]) >= 10  # Default types
        
        # Verify structure of chore types
        for chore_type in data["chore_types"]:
            assert "name" in chore_type
            assert "points" in chore_type
            assert "description" in chore_type
        
        # Check for expected default chores
        chore_names = [ct["name"] for ct in data["chore_types"]]
        assert "Dishes" in chore_names
        assert "Vacuum" in chore_names
        assert "Make bed" in chore_names
    
    def test_get_chore_types_unauthenticated(self):
        """GET /api/chores/types - should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/chores/types")
        assert response.status_code == 401


class TestFamilyMembers:
    """Test family members endpoint for child selector"""
    
    def test_get_family_members(self):
        """GET /api/family/members - should return parent and children"""
        response = requests.get(
            f"{BASE_URL}/api/family/members",
            cookies={"session_token": PARENT_SESSION}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "members" in data
        assert len(data["members"]) >= 1
        
        # Check for child in members
        children = [m for m in data["members"] if m.get("role") == "child"]
        assert len(children) >= 1
        
        # Verify child has required fields
        child = children[0]
        assert "user_id" in child
        assert "name" in child
        assert "role" in child


class TestChoreCreation:
    """Test chore creation via POST /api/chores"""
    
    def test_create_chore_with_schedule(self):
        """POST /api/chores - create chore with scheduled_date"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_Scheduled_Dishes",
                "assigned_to": CHILD_USER_ID,
                "scheduled_date": today,
                "points": 10,
                "recurring": False
            },
            cookies={"session_token": PARENT_SESSION}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "chore_id" in data
        assert data["title"] == "TEST_Scheduled_Dishes"
        assert data["assigned_to"] == CHILD_USER_ID
        assert data["scheduled_date"] == today
        assert data["points"] == 10
        assert data["status"] == "pending"
    
    def test_create_chore_with_future_date(self):
        """POST /api/chores - create chore for future date"""
        future_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_Future_Vacuum",
                "assigned_to": CHILD_USER_ID,
                "scheduled_date": future_date,
                "points": 15,
                "recurring": False
            },
            cookies={"session_token": PARENT_SESSION}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["scheduled_date"] == future_date
        assert data["points"] == 15
    
    def test_create_multiple_chores_same_day(self):
        """POST /api/chores - create multiple chores for same day"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Create first chore
        response1 = requests.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_Morning_Chore",
                "assigned_to": CHILD_USER_ID,
                "scheduled_date": today,
                "points": 5
            },
            cookies={"session_token": PARENT_SESSION}
        )
        assert response1.status_code == 200
        
        # Create second chore
        response2 = requests.post(
            f"{BASE_URL}/api/chores",
            json={
                "title": "TEST_Evening_Chore",
                "assigned_to": CHILD_USER_ID,
                "scheduled_date": today,
                "points": 5
            },
            cookies={"session_token": PARENT_SESSION}
        )
        assert response2.status_code == 200
        
        # Verify both chores exist
        response = requests.get(
            f"{BASE_URL}/api/chores",
            cookies={"session_token": PARENT_SESSION}
        )
        data = response.json()
        
        test_chores = [c for c in data["chores"] if c["title"].startswith("TEST_")]
        assert len(test_chores) >= 2


class TestChoreRetrieval:
    """Test chore retrieval for scheduler display"""
    
    def test_get_chores_with_scheduled_date(self):
        """GET /api/chores - should return chores with scheduled_date"""
        response = requests.get(
            f"{BASE_URL}/api/chores",
            cookies={"session_token": PARENT_SESSION}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "chores" in data
        
        # Check that scheduled chores have required fields
        for chore in data["chores"]:
            assert "chore_id" in chore
            assert "title" in chore
            assert "status" in chore
            if chore.get("scheduled_date"):
                assert "assigned_to" in chore


class TestChoreSchedulerIntegration:
    """Integration tests for the full scheduler workflow"""
    
    def test_full_scheduler_workflow(self):
        """Test complete workflow: get types -> create chore -> verify"""
        # Step 1: Get chore types
        types_response = requests.get(
            f"{BASE_URL}/api/chores/types",
            cookies={"session_token": PARENT_SESSION}
        )
        assert types_response.status_code == 200
        chore_types = types_response.json()["chore_types"]
        
        # Step 2: Get family members (for child selector)
        members_response = requests.get(
            f"{BASE_URL}/api/family/members",
            cookies={"session_token": PARENT_SESSION}
        )
        assert members_response.status_code == 200
        members = members_response.json()["members"]
        children = [m for m in members if m.get("role") == "child"]
        
        # Step 3: Create a scheduled chore
        today = datetime.now().strftime("%Y-%m-%d")
        selected_chore = chore_types[0]  # First chore type
        selected_child = children[0] if children else None
        
        if selected_child:
            create_response = requests.post(
                f"{BASE_URL}/api/chores",
                json={
                    "title": selected_chore["name"],
                    "assigned_to": selected_child["user_id"],
                    "scheduled_date": today,
                    "points": selected_chore["points"],
                    "recurring": False
                },
                cookies={"session_token": PARENT_SESSION}
            )
            assert create_response.status_code == 200
            created_chore = create_response.json()
            
            # Step 4: Verify chore appears in list
            list_response = requests.get(
                f"{BASE_URL}/api/chores",
                cookies={"session_token": PARENT_SESSION}
            )
            assert list_response.status_code == 200
            chores = list_response.json()["chores"]
            
            found = any(c["chore_id"] == created_chore["chore_id"] for c in chores)
            assert found, "Created chore should appear in chores list"


class TestAuthenticationRequired:
    """Test that all scheduler endpoints require authentication"""
    
    def test_chores_requires_auth(self):
        """GET /api/chores - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/chores")
        assert response.status_code == 401
    
    def test_create_chore_requires_auth(self):
        """POST /api/chores - requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/chores",
            json={"title": "Test", "points": 10}
        )
        assert response.status_code == 401
    
    def test_family_members_requires_auth(self):
        """GET /api/family/members - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/family/members")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

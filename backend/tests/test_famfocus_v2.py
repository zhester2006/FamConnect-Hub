"""
FamFocus Hub API Tests - Version 2
Tests new features: Event types, Work schedules, Geofencing, Rewards CRUD, Notifications
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def session_token():
    """Get or create a test session token"""
    import subprocess
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', '''
        use('test_database');
        var session = db.user_sessions.findOne({user_id: 'user_parent001'});
        if (session) {
            print(session.session_token);
        } else {
            var token = 'test_session_' + Date.now();
            db.user_sessions.insertOne({
                user_id: 'user_parent001',
                session_token: token,
                expires_at: new Date(Date.now() + 7*24*60*60*1000),
                created_at: new Date()
            });
            print(token);
        }
        '''
    ], capture_output=True, text=True)
    token = result.stdout.strip().split('\n')[-1]
    return token

@pytest.fixture
def api_client(session_token):
    """Create API client with auth cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    session.cookies.set("session_token", session_token)
    return session


class TestEventTypes:
    """Test event types and filtering"""
    
    def test_create_event_with_type_appointment(self, api_client):
        """Test POST /api/events with event_type=appointment"""
        event_data = {
            "title": "TEST_Doctor Appointment",
            "event_date": datetime.now().date().isoformat(),
            "event_time": "10:30",
            "event_type": "appointment"
        }
        
        response = api_client.post(f"{BASE_URL}/api/events", json=event_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["title"] == "TEST_Doctor Appointment"
        assert data["event_type"] == "appointment"
        assert data["event_time"] == "10:30"
        assert "event_id" in data
        print(f"✓ Created appointment event: {data['event_id']}")
    
    def test_create_event_with_type_event(self, api_client):
        """Test POST /api/events with event_type=event"""
        event_data = {
            "title": "TEST_Birthday Party",
            "event_date": datetime.now().date().isoformat(),
            "event_time": "14:00",
            "event_type": "event"
        }
        
        response = api_client.post(f"{BASE_URL}/api/events", json=event_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["event_type"] == "event"
        print(f"✓ Created event type: {data['event_id']}")
    
    def test_create_event_with_type_task(self, api_client):
        """Test POST /api/events with event_type=task"""
        event_data = {
            "title": "TEST_Submit Report",
            "event_date": datetime.now().date().isoformat(),
            "event_time": "17:00",
            "event_type": "task"
        }
        
        response = api_client.post(f"{BASE_URL}/api/events", json=event_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["event_type"] == "task"
        print(f"✓ Created task event: {data['event_id']}")
    
    def test_filter_events_by_type(self, api_client):
        """Test GET /api/events?event_type=appointment filters correctly"""
        response = api_client.get(f"{BASE_URL}/api/events?event_type=appointment")
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        # All returned events should be appointments
        for event in data["events"]:
            assert event["event_type"] == "appointment", f"Expected appointment, got {event['event_type']}"
        print(f"✓ Filtered {len(data['events'])} appointment events")


class TestWorkSchedule:
    """Test work schedule feature"""
    
    def test_create_work_schedule_event(self, api_client):
        """Test POST /api/events with event_type=work_schedule"""
        event_data = {
            "title": "TEST_Work Shift",
            "event_date": datetime.now().date().isoformat(),
            "event_type": "work_schedule",
            "work_start_time": "09:00",
            "work_end_time": "17:00"
        }
        
        response = api_client.post(f"{BASE_URL}/api/events", json=event_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["event_type"] == "work_schedule"
        assert data["work_start_time"] == "09:00"
        assert data["work_end_time"] == "17:00"
        print(f"✓ Created work schedule: {data['work_start_time']} - {data['work_end_time']}")
    
    def test_create_work_schedule_via_dedicated_endpoint(self, api_client):
        """Test POST /api/events/work-schedule endpoint"""
        schedule_data = {
            "event_date": datetime.now().date().isoformat(),
            "start_time": "08:00",
            "end_time": "16:00",
            "description": "TEST_Morning shift"
        }
        
        response = api_client.post(f"{BASE_URL}/api/events/work-schedule", json=schedule_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["event_type"] == "work_schedule"
        assert data["work_start_time"] == "08:00"
        assert data["work_end_time"] == "16:00"
        print(f"✓ Created work schedule via dedicated endpoint")
    
    def test_filter_work_schedules(self, api_client):
        """Test GET /api/events?event_type=work_schedule"""
        response = api_client.get(f"{BASE_URL}/api/events?event_type=work_schedule")
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        for event in data["events"]:
            assert event["event_type"] == "work_schedule"
        print(f"✓ Filtered {len(data['events'])} work schedule events")


class TestGeofencing:
    """Test geofencing features"""
    
    def test_create_geofence(self, api_client):
        """Test POST /api/geofences creates geofence with radius_feet"""
        geofence_data = {
            "name": "TEST_Home",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "radius_feet": 50
        }
        
        response = api_client.post(f"{BASE_URL}/api/geofences", json=geofence_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST_Home"
        assert data["radius_feet"] == 50
        assert data["latitude"] == 40.7128
        assert data["longitude"] == -74.0060
        assert "geofence_id" in data
        print(f"✓ Created geofence: {data['name']} with {data['radius_feet']}ft radius")
        return data["geofence_id"]
    
    def test_get_geofences(self, api_client):
        """Test GET /api/geofences returns geofences"""
        response = api_client.get(f"{BASE_URL}/api/geofences")
        assert response.status_code == 200
        
        data = response.json()
        assert "geofences" in data
        assert isinstance(data["geofences"], list)
        print(f"✓ Retrieved {len(data['geofences'])} geofences")
    
    def test_delete_geofence(self, api_client):
        """Test DELETE /api/geofences/{id}"""
        # First create a geofence to delete
        geofence_data = {
            "name": "TEST_ToDelete",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "radius_feet": 100
        }
        create_response = api_client.post(f"{BASE_URL}/api/geofences", json=geofence_data)
        geofence_id = create_response.json()["geofence_id"]
        
        # Delete it
        response = api_client.delete(f"{BASE_URL}/api/geofences/{geofence_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print(f"✓ Deleted geofence: {geofence_id}")


class TestRewardsCRUD:
    """Test full rewards CRUD operations"""
    
    def test_create_reward(self, api_client):
        """Test POST /api/rewards creates reward"""
        reward_data = {
            "name": "TEST_Extra Screen Time",
            "description": "30 minutes extra screen time",
            "points_required": 50
        }
        
        response = api_client.post(f"{BASE_URL}/api/rewards", json=reward_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST_Extra Screen Time"
        assert data["points_required"] == 50
        assert "reward_id" in data
        print(f"✓ Created reward: {data['name']} ({data['points_required']} pts)")
        return data["reward_id"]
    
    def test_update_reward_points(self, api_client):
        """Test PUT /api/rewards/{id} updates reward points"""
        # First create a reward
        reward_data = {
            "name": "TEST_Movie Night",
            "description": "Family movie night",
            "points_required": 100
        }
        create_response = api_client.post(f"{BASE_URL}/api/rewards", json=reward_data)
        reward_id = create_response.json()["reward_id"]
        
        # Update points
        update_data = {
            "points_required": 75,
            "description": "Updated: Family movie night with popcorn"
        }
        response = api_client.put(f"{BASE_URL}/api/rewards/{reward_id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["points_required"] == 75
        assert "popcorn" in data["description"]
        print(f"✓ Updated reward points: {data['points_required']} pts")
    
    def test_delete_reward(self, api_client):
        """Test DELETE /api/rewards/{id}"""
        # First create a reward
        reward_data = {
            "name": "TEST_ToDelete",
            "points_required": 25
        }
        create_response = api_client.post(f"{BASE_URL}/api/rewards", json=reward_data)
        reward_id = create_response.json()["reward_id"]
        
        # Delete it
        response = api_client.delete(f"{BASE_URL}/api/rewards/{reward_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print(f"✓ Deleted reward: {reward_id}")
    
    def test_get_rewards(self, api_client):
        """Test GET /api/rewards returns all rewards"""
        response = api_client.get(f"{BASE_URL}/api/rewards")
        assert response.status_code == 200
        
        data = response.json()
        assert "rewards" in data
        assert isinstance(data["rewards"], list)
        print(f"✓ Retrieved {len(data['rewards'])} rewards")


class TestNotifications:
    """Test notification endpoints"""
    
    def test_get_notifications(self, api_client):
        """Test GET /api/notifications returns location alerts"""
        response = api_client.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        
        data = response.json()
        assert "notifications" in data
        assert isinstance(data["notifications"], list)
        print(f"✓ Retrieved {len(data['notifications'])} notifications")
    
    def test_report_gps_disabled(self, api_client):
        """Test POST /api/location/gps-disabled creates notification"""
        gps_data = {
            "last_latitude": 40.7128,
            "last_longitude": -74.0060
        }
        
        response = api_client.post(f"{BASE_URL}/api/location/gps-disabled", json=gps_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print(f"✓ GPS disabled notification created")


class TestChorePointsModification:
    """Test parent can modify points when approving chores"""
    
    def test_approve_chore_with_modified_points(self, api_client):
        """Test PUT /api/chores/{id}/approve with modified points"""
        # First create a chore
        today = datetime.now().date().isoformat()
        chore_data = {
            "title": "TEST_Chore for points test",
            "scheduled_date": today,
            "points": 10
        }
        create_response = api_client.post(f"{BASE_URL}/api/chores", json=chore_data)
        chore_id = create_response.json()["chore_id"]
        
        # Complete the chore
        api_client.put(f"{BASE_URL}/api/chores/{chore_id}/complete")
        
        # Approve with modified points
        approve_data = {
            "approved": True,
            "points": 25  # Modified from 10 to 25
        }
        response = api_client.put(f"{BASE_URL}/api/chores/{chore_id}/approve", json=approve_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "approved"
        assert data["points"] == 25
        print(f"✓ Approved chore with modified points: {data['points']} pts")


class TestCheckins:
    """Test check-in/location endpoints"""
    
    def test_create_checkin(self, api_client):
        """Test POST /api/checkins creates location checkin"""
        checkin_data = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "address": "TEST_New York, NY"
        }
        
        response = api_client.post(f"{BASE_URL}/api/checkins", json=checkin_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["latitude"] == 40.7128
        assert data["longitude"] == -74.0060
        assert "checkin_id" in data
        print(f"✓ Created checkin: {data['checkin_id']}")


# Cleanup test data after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after tests"""
    yield
    # Cleanup after tests
    import subprocess
    subprocess.run([
        'mongosh', '--quiet', '--eval', '''
        use('test_database');
        db.events.deleteMany({title: /^TEST_/});
        db.geofences.deleteMany({name: /^TEST_/});
        db.rewards.deleteMany({name: /^TEST_/});
        db.chores.deleteMany({title: /^TEST_/});
        db.checkins.deleteMany({address: /^TEST_/});
        print('Test data cleaned up');
        '''
    ], capture_output=True, text=True)

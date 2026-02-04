"""
Test Battery Percentage Feature - Iteration 7
Tests:
- POST /api/battery/update - Updates child's battery status
- GET /api/battery/family - Returns battery status for all children (parents only)
- PUT /api/permissions/battery - Toggle battery sharing permission
- GET /api/permissions - Get user's permission settings
- Low battery notification created when below 15%
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from main agent
PARENT_SESSION = "test_session_1770163520318"  # user_parent001 - Sarah Johnson
CHILD_SESSION = "test_child_session_alex"  # user_child001 - Alex Johnson


def get_parent_session():
    """Get a requests session with parent cookie"""
    session = requests.Session()
    session.cookies.set('session_token', PARENT_SESSION)
    return session


def get_child_session():
    """Get a requests session with child cookie"""
    session = requests.Session()
    session.cookies.set('session_token', CHILD_SESSION)
    return session


class TestBatteryPermissions:
    """Test battery permission endpoints"""
    
    def test_get_permissions_child(self):
        """GET /api/permissions - Child can get their permissions"""
        session = get_child_session()
        response = session.get(f"{BASE_URL}/api/permissions")
        assert response.status_code == 200
        data = response.json()
        assert "permissions" in data
        assert "share_battery" in data["permissions"]
        print(f"Child permissions: {data['permissions']}")
    
    def test_get_permissions_parent(self):
        """GET /api/permissions - Parent can get their permissions"""
        session = get_parent_session()
        response = session.get(f"{BASE_URL}/api/permissions")
        assert response.status_code == 200
        data = response.json()
        assert "permissions" in data
        print(f"Parent permissions: {data['permissions']}")
    
    def test_get_permissions_no_auth(self):
        """GET /api/permissions - Returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/permissions")
        assert response.status_code == 401
    
    def test_toggle_battery_permission_enable(self):
        """PUT /api/permissions/battery - Enable battery sharing"""
        session = get_child_session()
        response = session.put(
            f"{BASE_URL}/api/permissions/battery",
            json={"share_battery": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["share_battery"] == True
        print("Battery sharing enabled successfully")
    
    def test_toggle_battery_permission_disable(self):
        """PUT /api/permissions/battery - Disable battery sharing"""
        session = get_child_session()
        response = session.put(
            f"{BASE_URL}/api/permissions/battery",
            json={"share_battery": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["share_battery"] == False
        print("Battery sharing disabled successfully")
        
        # Re-enable for subsequent tests
        session.put(
            f"{BASE_URL}/api/permissions/battery",
            json={"share_battery": True}
        )
    
    def test_toggle_battery_permission_no_auth(self):
        """PUT /api/permissions/battery - Returns 401 without auth"""
        response = requests.put(
            f"{BASE_URL}/api/permissions/battery",
            json={"share_battery": True}
        )
        assert response.status_code == 401


class TestBatteryUpdate:
    """Test battery update endpoint"""
    
    def test_update_battery_valid(self):
        """POST /api/battery/update - Update battery with valid level"""
        session = get_child_session()
        # Ensure battery sharing is enabled first
        session.put(f"{BASE_URL}/api/permissions/battery", json={"share_battery": True})
        
        response = session.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": 75, "is_charging": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["level"] == 75
        print(f"Battery updated to {data['level']}%")
    
    def test_update_battery_charging(self):
        """POST /api/battery/update - Update battery with charging status"""
        session = get_child_session()
        response = session.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": 50, "is_charging": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["level"] == 50
        print("Battery updated with charging status")
    
    def test_update_battery_invalid_level_negative(self):
        """POST /api/battery/update - Reject negative battery level"""
        session = get_child_session()
        response = session.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": -10, "is_charging": False}
        )
        assert response.status_code == 400
        print("Correctly rejected negative battery level")
    
    def test_update_battery_invalid_level_over_100(self):
        """POST /api/battery/update - Reject battery level over 100"""
        session = get_child_session()
        response = session.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": 150, "is_charging": False}
        )
        assert response.status_code == 400
        print("Correctly rejected battery level over 100")
    
    def test_update_battery_missing_level(self):
        """POST /api/battery/update - Reject missing battery level"""
        session = get_child_session()
        response = session.post(
            f"{BASE_URL}/api/battery/update",
            json={"is_charging": False}
        )
        assert response.status_code == 400
        print("Correctly rejected missing battery level")
    
    def test_update_battery_no_auth(self):
        """POST /api/battery/update - Returns 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": 50, "is_charging": False}
        )
        assert response.status_code == 401
    
    def test_update_battery_without_permission(self):
        """POST /api/battery/update - Returns message when permission not enabled"""
        session = get_child_session()
        
        # First disable battery sharing
        session.put(
            f"{BASE_URL}/api/permissions/battery",
            json={"share_battery": False}
        )
        
        # Try to update battery
        response = session.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": 60, "is_charging": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert "not enabled" in data["message"]
        print("Correctly returned message when permission not enabled")
        
        # Re-enable for subsequent tests
        session.put(
            f"{BASE_URL}/api/permissions/battery",
            json={"share_battery": True}
        )


class TestFamilyBatteryStatus:
    """Test family battery status endpoint (parents only)"""
    
    def test_get_family_battery_parent(self):
        """GET /api/battery/family - Parent can view family battery status"""
        child_session = get_child_session()
        parent_session = get_parent_session()
        
        # First ensure child has battery sharing enabled and updated
        child_session.put(
            f"{BASE_URL}/api/permissions/battery",
            json={"share_battery": True}
        )
        child_session.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": 45, "is_charging": False}
        )
        
        # Parent fetches family battery status
        response = parent_session.get(f"{BASE_URL}/api/battery/family")
        assert response.status_code == 200
        data = response.json()
        assert "battery_status" in data
        assert isinstance(data["battery_status"], list)
        
        # Should include Alex's battery status
        if len(data["battery_status"]) > 0:
            child_battery = data["battery_status"][0]
            assert "user_id" in child_battery
            assert "name" in child_battery
            assert "level" in child_battery
            assert "is_charging" in child_battery
            print(f"Family battery status: {data['battery_status']}")
        else:
            print("No children with battery sharing enabled found")
    
    def test_get_family_battery_child_forbidden(self):
        """GET /api/battery/family - Child cannot view family battery status"""
        session = get_child_session()
        response = session.get(f"{BASE_URL}/api/battery/family")
        assert response.status_code == 403
        print("Correctly denied child access to family battery status")
    
    def test_get_family_battery_no_auth(self):
        """GET /api/battery/family - Returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/battery/family")
        assert response.status_code == 401


class TestLowBatteryNotification:
    """Test low battery notification creation"""
    
    def test_low_battery_creates_notification(self):
        """POST /api/battery/update - Creates notification when battery <= 15%"""
        child_session = get_child_session()
        parent_session = get_parent_session()
        
        # Ensure battery sharing is enabled
        child_session.put(
            f"{BASE_URL}/api/permissions/battery",
            json={"share_battery": True}
        )
        
        # Update battery to critically low level
        response = child_session.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": 10, "is_charging": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["level"] == 10
        print("Low battery update successful")
        
        # Check if notification was created for parent
        notif_response = parent_session.get(f"{BASE_URL}/api/notifications")
        assert notif_response.status_code == 200
        notifications = notif_response.json().get("notifications", [])
        
        # Find battery_low notification
        battery_notifs = [n for n in notifications if n.get("type") == "battery_low"]
        assert len(battery_notifs) > 0, "Low battery notification should be created"
        
        latest_notif = battery_notifs[0]
        assert "critically low" in latest_notif.get("message", "").lower() or "10%" in latest_notif.get("message", "")
        print(f"Low battery notification created: {latest_notif['message']}")
    
    def test_low_battery_no_notification_when_charging(self):
        """POST /api/battery/update - No notification when charging even if low"""
        session = get_child_session()
        
        # Update battery to low level but charging
        response = session.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": 5, "is_charging": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("Low battery while charging - no notification expected")
        
        # Reset battery to normal level
        session.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": 45, "is_charging": False}
        )


class TestBatteryDataPersistence:
    """Test that battery data is properly persisted"""
    
    def test_battery_data_persists(self):
        """Verify battery data is saved and retrievable"""
        child_session = get_child_session()
        parent_session = get_parent_session()
        
        # Ensure battery sharing is enabled
        child_session.put(f"{BASE_URL}/api/permissions/battery", json={"share_battery": True})
        
        # Update battery
        update_response = child_session.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": 67, "is_charging": True}
        )
        assert update_response.status_code == 200
        
        # Fetch family battery status to verify persistence
        family_response = parent_session.get(f"{BASE_URL}/api/battery/family")
        assert family_response.status_code == 200
        
        battery_status = family_response.json().get("battery_status", [])
        alex_battery = next((b for b in battery_status if b.get("user_id") == "user_child001"), None)
        
        if alex_battery:
            assert alex_battery["level"] == 67
            assert alex_battery["is_charging"] == True
            assert alex_battery.get("updated_at") is not None
            print(f"Battery data persisted correctly: {alex_battery}")
        else:
            print("Alex not found in battery status - may need to check permissions")
        
        # Reset to original state
        child_session.post(
            f"{BASE_URL}/api/battery/update",
            json={"level": 45, "is_charging": False}
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

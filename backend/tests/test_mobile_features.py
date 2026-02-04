"""
Test Mobile OAuth, Push Notifications, and Tutorial Endpoints
Tests for FamFocus Hub mobile features iteration 10
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token created via mongosh
TEST_SESSION_TOKEN = "test_mobile_session_1770179372722"
TEST_USER_ID = "test-mobile-1770179372722"


class TestMobileOAuth:
    """Mobile OAuth endpoint tests"""
    
    def test_mobile_oauth_redirect_info(self):
        """GET /api/auth/google/mobile returns redirect info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/google/mobile",
            params={"redirect_uri": "famfocushub://oauth/callback"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "redirect_uri" in data
        assert data["redirect_uri"] == "famfocushub://oauth/callback"
        assert "message" in data
        print(f"✓ Mobile OAuth redirect info: {data}")
    
    def test_mobile_oauth_callback_missing_session_id(self):
        """POST /api/auth/mobile/callback returns 400 without session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/mobile/callback",
            json={}
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Mobile callback without session_id returns 400: {data}")
    
    def test_mobile_oauth_callback_invalid_session(self):
        """POST /api/auth/mobile/callback returns 401 with invalid session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/mobile/callback",
            json={"session_id": "invalid_session_12345"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ Mobile callback with invalid session returns 401: {data}")


class TestPushNotifications:
    """Push notification device registration tests"""
    
    def test_register_device_requires_auth(self):
        """POST /api/notifications/register-device requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-device",
            json={"token": "test_push_token", "platform": "ios"}
        )
        assert response.status_code == 401
        print("✓ Register device requires auth (401)")
    
    def test_register_device_success(self):
        """POST /api/notifications/register-device registers push token"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-device",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"},
            json={"token": "expo_push_token_test_12345", "platform": "ios"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Device registered successfully: {data}")
    
    def test_register_device_missing_token(self):
        """POST /api/notifications/register-device returns 400 without token"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-device",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"},
            json={"platform": "android"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Register device without token returns 400: {data}")
    
    def test_unregister_device_requires_auth(self):
        """DELETE /api/notifications/unregister-device requires authentication"""
        response = requests.delete(
            f"{BASE_URL}/api/notifications/unregister-device",
            json={"token": "test_push_token"}
        )
        assert response.status_code == 401
        print("✓ Unregister device requires auth (401)")
    
    def test_unregister_device_success(self):
        """DELETE /api/notifications/unregister-device removes device"""
        response = requests.delete(
            f"{BASE_URL}/api/notifications/unregister-device",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"},
            json={"token": "expo_push_token_test_12345"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Device unregistered successfully: {data}")


class TestTutorialEndpoints:
    """Tutorial content and completion tests"""
    
    def test_tutorial_content_requires_auth(self):
        """GET /api/tutorial/content requires authentication"""
        response = requests.get(f"{BASE_URL}/api/tutorial/content")
        assert response.status_code == 401
        print("✓ Tutorial content requires auth (401)")
    
    def test_tutorial_content_returns_slides(self):
        """GET /api/tutorial/content returns tutorial slides for parent"""
        response = requests.get(
            f"{BASE_URL}/api/tutorial/content",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return slides since tutorial_completed is false
        assert "slides" in data
        assert "completed" in data
        
        if not data["completed"]:
            assert len(data["slides"]) > 0
            # Check slide structure
            slide = data["slides"][0]
            assert "id" in slide
            assert "title" in slide
            assert "description" in slide
            assert "icon" in slide
            print(f"✓ Tutorial content returned {len(data['slides'])} slides")
            print(f"  First slide: {slide['title']}")
        else:
            print("✓ Tutorial already completed, no slides returned")
    
    def test_tutorial_complete_requires_auth(self):
        """POST /api/tutorial/complete requires authentication"""
        response = requests.post(f"{BASE_URL}/api/tutorial/complete")
        assert response.status_code == 401
        print("✓ Tutorial complete requires auth (401)")
    
    def test_tutorial_complete_success(self):
        """POST /api/tutorial/complete marks tutorial as done"""
        response = requests.post(
            f"{BASE_URL}/api/tutorial/complete",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Tutorial marked complete: {data}")
    
    def test_tutorial_content_after_complete(self):
        """GET /api/tutorial/content returns completed=True after completion"""
        response = requests.get(
            f"{BASE_URL}/api/tutorial/content",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["completed"] == True
        assert len(data["slides"]) == 0
        print("✓ Tutorial shows completed=True with empty slides")
    
    def test_tutorial_reset_requires_auth(self):
        """POST /api/tutorial/reset requires authentication"""
        response = requests.post(f"{BASE_URL}/api/tutorial/reset")
        assert response.status_code == 401
        print("✓ Tutorial reset requires auth (401)")
    
    def test_tutorial_reset_success(self):
        """POST /api/tutorial/reset resets tutorial for testing"""
        response = requests.post(
            f"{BASE_URL}/api/tutorial/reset",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Tutorial reset: {data}")
    
    def test_tutorial_content_after_reset(self):
        """GET /api/tutorial/content returns slides after reset"""
        response = requests.get(
            f"{BASE_URL}/api/tutorial/content",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["completed"] == False
        assert len(data["slides"]) > 0
        print(f"✓ Tutorial shows {len(data['slides'])} slides after reset")


class TestWebPushEndpoints:
    """Web push notification subscription tests"""
    
    def test_vapid_key_public(self):
        """GET /api/push/vapid-key returns public key (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        assert response.status_code == 200
        data = response.json()
        assert "publicKey" in data
        assert len(data["publicKey"]) > 0
        print(f"✓ VAPID public key returned: {data['publicKey'][:30]}...")
    
    def test_push_subscribe_requires_auth(self):
        """POST /api/push/subscribe requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={"endpoint": "https://test.push.endpoint", "keys": {}}
        )
        assert response.status_code == 401
        print("✓ Push subscribe requires auth (401)")
    
    def test_push_subscribe_success(self):
        """POST /api/push/subscribe registers subscription"""
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"},
            json={
                "endpoint": "https://fcm.googleapis.com/fcm/send/test_endpoint",
                "keys": {"p256dh": "test_p256dh_key", "auth": "test_auth_key"}
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "subscription_id" in data
        print(f"✓ Push subscription created: {data['subscription_id']}")
    
    def test_push_unsubscribe_requires_auth(self):
        """DELETE /api/push/unsubscribe requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/push/unsubscribe")
        assert response.status_code == 401
        print("✓ Push unsubscribe requires auth (401)")
    
    def test_push_unsubscribe_success(self):
        """DELETE /api/push/unsubscribe removes subscription"""
        response = requests.delete(
            f"{BASE_URL}/api/push/unsubscribe",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Push subscription removed: {data}")


class TestExistingAuthEndpoints:
    """Verify existing auth endpoints still work"""
    
    def test_auth_me_with_session(self):
        """GET /api/auth/me returns user data with valid session"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "name" in data
        print(f"✓ Auth me returned user: {data['name']} ({data['email']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

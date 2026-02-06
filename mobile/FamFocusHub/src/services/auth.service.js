import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = 'https://famfocus-hub-1.preview.emergentagent.com';
const SESSION_KEY = 'famfocus_session_token';

class AuthService {
  constructor() {
    this.sessionToken = null;
  }

  // Get the redirect URI for OAuth
  getRedirectUri() {
    return AuthSession.makeRedirectUri({
      scheme: 'famfocushub',
      path: 'auth/callback',
      preferLocalhost: false,
    });
  }

  // Start Google OAuth flow
  async signInWithGoogle() {
    try {
      const redirectUri = this.getRedirectUri();
      
      // Create OAuth URL
      const authUrl = `${BACKEND_URL}/api/auth/google/mobile?redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      // Open browser for OAuth
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      
      if (result.type === 'success' && result.url) {
        // Parse the callback URL for the session token
        const url = new URL(result.url);
        const token = url.searchParams.get('token') || url.searchParams.get('session_token');
        const error = url.searchParams.get('error');
        
        if (error) {
          throw new Error(error);
        }
        
        if (token) {
          await this.setSession(token);
          return { success: true, token };
        }
        
        throw new Error('No token received');
      } else if (result.type === 'cancel') {
        return { success: false, cancelled: true };
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      return { success: false, error: error.message };
    }
  }

  // Demo login for testing without OAuth
  async demoLogin(role = 'parent') {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      
      if (!response.ok) {
        throw new Error('Demo login failed');
      }
      
      const data = await response.json();
      
      // Get session token from response or cookie
      const token = data.session_token || data.token;
      if (token) {
        await this.setSession(token);
        return { success: true, user: data.user };
      }
      
      // Try to extract from Set-Cookie header (if accessible)
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const match = setCookie.match(/session_token=([^;]+)/);
        if (match) {
          await this.setSession(match[1]);
          return { success: true, user: data.user };
        }
      }
      
      throw new Error('No session token received');
    } catch (error) {
      console.error('Demo login error:', error);
      return { success: false, error: error.message };
    }
  }

  // Set session token
  async setSession(token) {
    this.sessionToken = token;
    await SecureStore.setItemAsync(SESSION_KEY, token);
  }

  // Get session token
  async getSession() {
    if (!this.sessionToken) {
      this.sessionToken = await SecureStore.getItemAsync(SESSION_KEY);
    }
    return this.sessionToken;
  }

  // Clear session
  async clearSession() {
    this.sessionToken = null;
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }

  // Check if session exists
  async hasSession() {
    const token = await this.getSession();
    return !!token;
  }

  // Get current user from backend
  async getCurrentUser() {
    const token = await this.getSession();
    if (!token) return null;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: {
          'Cookie': `session_token=${token}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          await this.clearSession();
        }
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  // Logout
  async logout() {
    try {
      const token = await this.getSession();
      if (token) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Cookie': `session_token=${token}`,
          },
          credentials: 'include',
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await this.clearSession();
    }
  }
}

export const authService = new AuthService();
export default authService;

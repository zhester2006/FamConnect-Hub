import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api.service';
import biometricService from '../services/biometric.service';
import webSocketService from '../services/websocket.service';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      await apiService.init();
      
      if (apiService.sessionToken) {
        const userData = await apiService.getCurrentUser();
        if (userData && userData.user_id) {
          setUser(userData);
          setIsAuthenticated(true);
          
          // Initialize WebSocket for real-time features
          webSocketService.setSessionToken(apiService.sessionToken);
          webSocketService.connect();
          
          // Update biometric stored session if enabled
          await biometricService.updateStoredSession(apiService.sessionToken);
        } else {
          await apiService.clearSession();
        }
      }
    } catch (error) {
      console.error('Auth init failed:', error);
      await apiService.clearSession();
    } finally {
      setLoading(false);
    }
  };

  const login = async (sessionToken) => {
    try {
      await apiService.setSession(sessionToken);
      const userData = await apiService.getCurrentUser();
      
      if (!userData || !userData.user_id) {
        await apiService.clearSession();
        throw new Error('Invalid session');
      }
      
      setUser(userData);
      setIsAuthenticated(true);
      
      // Initialize WebSocket
      webSocketService.setSessionToken(sessionToken);
      webSocketService.connect();
      
      return userData;
    } catch (error) {
      await apiService.clearSession();
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Disconnect WebSocket
      webSocketService.reset();
      
      // Clear biometric session
      await biometricService.clearOnLogout();
      
      // Logout from API
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await apiService.getCurrentUser();
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated,
      login,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'famfocus_biometric_enabled';
const BIOMETRIC_SESSION_KEY = 'famfocus_biometric_session';

class BiometricService {
  constructor() {
    this.isSupported = false;
    this.biometricTypes = [];
  }

  // Check if device supports biometric authentication
  async checkSupport() {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        this.isSupported = false;
        return { supported: false, reason: 'Device does not support biometric authentication' };
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        this.isSupported = false;
        return { supported: false, reason: 'No biometric data enrolled on device' };
      }

      // Get available biometric types
      this.biometricTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      this.isSupported = true;

      return {
        supported: true,
        types: this.biometricTypes.map(type => this.getBiometricTypeName(type)),
        primaryType: this.getPrimaryBiometricType(),
      };
    } catch (error) {
      console.error('Biometric check error:', error);
      return { supported: false, reason: error.message };
    }
  }

  // Get human-readable name for biometric type
  getBiometricTypeName(type) {
    switch (type) {
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        return 'Fingerprint';
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        return 'Face ID';
      case LocalAuthentication.AuthenticationType.IRIS:
        return 'Iris';
      default:
        return 'Biometric';
    }
  }

  // Get the primary biometric type (Face ID preferred over Fingerprint)
  getPrimaryBiometricType() {
    if (this.biometricTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (this.biometricTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    }
    if (this.biometricTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris';
    }
    return 'Biometric';
  }

  // Authenticate using biometrics
  async authenticate(promptMessage = 'Authenticate to access FamFocus Hub') {
    if (!this.isSupported) {
      const support = await this.checkSupport();
      if (!support.supported) {
        return { success: false, error: support.reason };
      }
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false, // Allow PIN/Password fallback
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error || 'Authentication failed',
          cancelled: result.error === 'user_cancel',
        };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if biometric login is enabled for the user
  async isBiometricLoginEnabled() {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      return false;
    }
  }

  // Enable biometric login
  async enableBiometricLogin(sessionToken) {
    try {
      // First, verify biometric authentication works
      const authResult = await this.authenticate('Verify to enable biometric login');
      if (!authResult.success) {
        return { success: false, error: authResult.error };
      }

      // Store the session token securely for biometric unlock
      await SecureStore.setItemAsync(BIOMETRIC_SESSION_KEY, sessionToken);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');

      return { success: true };
    } catch (error) {
      console.error('Enable biometric error:', error);
      return { success: false, error: error.message };
    }
  }

  // Disable biometric login
  async disableBiometricLogin() {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_SESSION_KEY);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');
      return { success: true };
    } catch (error) {
      console.error('Disable biometric error:', error);
      return { success: false, error: error.message };
    }
  }

  // Login using biometrics
  async biometricLogin() {
    try {
      // Check if biometric is enabled
      const enabled = await this.isBiometricLoginEnabled();
      if (!enabled) {
        return { success: false, error: 'Biometric login not enabled' };
      }

      // Authenticate
      const authResult = await this.authenticate('Sign in to FamFocus Hub');
      if (!authResult.success) {
        return authResult;
      }

      // Get stored session token
      const sessionToken = await SecureStore.getItemAsync(BIOMETRIC_SESSION_KEY);
      if (!sessionToken) {
        // Session expired, need to re-enable biometric
        await this.disableBiometricLogin();
        return { success: false, error: 'Session expired. Please sign in again.' };
      }

      return { success: true, sessionToken };
    } catch (error) {
      console.error('Biometric login error:', error);
      return { success: false, error: error.message };
    }
  }

  // Update stored session token (when refreshed)
  async updateStoredSession(sessionToken) {
    const enabled = await this.isBiometricLoginEnabled();
    if (enabled) {
      await SecureStore.setItemAsync(BIOMETRIC_SESSION_KEY, sessionToken);
    }
  }

  // Clear biometric data on logout
  async clearOnLogout() {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_SESSION_KEY);
      // Keep BIOMETRIC_ENABLED_KEY so user preference is remembered
    } catch (error) {
      console.error('Clear biometric error:', error);
    }
  }
}

export const biometricService = new BiometricService();
export default biometricService;

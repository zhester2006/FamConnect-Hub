import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';

const KEY_STORAGE_KEY = 'e2e_encryption_key';
const ALGORITHM = 'AES';

class EncryptionService {
  constructor() {
    this.encryptionKey = null;
    this.initialized = false;
  }

  /**
   * Initialize the encryption service
   * Generates or retrieves the family's shared encryption key
   */
  async initialize(familyId) {
    try {
      // Try to get existing key from secure storage
      const storedKey = await SecureStore.getItemAsync(`${KEY_STORAGE_KEY}_${familyId}`);
      
      if (storedKey) {
        this.encryptionKey = storedKey;
      } else {
        // Generate a new encryption key for this family
        this.encryptionKey = this.generateKey();
        await SecureStore.setItemAsync(`${KEY_STORAGE_KEY}_${familyId}`, this.encryptionKey);
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      // Fallback to memory-only key if secure storage fails
      this.encryptionKey = this.generateKey();
      this.initialized = true;
      return true;
    }
  }

  /**
   * Generate a random 256-bit encryption key
   */
  generateKey() {
    const randomWords = CryptoJS.lib.WordArray.random(32); // 256 bits
    return randomWords.toString(CryptoJS.enc.Hex);
  }

  /**
   * Encrypt a message using AES-256
   * @param {string} plaintext - The message to encrypt
   * @returns {object} - Object containing encrypted data and IV
   */
  encrypt(plaintext) {
    if (!this.initialized || !this.encryptionKey) {
      console.warn('Encryption not initialized, returning plaintext');
      return { encrypted: false, content: plaintext };
    }

    try {
      // Generate a random IV for each message
      const iv = CryptoJS.lib.WordArray.random(16);
      
      // Parse the key from hex
      const key = CryptoJS.enc.Hex.parse(this.encryptionKey);
      
      // Encrypt the message
      const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      return {
        encrypted: true,
        content: encrypted.toString(),
        iv: iv.toString(CryptoJS.enc.Hex),
        algorithm: ALGORITHM
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      return { encrypted: false, content: plaintext };
    }
  }

  /**
   * Decrypt a message using AES-256
   * @param {object} encryptedData - Object containing encrypted content and IV
   * @returns {string} - The decrypted plaintext
   */
  decrypt(encryptedData) {
    if (!this.initialized || !this.encryptionKey) {
      console.warn('Encryption not initialized');
      return encryptedData.content || encryptedData;
    }

    // If the message wasn't encrypted, return as-is
    if (!encryptedData.encrypted) {
      return encryptedData.content || encryptedData;
    }

    try {
      // Parse the key and IV from hex
      const key = CryptoJS.enc.Hex.parse(this.encryptionKey);
      const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);

      // Decrypt the message
      const decrypted = CryptoJS.AES.decrypt(encryptedData.content, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Encrypted message - unable to decrypt]';
    }
  }

  /**
   * Check if a message object is encrypted
   */
  isEncrypted(message) {
    return message && typeof message === 'object' && message.encrypted === true;
  }

  /**
   * Get the current encryption status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasKey: !!this.encryptionKey,
      algorithm: ALGORITHM
    };
  }

  /**
   * Clear the encryption key (for logout)
   */
  async clear() {
    this.encryptionKey = null;
    this.initialized = false;
  }

  /**
   * Export encryption key for sharing with family members
   * In a real app, this would use a secure key exchange protocol
   */
  exportKey() {
    if (!this.encryptionKey) return null;
    return this.encryptionKey;
  }

  /**
   * Import an encryption key (for joining a family)
   */
  async importKey(key, familyId) {
    try {
      this.encryptionKey = key;
      await SecureStore.setItemAsync(`${KEY_STORAGE_KEY}_${familyId}`, key);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to import key:', error);
      return false;
    }
  }
}

export const encryptionService = new EncryptionService();
export default encryptionService;

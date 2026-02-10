// Firebase Storage Service for FamFocus Hub
// Using React Native Firebase Storage

import storage from '@react-native-firebase/storage';
import * as FileSystem from 'expo-file-system';

class FirebaseStorageService {
  constructor() {
    this.storage = null;
    this.isInitialized = false;
  }

  initialize() {
    try {
      this.storage = storage();
      this.isInitialized = true;
      console.log('[StorageService] Firebase Storage initialized');
      return true;
    } catch (error) {
      console.error('[StorageService] Initialization error:', error);
      return false;
    }
  }

  // Upload profile picture
  async uploadProfilePicture(userId, imageUri) {
    return this.uploadImage(`profiles/${userId}/avatar.jpg`, imageUri);
  }

  // Upload cover/background picture
  async uploadCoverPicture(userId, imageUri) {
    return this.uploadImage(`profiles/${userId}/cover.jpg`, imageUri);
  }

  // Upload chat image
  async uploadChatImage(familyId, imageUri) {
    const timestamp = Date.now();
    return this.uploadImage(`chats/${familyId}/images/${timestamp}.jpg`, imageUri);
  }

  // Upload family wall image
  async uploadFamilyWallImage(familyId, postId, imageUri) {
    return this.uploadImage(`family-wall/${familyId}/${postId}.jpg`, imageUri);
  }

  // Upload voice message
  async uploadVoiceMessage(familyId, audioUri) {
    const timestamp = Date.now();
    return this.uploadAudio(`chats/${familyId}/voice/${timestamp}.m4a`, audioUri);
  }

  // Generic image upload
  async uploadImage(path, imageUri) {
    if (!this.isInitialized || !this.storage) {
      console.error('[StorageService] Not initialized');
      return { success: false, error: 'Storage not initialized' };
    }

    try {
      console.log('[StorageService] Uploading image to:', path);

      // Handle different URI formats
      let uri = imageUri;
      if (uri.startsWith('file://')) {
        uri = uri.replace('file://', '');
      }

      // Create reference
      const reference = this.storage.ref(path);

      // Upload file
      await reference.putFile(uri);

      // Get download URL
      const downloadURL = await reference.getDownloadURL();

      console.log('[StorageService] Upload successful:', downloadURL);
      return { success: true, url: downloadURL };
    } catch (error) {
      console.error('[StorageService] Upload error:', error);
      return { success: false, error: error.message };
    }
  }

  // Generic audio upload
  async uploadAudio(path, audioUri) {
    if (!this.isInitialized || !this.storage) {
      return { success: false, error: 'Storage not initialized' };
    }

    try {
      let uri = audioUri;
      if (uri.startsWith('file://')) {
        uri = uri.replace('file://', '');
      }

      const reference = this.storage.ref(path);
      await reference.putFile(uri);
      const downloadURL = await reference.getDownloadURL();

      return { success: true, url: downloadURL };
    } catch (error) {
      console.error('[StorageService] Audio upload error:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete file
  async deleteFile(path) {
    if (!this.isInitialized || !this.storage) {
      return { success: false, error: 'Storage not initialized' };
    }

    try {
      const reference = this.storage.ref(path);
      await reference.delete();
      return { success: true };
    } catch (error) {
      console.error('[StorageService] Delete error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get download URL for existing file
  async getDownloadURL(path) {
    if (!this.isInitialized || !this.storage) {
      return null;
    }

    try {
      const reference = this.storage.ref(path);
      return await reference.getDownloadURL();
    } catch (error) {
      console.error('[StorageService] Get URL error:', error);
      return null;
    }
  }
}

const firebaseStorageService = new FirebaseStorageService();
export default firebaseStorageService;

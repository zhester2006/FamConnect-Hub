// Firebase Storage Service for FamFocus Hub
// Handles all image/file uploads for profile pictures, chat, family wall, etc.

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getApp } from 'firebase/app';
import * as FileSystem from 'expo-file-system';

class FirebaseStorageService {
  constructor() {
    this.storage = null;
    this.isInitialized = false;
  }

  initialize() {
    try {
      const app = getApp();
      this.storage = getStorage(app);
      this.isInitialized = true;
      console.log('Firebase Storage initialized');
      return true;
    } catch (error) {
      console.error('Firebase Storage initialization error:', error);
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
    return this.uploadFile(`chats/${familyId}/voice/${timestamp}.m4a`, audioUri, 'audio/m4a');
  }

  // Generic image upload
  async uploadImage(path, imageUri) {
    if (!this.isInitialized) {
      console.error('Firebase Storage not initialized');
      return null;
    }

    try {
      // Read the file as blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Create reference and upload
      const storageRef = ref(this.storage, path);
      const snapshot = await uploadBytes(storageRef, blob);

      // Get download URL
      const downloadUrl = await getDownloadURL(snapshot.ref);
      console.log('Image uploaded successfully:', downloadUrl);
      return downloadUrl;
    } catch (error) {
      console.error('Image upload error:', error);
      return null;
    }
  }

  // Generic file upload
  async uploadFile(path, fileUri, contentType) {
    if (!this.isInitialized) {
      console.error('Firebase Storage not initialized');
      return null;
    }

    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();

      const storageRef = ref(this.storage, path);
      const metadata = { contentType };
      const snapshot = await uploadBytes(storageRef, blob, metadata);

      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (error) {
      console.error('File upload error:', error);
      return null;
    }
  }

  // Delete a file
  async deleteFile(path) {
    if (!this.isInitialized) return false;

    try {
      const storageRef = ref(this.storage, path);
      await deleteObject(storageRef);
      return true;
    } catch (error) {
      console.error('File delete error:', error);
      return false;
    }
  }

  // Upload base64 image
  async uploadBase64Image(path, base64Data) {
    if (!this.isInitialized) return null;

    try {
      // Convert base64 to blob
      const response = await fetch(base64Data);
      const blob = await response.blob();

      const storageRef = ref(this.storage, path);
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (error) {
      console.error('Base64 upload error:', error);
      return null;
    }
  }
}

const firebaseStorageService = new FirebaseStorageService();
export default firebaseStorageService;

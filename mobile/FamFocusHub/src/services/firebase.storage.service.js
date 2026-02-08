// Firebase Storage Service for FamFocus Hub
// Using React Native Firebase (Native implementation)

import storage from '@react-native-firebase/storage';

class FirebaseStorageService {
  constructor() {
    this.isInitialized = false;
  }

  initialize() {
    try {
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
    return this.uploadFile(`chats/${familyId}/voice/${timestamp}.m4a`, audioUri, 'audio/m4a');
  }

  // Generic image upload
  async uploadImage(path, imageUri) {
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      const reference = storage().ref(path);
      
      // Upload file
      await reference.putFile(imageUri);
      
      // Get download URL
      const downloadUrl = await reference.getDownloadURL();
      console.log('[StorageService] Image uploaded successfully:', downloadUrl);
      return downloadUrl;
    } catch (error) {
      console.error('[StorageService] Image upload error:', error);
      return null;
    }
  }

  // Generic file upload
  async uploadFile(path, fileUri, contentType) {
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      const reference = storage().ref(path);
      
      // Upload with metadata
      await reference.putFile(fileUri, { contentType });
      
      const downloadUrl = await reference.getDownloadURL();
      return downloadUrl;
    } catch (error) {
      console.error('[StorageService] File upload error:', error);
      return null;
    }
  }

  // Delete a file
  async deleteFile(path) {
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      const reference = storage().ref(path);
      await reference.delete();
      return true;
    } catch (error) {
      console.error('[StorageService] File delete error:', error);
      return false;
    }
  }

  // Upload base64 image
  async uploadBase64Image(path, base64Data) {
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      const reference = storage().ref(path);
      
      // Upload base64 string
      await reference.putString(base64Data, 'data_url');
      
      const downloadUrl = await reference.getDownloadURL();
      return downloadUrl;
    } catch (error) {
      console.error('[StorageService] Base64 upload error:', error);
      return null;
    }
  }
}

const firebaseStorageService = new FirebaseStorageService();
export default firebaseStorageService;

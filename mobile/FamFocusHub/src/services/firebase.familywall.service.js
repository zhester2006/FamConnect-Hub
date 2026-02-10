// Firebase Family Wall Service for FamFocus Hub
// Using React Native Firebase Realtime Database

import database from '@react-native-firebase/database';
import firebaseStorageService from './firebase.storage.service';

class FirebaseFamilyWallService {
  constructor() {
    this.db = null;
    this.familyId = null;
    this.userId = null;
    this.userName = null;
    this.userPicture = null;
    this.postsRef = null;
    this.unsubscribers = [];
    this.postCallback = null;
    this.isInitialized = false;
  }

  initialize() {
    try {
      this.db = database();
      this.isInitialized = true;
      console.log('[FamilyWallService] Initialized');
      return true;
    } catch (error) {
      console.error('[FamilyWallService] Initialization error:', error);
      return false;
    }
  }

  setUser(userId, userName, userPicture, familyId) {
    this.userId = userId;
    this.userName = userName;
    this.userPicture = userPicture;
    this.familyId = familyId;

    if (this.isInitialized && familyId) {
      this.postsRef = this.db.ref(`family-wall/${familyId}/posts`);
    }
  }

  // Connect and listen for posts
  connect(onPosts) {
    if (!this.isInitialized || !this.postsRef) {
      console.log('[FamilyWallService] Not initialized');
      return false;
    }

    this.postCallback = onPosts;

    try {
      this.disconnect();

      // Listen for posts (last 50)
      const postsListener = this.postsRef
        .orderByChild('timestamp')
        .limitToLast(50)
        .on('value', (snapshot) => {
          const posts = [];
          snapshot.forEach((child) => {
            posts.push({
              id: child.key,
              ...child.val()
            });
          });
          posts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          
          if (this.postCallback) {
            this.postCallback(posts);
          }
        });

      this.unsubscribers.push(() => this.postsRef.off('value', postsListener));

      return true;
    } catch (error) {
      console.error('[FamilyWallService] Connection error:', error);
      return false;
    }
  }

  // Create a new post
  async createPost(content, type = 'text', imageUri = null) {
    if (!this.postsRef || !this.userId) {
      return { success: false, error: 'Not connected' };
    }

    try {
      let mediaUrl = null;

      // Upload image if provided
      if (imageUri && type === 'photo') {
        const postId = Date.now().toString();
        const uploadResult = await firebaseStorageService.uploadFamilyWallImage(
          this.familyId,
          postId,
          imageUri
        );
        if (uploadResult.success) {
          mediaUrl = uploadResult.url;
        }
      }

      const postData = {
        authorId: this.userId,
        authorName: this.userName,
        authorPicture: this.userPicture,
        content,
        type,
        mediaUrl,
        timestamp: database.ServerValue.TIMESTAMP,
        likes: {},
        comments: {},
        reactions: {}
      };

      // For polls
      if (type === 'poll' && content.options) {
        postData.pollOptions = content.options.reduce((acc, opt, idx) => {
          acc[idx] = { text: opt, votes: {} };
          return acc;
        }, {});
        postData.content = content.question;
      }

      const newPostRef = this.postsRef.push();
      await newPostRef.set(postData);

      return { success: true, postId: newPostRef.key };
    } catch (error) {
      console.error('[FamilyWallService] Create post error:', error);
      return { success: false, error: error.message };
    }
  }

  // Like/unlike a post
  async toggleLike(postId) {
    if (!this.postsRef || !this.userId) {
      return { success: false };
    }

    try {
      const likeRef = this.postsRef.child(`${postId}/likes/${this.userId}`);
      const snapshot = await likeRef.once('value');

      if (snapshot.exists()) {
        await likeRef.remove();
      } else {
        await likeRef.set({
          name: this.userName,
          timestamp: database.ServerValue.TIMESTAMP
        });
      }

      return { success: true };
    } catch (error) {
      console.error('[FamilyWallService] Toggle like error:', error);
      return { success: false };
    }
  }

  // Add reaction to post
  async addReaction(postId, reaction) {
    if (!this.postsRef || !this.userId) {
      return { success: false };
    }

    try {
      const reactionRef = this.postsRef.child(`${postId}/reactions/${this.userId}`);
      await reactionRef.set({
        emoji: reaction,
        name: this.userName,
        timestamp: database.ServerValue.TIMESTAMP
      });

      return { success: true };
    } catch (error) {
      console.error('[FamilyWallService] Add reaction error:', error);
      return { success: false };
    }
  }

  // Vote on poll
  async votePoll(postId, optionIndex) {
    if (!this.postsRef || !this.userId) {
      return { success: false };
    }

    try {
      const pollRef = this.postsRef.child(`${postId}/pollOptions`);
      const snapshot = await pollRef.once('value');
      const options = snapshot.val();

      if (!options) return { success: false };

      // Remove existing votes
      for (const idx of Object.keys(options)) {
        const voteRef = pollRef.child(`${idx}/votes/${this.userId}`);
        await voteRef.remove();
      }

      // Add new vote
      const voteRef = pollRef.child(`${optionIndex}/votes/${this.userId}`);
      await voteRef.set({
        name: this.userName,
        timestamp: database.ServerValue.TIMESTAMP
      });

      return { success: true };
    } catch (error) {
      console.error('[FamilyWallService] Vote poll error:', error);
      return { success: false };
    }
  }

  // Add comment to post
  async addComment(postId, content) {
    if (!this.postsRef || !this.userId) {
      return { success: false };
    }

    try {
      const commentsRef = this.postsRef.child(`${postId}/comments`);
      const newCommentRef = commentsRef.push();
      
      await newCommentRef.set({
        authorId: this.userId,
        authorName: this.userName,
        authorPicture: this.userPicture,
        content,
        timestamp: database.ServerValue.TIMESTAMP
      });

      return { success: true, commentId: newCommentRef.key };
    } catch (error) {
      console.error('[FamilyWallService] Add comment error:', error);
      return { success: false };
    }
  }

  // Delete post
  async deletePost(postId) {
    if (!this.postsRef) {
      return { success: false };
    }

    try {
      await this.postsRef.child(postId).remove();
      return { success: true };
    } catch (error) {
      console.error('[FamilyWallService] Delete post error:', error);
      return { success: false };
    }
  }

  // Disconnect
  disconnect() {
    this.unsubscribers.forEach(unsub => {
      try { unsub(); } catch (e) {}
    });
    this.unsubscribers = [];
  }

  // Reset
  reset() {
    this.disconnect();
    this.familyId = null;
    this.userId = null;
    this.userName = null;
    this.userPicture = null;
    this.postsRef = null;
    this.postCallback = null;
  }
}

const firebaseFamilyWallService = new FirebaseFamilyWallService();
export default firebaseFamilyWallService;

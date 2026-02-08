// Firebase Family Wall Service for FamFocus Hub
// Using React Native Firebase (Native implementation)

import database from '@react-native-firebase/database';
import firebaseStorageService from './firebase.storage.service';

class FirebaseFamilyWallService {
  constructor() {
    this.familyId = null;
    this.userId = null;
    this.userName = null;
    this.userPicture = null;
    this.unsubscribers = [];
    this.postCallback = null;
    this.isInitialized = false;
  }

  initialize() {
    try {
      this.isInitialized = true;
      console.log('[FamilyWallService] Firebase Family Wall initialized');
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
  }

  // Connect and listen for posts
  connect(onPosts) {
    if (!this.isInitialized || !this.familyId) {
      console.log('[FamilyWallService] Not initialized or no family set');
      return false;
    }

    this.postCallback = onPosts;

    const postsRef = database().ref(`family-wall/${this.familyId}/posts`);
    const listener = postsRef
      .orderByChild('timestamp')
      .limitToLast(50)
      .on('value', (snapshot) => {
        const posts = [];
        snapshot.forEach((childSnapshot) => {
          posts.push({
            ...childSnapshot.val(),
            post_id: childSnapshot.key,
          });
          return false;
        });

        // Sort by timestamp descending (newest first)
        posts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (this.postCallback) {
          this.postCallback(posts);
        }
      });

    this.unsubscribers.push(() => postsRef.off('value', listener));
    return true;
  }

  // Create a text post
  async createTextPost(content) {
    if (!this.familyId) return null;

    try {
      const postsRef = database().ref(`family-wall/${this.familyId}/posts`);
      const postRef = postsRef.push();
      
      const post = {
        type: 'text',
        content,
        author_id: this.userId,
        author_name: this.userName,
        author_picture: this.userPicture,
        timestamp: Date.now(),
        likes: {},
        comments: {},
      };

      await postRef.set(post);
      return { ...post, post_id: postRef.key };
    } catch (error) {
      console.error('[FamilyWallService] Create text post error:', error);
      return null;
    }
  }

  // Create a photo post
  async createPhotoPost(content, imageUri) {
    if (!this.familyId) return null;

    try {
      const postsRef = database().ref(`family-wall/${this.familyId}/posts`);
      const postRef = postsRef.push();
      
      // Upload image to Firebase Storage
      const imageUrl = await firebaseStorageService.uploadFamilyWallImage(
        this.familyId,
        postRef.key,
        imageUri
      );

      if (!imageUrl) {
        throw new Error('Failed to upload image');
      }

      const post = {
        type: 'photo',
        content,
        image_url: imageUrl,
        author_id: this.userId,
        author_name: this.userName,
        author_picture: this.userPicture,
        timestamp: Date.now(),
        likes: {},
        comments: {},
      };

      await postRef.set(post);
      return { ...post, post_id: postRef.key };
    } catch (error) {
      console.error('[FamilyWallService] Create photo post error:', error);
      return null;
    }
  }

  // Create a GIF post
  async createGifPost(content, gifUrl) {
    if (!this.familyId) return null;

    try {
      const postsRef = database().ref(`family-wall/${this.familyId}/posts`);
      const postRef = postsRef.push();
      
      const post = {
        type: 'gif',
        content,
        gif_url: gifUrl,
        author_id: this.userId,
        author_name: this.userName,
        author_picture: this.userPicture,
        timestamp: Date.now(),
        likes: {},
        comments: {},
      };

      await postRef.set(post);
      return { ...post, post_id: postRef.key };
    } catch (error) {
      console.error('[FamilyWallService] Create GIF post error:', error);
      return null;
    }
  }

  // Create a poll post
  async createPollPost(question, options) {
    if (!this.familyId) return null;

    try {
      const postsRef = database().ref(`family-wall/${this.familyId}/posts`);
      const postRef = postsRef.push();
      
      const pollOptions = options.map((opt, idx) => ({
        id: idx,
        text: opt,
        votes: {},
      }));

      const post = {
        type: 'poll',
        content: question,
        poll_options: pollOptions,
        author_id: this.userId,
        author_name: this.userName,
        author_picture: this.userPicture,
        timestamp: Date.now(),
        likes: {},
        comments: {},
      };

      await postRef.set(post);
      return { ...post, post_id: postRef.key };
    } catch (error) {
      console.error('[FamilyWallService] Create poll post error:', error);
      return null;
    }
  }

  // Vote on a poll
  async voteOnPoll(postId, optionIndex) {
    if (!this.familyId) return false;

    try {
      const voteRef = database().ref(`family-wall/${this.familyId}/posts/${postId}/poll_options/${optionIndex}/votes/${this.userId}`);
      await voteRef.set({
        voted_at: Date.now(),
        voter_name: this.userName,
      });
      return true;
    } catch (error) {
      console.error('[FamilyWallService] Vote on poll error:', error);
      return false;
    }
  }

  // Like a post
  async likePost(postId) {
    if (!this.familyId) return false;

    try {
      const likeRef = database().ref(`family-wall/${this.familyId}/posts/${postId}/likes/${this.userId}`);
      await likeRef.set({
        liked_at: Date.now(),
        user_name: this.userName,
      });
      return true;
    } catch (error) {
      console.error('[FamilyWallService] Like post error:', error);
      return false;
    }
  }

  // Unlike a post
  async unlikePost(postId) {
    if (!this.familyId) return false;

    try {
      const likeRef = database().ref(`family-wall/${this.familyId}/posts/${postId}/likes/${this.userId}`);
      await likeRef.remove();
      return true;
    } catch (error) {
      console.error('[FamilyWallService] Unlike post error:', error);
      return false;
    }
  }

  // Add a comment
  async addComment(postId, comment) {
    if (!this.familyId) return null;

    try {
      const commentsRef = database().ref(`family-wall/${this.familyId}/posts/${postId}/comments`);
      const commentRef = commentsRef.push();
      
      const commentData = {
        content: comment,
        author_id: this.userId,
        author_name: this.userName,
        author_picture: this.userPicture,
        timestamp: Date.now(),
      };

      await commentRef.set(commentData);
      return { ...commentData, comment_id: commentRef.key };
    } catch (error) {
      console.error('[FamilyWallService] Add comment error:', error);
      return null;
    }
  }

  // Delete a post (only author or parent can delete)
  async deletePost(postId) {
    if (!this.familyId) return false;

    try {
      const postRef = database().ref(`family-wall/${this.familyId}/posts/${postId}`);
      await postRef.remove();
      return true;
    } catch (error) {
      console.error('[FamilyWallService] Delete post error:', error);
      return false;
    }
  }

  // Disconnect
  disconnect() {
    for (const unsub of this.unsubscribers) {
      try {
        unsub();
      } catch (e) {}
    }
    this.unsubscribers = [];
    this.postCallback = null;
  }

  reset() {
    this.disconnect();
    this.familyId = null;
    this.userId = null;
  }
}

const firebaseFamilyWallService = new FirebaseFamilyWallService();
export default firebaseFamilyWallService;

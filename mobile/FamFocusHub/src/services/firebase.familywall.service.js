// Firebase Family Wall Service for FamFocus Hub
// Real-time family posts, photos, polls with Firebase

import { getDatabase, ref, push, set, onValue, off, query, orderByChild, limitToLast, update, remove } from 'firebase/database';
import { getApp } from 'firebase/app';
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
      const app = getApp();
      this.db = getDatabase(app);
      this.isInitialized = true;
      console.log('Firebase Family Wall initialized');
      return true;
    } catch (error) {
      console.error('Firebase Family Wall initialization error:', error);
      return false;
    }
  }

  setUser(userId, userName, userPicture, familyId) {
    this.userId = userId;
    this.userName = userName;
    this.userPicture = userPicture;
    this.familyId = familyId;

    if (this.isInitialized && familyId) {
      this.postsRef = ref(this.db, `family-wall/${familyId}/posts`);
    }
  }

  // Connect and listen for posts
  connect(onPosts) {
    if (!this.isInitialized || !this.postsRef) {
      console.log('Firebase Family Wall not initialized');
      return false;
    }

    this.postCallback = onPosts;

    const postsQuery = query(
      this.postsRef,
      orderByChild('timestamp'),
      limitToLast(50)
    );

    const unsubPosts = onValue(postsQuery, (snapshot) => {
      const posts = [];
      snapshot.forEach((childSnapshot) => {
        posts.push({
          ...childSnapshot.val(),
          post_id: childSnapshot.key,
        });
      });

      // Sort by timestamp descending (newest first)
      posts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      if (this.postCallback) {
        this.postCallback(posts);
      }
    });

    this.unsubscribers.push(() => off(postsQuery));
    return true;
  }

  // Create a text post
  async createTextPost(content) {
    if (!this.postsRef) return null;

    try {
      const postRef = push(this.postsRef);
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

      await set(postRef, post);
      return { ...post, post_id: postRef.key };
    } catch (error) {
      console.error('Create text post error:', error);
      return null;
    }
  }

  // Create a photo post
  async createPhotoPost(content, imageUri) {
    if (!this.postsRef) return null;

    try {
      const postRef = push(this.postsRef);
      
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

      await set(postRef, post);
      return { ...post, post_id: postRef.key };
    } catch (error) {
      console.error('Create photo post error:', error);
      return null;
    }
  }

  // Create a GIF post
  async createGifPost(content, gifUrl) {
    if (!this.postsRef) return null;

    try {
      const postRef = push(this.postsRef);
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

      await set(postRef, post);
      return { ...post, post_id: postRef.key };
    } catch (error) {
      console.error('Create GIF post error:', error);
      return null;
    }
  }

  // Create a poll post
  async createPollPost(question, options) {
    if (!this.postsRef) return null;

    try {
      const postRef = push(this.postsRef);
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

      await set(postRef, post);
      return { ...post, post_id: postRef.key };
    } catch (error) {
      console.error('Create poll post error:', error);
      return null;
    }
  }

  // Vote on a poll
  async voteOnPoll(postId, optionIndex) {
    if (!this.postsRef) return false;

    try {
      const voteRef = ref(this.db, `family-wall/${this.familyId}/posts/${postId}/poll_options/${optionIndex}/votes/${this.userId}`);
      await set(voteRef, {
        voted_at: Date.now(),
        voter_name: this.userName,
      });
      return true;
    } catch (error) {
      console.error('Vote on poll error:', error);
      return false;
    }
  }

  // Like a post
  async likePost(postId) {
    if (!this.postsRef) return false;

    try {
      const likeRef = ref(this.db, `family-wall/${this.familyId}/posts/${postId}/likes/${this.userId}`);
      await set(likeRef, {
        liked_at: Date.now(),
        user_name: this.userName,
      });
      return true;
    } catch (error) {
      console.error('Like post error:', error);
      return false;
    }
  }

  // Unlike a post
  async unlikePost(postId) {
    if (!this.postsRef) return false;

    try {
      const likeRef = ref(this.db, `family-wall/${this.familyId}/posts/${postId}/likes/${this.userId}`);
      await remove(likeRef);
      return true;
    } catch (error) {
      console.error('Unlike post error:', error);
      return false;
    }
  }

  // Add a comment
  async addComment(postId, comment) {
    if (!this.postsRef) return null;

    try {
      const commentsRef = ref(this.db, `family-wall/${this.familyId}/posts/${postId}/comments`);
      const commentRef = push(commentsRef);
      
      const commentData = {
        content: comment,
        author_id: this.userId,
        author_name: this.userName,
        author_picture: this.userPicture,
        timestamp: Date.now(),
      };

      await set(commentRef, commentData);
      return { ...commentData, comment_id: commentRef.key };
    } catch (error) {
      console.error('Add comment error:', error);
      return null;
    }
  }

  // Delete a post (only author or parent can delete)
  async deletePost(postId) {
    if (!this.postsRef) return false;

    try {
      const postRef = ref(this.db, `family-wall/${this.familyId}/posts/${postId}`);
      await remove(postRef);
      return true;
    } catch (error) {
      console.error('Delete post error:', error);
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
    this.postsRef = null;
  }
}

const firebaseFamilyWallService = new FirebaseFamilyWallService();
export default firebaseFamilyWallService;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Image, Modal, KeyboardAvoidingView, Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';

const POST_TYPES = [
  { key: 'message', icon: 'chatbubble', label: 'Message' },
  { key: 'photo', icon: 'image', label: 'Photo' },
  { key: 'poll', icon: 'stats-chart', label: 'Poll' },
  { key: 'gif', icon: 'happy', label: 'GIF' },
];

export default function FamilyWallScreen({ navigation }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [dailyQuote, setDailyQuote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [postType, setPostType] = useState('message');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [gifs, setGifs] = useState([]);
  const [gifSearch, setGifSearch] = useState('');
  const [selectedGif, setSelectedGif] = useState(null);
  const [posting, setPosting] = useState(false);
  const flatListRef = useRef(null);

  const fetchPosts = useCallback(async () => {
    try {
      const [postsData, quoteData] = await Promise.all([
        apiService.getFamilyWallPosts(),
        apiService.getDailyQuote().catch(() => ({ quote: '' })),
      ]);
      setPosts(postsData.posts || []);
      setDailyQuote(quoteData.quote || '');
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [fetchPosts]);

  const searchGifs = async (query) => {
    if (!query.trim()) return;
    try {
      const data = await apiService.searchGifs(query);
      setGifs(data.results || []);
    } catch (error) {
      console.error('GIF search failed:', error);
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedGif) return;
    
    setPosting(true);
    try {
      await apiService.createFamilyWallPost({
        type: postType,
        content: newPost,
        gif_url: selectedGif?.url,
      });
      
      setNewPost('');
      setSelectedGif(null);
      setShowNewPostModal(false);
      fetchPosts();
    } catch (error) {
      console.error('Failed to post:', error);
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      await apiService.likePost(postId);
      fetchPosts();
    } catch (error) {
      console.error('Failed to like:', error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch (error) {
      return '';
    }
  };

  const renderPost = ({ item }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.author_name?.charAt(0) || '?'}</Text>
        </View>
        <View style={styles.postMeta}>
          <Text style={styles.authorName}>{item.author_name}</Text>
          <Text style={styles.postTime}>{formatDate(item.created_at)}</Text>
        </View>
        {item.type === 'poll' && (
          <View style={styles.pollBadge}>
            <Ionicons name="stats-chart" size={12} color="#818cf8" />
            <Text style={styles.pollBadgeText}>Poll</Text>
          </View>
        )}
      </View>

      <Text style={styles.postContent}>{item.content}</Text>
      
      {item.gif_url && (
        <Image source={{ uri: item.gif_url }} style={styles.gifImage} resizeMode="cover" />
      )}

      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
      )}

      <View style={styles.postActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLike(item.post_id)}
        >
          <Ionicons 
            name={item.liked_by?.includes(user?.user_id) ? 'heart' : 'heart-outline'} 
            size={20} 
            color={item.liked_by?.includes(user?.user_id) ? '#ef4444' : '#9ca3af'} 
          />
          <Text style={styles.actionText}>{item.likes_count || 0}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={20} color="#9ca3af" />
          <Text style={styles.actionText}>{item.comments_count || 0}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#1e1b4b']}
        style={styles.gradient}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Family Wall</Text>
        <TouchableOpacity 
          style={styles.newPostButton}
          onPress={() => setShowNewPostModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Daily Quote */}
      {dailyQuote && (
        <View style={styles.quoteCard}>
          <Ionicons name="sparkles" size={18} color="#fbbf24" />
          <Text style={styles.quoteText}>"{dailyQuote}"</Text>
        </View>
      )}

      {/* Posts */}
      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={item => item.post_id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={60} color="#6b7280" />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share!</Text>
          </View>
        }
      />

      {/* New Post Modal */}
      <Modal
        visible={showNewPostModal}
        animationType="slide"
        transparent={true}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Post</Text>
              <TouchableOpacity onPress={() => setShowNewPostModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Post Type Selector */}
            <View style={styles.typeSelector}>
              {POST_TYPES.map(type => (
                <TouchableOpacity
                  key={type.key}
                  style={[styles.typeButton, postType === type.key && styles.typeButtonActive]}
                  onPress={() => setPostType(type.key)}
                >
                  <Ionicons 
                    name={type.icon} 
                    size={20} 
                    color={postType === type.key ? '#818cf8' : '#9ca3af'} 
                  />
                  <Text style={[styles.typeText, postType === type.key && styles.typeTextActive]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.postInput}
              placeholder="What's on your mind?"
              placeholderTextColor="#6b7280"
              multiline
              value={newPost}
              onChangeText={setNewPost}
            />

            {postType === 'gif' && (
              <View style={styles.gifSection}>
                <View style={styles.gifSearchRow}>
                  <TextInput
                    style={styles.gifSearchInput}
                    placeholder="Search GIFs..."
                    placeholderTextColor="#6b7280"
                    value={gifSearch}
                    onChangeText={setGifSearch}
                    onSubmitEditing={() => searchGifs(gifSearch)}
                  />
                  <TouchableOpacity 
                    style={styles.gifSearchButton}
                    onPress={() => searchGifs(gifSearch)}
                  >
                    <Ionicons name="search" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                {selectedGif && (
                  <View style={styles.selectedGif}>
                    <Image source={{ uri: selectedGif.url }} style={styles.gifPreview} />
                    <TouchableOpacity 
                      style={styles.removeGif}
                      onPress={() => setSelectedGif(null)}
                    >
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}

                <FlatList
                  horizontal
                  data={gifs}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setSelectedGif(item)}>
                      <Image source={{ uri: item.preview }} style={styles.gifOption} />
                    </TouchableOpacity>
                  )}
                  style={styles.gifList}
                />
              </View>
            )}

            <TouchableOpacity 
              style={[styles.postButton, posting && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={posting}
            >
              {posting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0d1a',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0d1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  newPostButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#818cf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  quoteText: {
    flex: 1,
    color: '#fcd34d',
    fontSize: 14,
    fontStyle: 'italic',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#818cf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  postMeta: {
    marginLeft: 12,
    flex: 1,
  },
  authorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  postTime: {
    color: '#9ca3af',
    fontSize: 12,
  },
  pollBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  pollBadgeText: {
    color: '#818cf8',
    fontSize: 12,
  },
  postContent: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  gifImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e1b4b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  typeButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    flex: 1,
    marginHorizontal: 4,
  },
  typeButtonActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#818cf8',
  },
  typeText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  typeTextActive: {
    color: '#818cf8',
  },
  postInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  gifSection: {
    marginBottom: 16,
  },
  gifSearchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  gifSearchInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
  },
  gifSearchButton: {
    backgroundColor: '#818cf8',
    width: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedGif: {
    position: 'relative',
    marginBottom: 12,
  },
  gifPreview: {
    width: '100%',
    height: 150,
    borderRadius: 12,
  },
  removeGif: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  gifList: {
    maxHeight: 80,
  },
  gifOption: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  postButton: {
    backgroundColor: '#818cf8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

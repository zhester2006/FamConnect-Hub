import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  RefreshControl, ActivityIndicator, Image, Modal, KeyboardAvoidingView, Platform, Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import firebaseFamilyWallService from '../services/firebase.familywall.service';
import MedalEmblem from '../components/MedalEmblem';

const POST_TYPES = [
  { key: 'message', icon: 'chatbubble', label: 'Message' },
  { key: 'photo', icon: 'image', label: 'Photo' },
  { key: 'poll', icon: 'stats-chart', label: 'Poll' },
  { key: 'gif', icon: 'happy', label: 'GIF' },
];

export default function FamilyWallScreen({ navigation }) {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [posts, setPosts] = useState([]);
  const [dailyQuote, setDailyQuote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [postType, setPostType] = useState('message');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [gifs, setGifs] = useState([]);
  const [gifSearch, setGifSearch] = useState('');
  const [selectedGif, setSelectedGif] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [posting, setPosting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const flatListRef = useRef(null);

  // Initialize Firebase Family Wall
  useEffect(() => {
    initializeFirebase();
    return () => {
      firebaseFamilyWallService.disconnect();
    };
  }, [user]);

  const initializeFirebase = async () => {
    try {
      const initialized = await firebaseFamilyWallService.initialize();
      if (initialized && user) {
        const familyId = user.current_family_id || user.parent_id || 'family_default';
        firebaseFamilyWallService.setUser(
          user.user_id,
          user.name,
          user.picture,
          familyId
        );

        // Connect and listen for real-time post updates
        const connected = firebaseFamilyWallService.connect((firebasePosts) => {
          if (firebasePosts && firebasePosts.length > 0) {
            setPosts(firebasePosts);
          }
        });

        if (connected) {
          setFirebaseConnected(true);
          console.log('Firebase Family Wall connected');
        }
      }
    } catch (error) {
      console.error('Firebase Family Wall init error:', error);
    }
  };

  const fetchPosts = useCallback(async () => {
    try {
      const [postsData, quoteData, leaderboardData] = await Promise.all([
        apiService.getFamilyWallPosts(),
        apiService.getDailyQuote().catch(() => ({ quote: '' })),
        apiService.getLeaderboard().catch(() => ({ leaderboard: [] })),
      ]);
      
      // Only use REST API posts if Firebase isn't connected or has no posts
      if (!firebaseConnected || posts.length === 0) {
        setPosts(postsData.posts || []);
      }
      setDailyQuote(quoteData.quote || '');
      setLeaderboard(leaderboardData.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }, [firebaseConnected, posts.length]);

  // Get user's rank from leaderboard
  const getUserRank = (userId) => {
    const index = leaderboard.findIndex(u => u.user_id === userId);
    return index !== -1 ? index + 1 : null;
  };

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

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow access to your photos to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const uploadImage = async (imageUri) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'post_image.jpg',
      });

      const response = await fetch(`${apiService.baseUrl}/upload/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiService.sessionToken}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Upload error:', error);
      // Return local URI as fallback (image will be stored locally)
      return imageUri;
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedGif && !selectedImage && postType !== 'poll') return;
    if (postType === 'poll' && pollOptions.filter(o => o.trim()).length < 2) {
      Alert.alert('Error', 'Please add at least 2 poll options');
      return;
    }
    
    setPosting(true);
    try {
      // Try Firebase first if connected
      if (firebaseConnected) {
        let result = null;
        
        if (postType === 'message') {
          result = await firebaseFamilyWallService.createTextPost(newPost);
        } else if (postType === 'photo' && selectedImage) {
          // Upload image first
          const imageUrl = await uploadImage(selectedImage.uri);
          result = await firebaseFamilyWallService.createPhotoPost(newPost, imageUrl);
        } else if (postType === 'gif' && selectedGif) {
          result = await firebaseFamilyWallService.createGifPost(newPost, selectedGif.url);
        } else if (postType === 'poll') {
          const validOptions = pollOptions.filter(o => o.trim());
          result = await firebaseFamilyWallService.createPollPost(newPost, validOptions);
        }

        if (result) {
          resetPostForm();
          return; // Firebase will update posts via real-time listener
        }
      }

      // Fallback to REST API
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage.uri);
      }

      await apiService.createFamilyWallPost({
        type: postType,
        content: newPost,
        gif_url: selectedGif?.url,
        image_url: imageUrl,
        poll_options: postType === 'poll' ? pollOptions.filter(o => o.trim()) : undefined,
      });
      
      resetPostForm();
      fetchPosts();
    } catch (error) {
      console.error('Failed to post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const resetPostForm = () => {
    setNewPost('');
    setSelectedGif(null);
    setSelectedImage(null);
    setPollOptions(['', '']);
    setPostType('message');
    setShowNewPostModal(false);
  };

  const handleLike = async (postId) => {
    try {
      // Try Firebase first
      if (firebaseConnected) {
        const success = await firebaseFamilyWallService.likePost(postId);
        if (success) return; // Firebase will update via real-time listener
      }
      // Fallback to REST API
      await apiService.likePost(postId);
      fetchPosts();
    } catch (error) {
      console.error('Failed to like:', error);
    }
  };

  const handleVote = async (postId, optionIndex) => {
    try {
      // Try Firebase first
      if (firebaseConnected) {
        const success = await firebaseFamilyWallService.voteOnPoll(postId, optionIndex);
        if (success) return; // Firebase will update via real-time listener
      }
      // Fallback to REST API
      await apiService.votePoll(postId, optionIndex);
      fetchPosts();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const addPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const updatePollOption = (index, value) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const removePollOption = (index) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
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

  const renderPollOptions = (post) => {
    const userVoted = post.user_voted_option !== undefined && post.user_voted_option !== null;
    
    // Calculate total votes from poll_options
    const totalVotes = post.poll_options?.reduce((sum, opt) => {
      const optionData = typeof opt === 'string' ? { votes: [] } : opt;
      return sum + (optionData.votes?.length || 0);
    }, 0) || 0;

    return (
      <View style={styles.pollContainer}>
        {post.poll_options?.map((option, index) => {
          const optionData = typeof option === 'string' ? { text: option, votes: [], voter_names: [] } : option;
          const optionText = optionData.text || option;
          const votes = optionData.votes || [];
          const voterNames = optionData.voter_names || [];
          const voteCount = votes.length;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isUserVote = post.user_voted_option === index;

          return (
            <TouchableOpacity
              key={index}
              style={[styles.pollOption, isUserVote && styles.pollOptionVoted]}
              onPress={() => {
                console.log('Poll option pressed:', index, 'userVoted:', userVoted);
                if (!userVoted) {
                  handleVote(post.post_id, index);
                }
              }}
              disabled={userVoted}
              activeOpacity={userVoted ? 1 : 0.7}
            >
              {userVoted && (
                <View style={[styles.pollProgress, { width: `${percentage}%` }]} />
              )}
              <View style={styles.pollOptionContent}>
                <View style={styles.pollOptionLeft}>
                  <Text style={[styles.pollOptionText, isUserVote && styles.pollOptionTextVoted]}>
                    {optionText}
                  </Text>
                  {userVoted && voterNames.length > 0 && (
                    <Text style={styles.pollVoterNames}>
                      {voterNames.slice(0, 3).join(', ')}{voterNames.length > 3 ? ` +${voterNames.length - 3}` : ''}
                    </Text>
                  )}
                </View>
                {userVoted && (
                  <View style={styles.pollOptionRight}>
                    <Text style={styles.pollPercentage}>{percentage}%</Text>
                    <Text style={styles.pollVoteCount}>{voteCount} vote{voteCount !== 1 ? 's' : ''}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        <Text style={styles.totalVotes}>{totalVotes} total vote{totalVotes !== 1 ? 's' : ''}</Text>
      </View>
    );
  };

  const renderPost = ({ item }) => {
    const authorRank = getUserRank(item.author_id);
    
    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.author_name?.charAt(0) || '?'}</Text>
            </View>
            {authorRank && authorRank <= 3 && (
              <View style={styles.medalPosition}>
                <MedalEmblem rank={authorRank} size="tiny" />
              </View>
            )}
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

      {item.type === 'poll' && item.poll_options && renderPollOptions(item)}

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
  };

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
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
              <TouchableOpacity onPress={resetPostForm}>
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
              placeholder={postType === 'poll' ? "Ask a question..." : "What's on your mind?"}
              placeholderTextColor="#6b7280"
              multiline
              value={newPost}
              onChangeText={setNewPost}
            />

            {/* Photo Upload Section */}
            {postType === 'photo' && (
              <View style={styles.photoSection}>
                <TouchableOpacity style={styles.photoPickerBtn} onPress={handlePickImage}>
                  <Ionicons name="image" size={24} color="#818cf8" />
                  <Text style={styles.photoPickerText}>
                    {selectedImage ? 'Change Photo' : 'Select Photo'}
                  </Text>
                </TouchableOpacity>
                
                {selectedImage && (
                  <View style={styles.selectedImageContainer}>
                    <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
                    <TouchableOpacity 
                      style={styles.removeImageBtn}
                      onPress={() => setSelectedImage(null)}
                    >
                      <Ionicons name="close-circle" size={28} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Poll Options Section */}
            {postType === 'poll' && (
              <View style={styles.pollSection}>
                <Text style={styles.pollSectionTitle}>Poll Options</Text>
                {pollOptions.map((option, index) => (
                  <View key={index} style={styles.pollInputRow}>
                    <TextInput
                      style={styles.pollInput}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor="#6b7280"
                      value={option}
                      onChangeText={(text) => updatePollOption(index, text)}
                    />
                    {pollOptions.length > 2 && (
                      <TouchableOpacity 
                        style={styles.removePollOption}
                        onPress={() => removePollOption(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {pollOptions.length < 6 && (
                  <TouchableOpacity style={styles.addOptionBtn} onPress={addPollOption}>
                    <Ionicons name="add-circle" size={20} color="#818cf8" />
                    <Text style={styles.addOptionText}>Add Option</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* GIF Search Section */}
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
                  showsHorizontalScrollIndicator={false}
                />
              </View>
            )}

            <TouchableOpacity 
              style={[styles.postButton, (posting || uploadingImage) && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={posting || uploadingImage}
            >
              {posting || uploadingImage ? (
                <View style={styles.postingIndicator}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.postButtonText}>
                    {uploadingImage ? 'Uploading...' : 'Posting...'}
                  </Text>
                </View>
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
  container: { flex: 1, backgroundColor: '#0f0d1a' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d1a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  newPostButton: { backgroundColor: '#6366f1', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  quoteCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  quoteText: { flex: 1, color: '#a5b4fc', fontSize: 13, fontStyle: 'italic' },
  listContent: { padding: 16, paddingBottom: 100 },
  postCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 16, marginBottom: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  medalPosition: { position: 'absolute', bottom: -2, right: -2 },
  postMeta: { flex: 1, marginLeft: 12 },
  authorName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  postTime: { color: '#6b7280', fontSize: 12 },
  pollBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(129, 140, 248, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pollBadgeText: { color: '#818cf8', fontSize: 11, fontWeight: '500' },
  postContent: { color: '#e5e7eb', fontSize: 15, lineHeight: 22, marginBottom: 12 },
  gifImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12 },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12 },
  pollContainer: { marginTop: 8, marginBottom: 12 },
  pollOption: { backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 10, padding: 14, marginBottom: 8, overflow: 'hidden', position: 'relative' },
  pollOptionVoted: { borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  pollProgress: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: 10 },
  pollOptionContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  pollOptionLeft: { flex: 1 },
  pollOptionRight: { alignItems: 'flex-end' },
  pollVoterNames: { color: '#6b7280', fontSize: 11, marginTop: 4 },
  pollVoteCount: { color: '#6b7280', fontSize: 10, marginTop: 2 },
  pollOptionText: { color: '#e5e7eb', fontSize: 14 },
  pollOptionTextVoted: { fontWeight: '600' },
  pollPercentage: { color: '#818cf8', fontSize: 14, fontWeight: '600' },
  totalVotes: { color: '#6b7280', fontSize: 12, textAlign: 'center', marginTop: 4 },
  postActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12, gap: 20 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#9ca3af', fontSize: 13 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: '#9ca3af', fontSize: 18, marginTop: 16 },
  emptySubtext: { color: '#6b7280', fontSize: 14, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  typeSelector: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  typeButton: { alignItems: 'center', padding: 12, borderRadius: 12, flex: 1, marginHorizontal: 4, backgroundColor: 'rgba(99, 102, 241, 0.1)' },
  typeButtonActive: { backgroundColor: 'rgba(99, 102, 241, 0.3)', borderWidth: 1, borderColor: '#818cf8' },
  typeText: { color: '#9ca3af', fontSize: 11, marginTop: 4, fontWeight: '500' },
  typeTextActive: { color: '#818cf8' },
  postInput: { backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  photoSection: { marginBottom: 16 },
  photoPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(99, 102, 241, 0.2)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)', borderStyle: 'dashed' },
  photoPickerText: { color: '#818cf8', fontSize: 15, fontWeight: '500' },
  selectedImageContainer: { marginTop: 12, position: 'relative' },
  selectedImage: { width: '100%', height: 200, borderRadius: 12 },
  removeImageBtn: { position: 'absolute', top: 8, right: 8 },
  pollSection: { marginBottom: 16 },
  pollSectionTitle: { color: '#a5b4fc', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  pollInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  pollInput: { flex: 1, backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15 },
  removePollOption: { marginLeft: 8 },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, marginTop: 4 },
  addOptionText: { color: '#818cf8', fontSize: 14, fontWeight: '500' },
  gifSection: { marginBottom: 16 },
  gifSearchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  gifSearchInput: { flex: 1, backgroundColor: 'rgba(15, 13, 26, 0.5)', borderRadius: 12, padding: 12, color: '#fff', fontSize: 15 },
  gifSearchButton: { backgroundColor: '#6366f1', width: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  selectedGif: { position: 'relative', marginBottom: 12 },
  gifPreview: { width: '100%', height: 150, borderRadius: 12 },
  removeGif: { position: 'absolute', top: 8, right: 8 },
  gifList: { maxHeight: 80 },
  gifOption: { width: 80, height: 80, borderRadius: 8, marginRight: 8 },
  postButton: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center' },
  postButtonDisabled: { opacity: 0.6 },
  postingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

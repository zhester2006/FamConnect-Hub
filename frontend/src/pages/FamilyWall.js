import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Image as ImageIcon, Plus, TrendingUp, Smile, Send, X, BarChart2, Check, Search, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Avatar } from '@/components/Avatar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const EMOJI_LIST = ['😀', '😂', '❤️', '👍', '🎉', '🔥', '💪', '⭐', '🌟', '✨', '🏠', '👨‍👩‍👧‍👦', '🍕', '🎮', '📚', '🎨', '⚽', '🎵', '💯', '🙌'];

const PollComponent = ({ poll, user, onVote, familyMembers = [] }) => {
  const totalVotes = poll.poll_options?.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0) || 0;
  const hasVoted = poll.poll_options?.some(opt => opt.votes?.includes(user?.user_id));

  // Helper to get member name by ID
  const getMemberName = (userId) => {
    const member = familyMembers.find(m => m.user_id === userId);
    return member?.name || member?.nickname || userId?.slice(0, 8);
  };

  return (
    <div className="mt-3 bg-slate-800/50 rounded-xl p-4 border border-slate-700" data-testid="poll-component">
      {/* Poll Question */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
          <BarChart2 className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="text-white font-bold">{poll.content || 'Poll'}</p>
          <p className="text-xs text-slate-400">{totalVotes} vote{totalVotes !== 1 ? 's' : ''} • {hasVoted ? 'You voted' : 'Tap to vote'}</p>
        </div>
      </div>

      {/* Poll Options */}
      <div className="space-y-3">
        {poll.poll_options?.map((option, idx) => {
          const voteCount = option.votes?.length || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const userVoted = option.votes?.includes(user?.user_id);
          
          return (
            <div key={idx} className="space-y-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasVoted) onVote(poll.post_id, idx);
                }}
                disabled={hasVoted}
                className={`w-full relative overflow-hidden rounded-xl p-4 transition-all ${
                  hasVoted ? 'cursor-default' : 'hover:scale-[1.01] cursor-pointer active:scale-[0.99]'
                } ${userVoted ? 'border-2 border-primary bg-primary/10' : 'border border-slate-600 bg-slate-900/50 hover:bg-slate-800/50'}`}
                data-testid={`poll-option-${idx}`}
              >
                {/* Progress bar background */}
                <div 
                  className={`absolute inset-0 transition-all ${userVoted ? 'bg-primary/30' : 'bg-slate-700/30'}`}
                  style={{ width: hasVoted ? `${percentage}%` : '0%' }}
                />
                
                {/* Option content */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {!hasVoted && (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-500 flex items-center justify-center">
                        {userVoted && <div className="w-3 h-3 rounded-full bg-primary" />}
                      </div>
                    )}
                    <span className="text-white font-medium">{option.text}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {userVoted && <Check className="w-5 h-5 text-primary" />}
                    {hasVoted && (
                      <span className="text-white font-bold">{percentage}%</span>
                    )}
                    <span className="text-slate-400 text-sm">({voteCount})</span>
                  </div>
                </div>
              </button>

              {/* Voter names */}
              {hasVoted && option.votes?.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-2">
                  {option.votes.map((voterId, i) => (
                    <span 
                      key={i} 
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        voterId === user?.user_id 
                          ? 'bg-primary/20 text-primary font-medium' 
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {voterId === user?.user_id ? 'You' : getMemberName(voterId)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Vote instruction */}
      {!hasVoted && (
        <p className="text-xs text-slate-500 text-center mt-3">
          Each family member gets one vote
        </p>
      )}
    </div>
  );
};

// GIF Picker Component
const GifPicker = ({ onSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTrending, setShowTrending] = useState(true);

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/gifs/trending?limit=20`, { credentials: 'include' });
      const data = await res.json();
      setGifs(data.gifs || []);
      setShowTrending(true);
    } catch (error) {
      console.error('Failed to fetch trending GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async () => {
    if (!searchQuery.trim()) {
      fetchTrending();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/gifs/search?q=${encodeURIComponent(searchQuery)}&limit=20`, { credentials: 'include' });
      const data = await res.json();
      setGifs(data.gifs || []);
      setShowTrending(false);
    } catch (error) {
      console.error('Failed to search GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute bottom-12 left-0 w-80 max-h-96 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden" data-testid="gif-picker">
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-white">GIFs</span>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchGifs()}
            placeholder="Search GIFs..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
            data-testid="gif-search-input"
          />
          <button
            onClick={searchGifs}
            className="p-2 bg-primary hover:bg-primary/80 rounded-lg transition-all"
            data-testid="gif-search-btn"
          >
            <Search className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
      
      <div className="p-2 max-h-64 overflow-y-auto">
        {showTrending && !searchQuery && (
          <p className="text-xs text-slate-500 mb-2 px-1">Trending</p>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : gifs.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect(gif)}
                className="relative overflow-hidden rounded-lg hover:ring-2 hover:ring-primary transition-all"
                data-testid={`gif-${gif.id}`}
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className="w-full h-24 object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">No GIFs found</p>
        )}
      </div>
      
      <div className="p-2 border-t border-slate-800 text-center">
        <span className="text-[10px] text-slate-600">Powered by Tenor</span>
      </div>
    </div>
  );
};

export default function FamilyWall({ user }) {
  const [posts, setPosts] = useState([]);
  const [quote, setQuote] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteType, setQuoteType] = useState('inspiration'); // 'inspiration' or 'bible'
  const [newPost, setNewPost] = useState('');
  const [selectedGif, setSelectedGif] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const inputRef = useRef(null);
  const postsEndRef = useRef(null);

  useEffect(() => {
    fetchPosts();
    fetchDailyQuote();
    fetchFamilyMembers();
  }, []);

  useEffect(() => {
    fetchDailyQuote(true);
  }, [quoteType]);

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/family-wall`, { credentials: 'include' });
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    }
  };

  const fetchFamilyMembers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/family/members`, { credentials: 'include' });
      const data = await res.json();
      setFamilyMembers(data.members || []);
    } catch (error) {
      console.error('Failed to fetch family members:', error);
    }
  };

  const fetchDailyQuote = async (forceRefresh = false) => {
    setQuoteLoading(true);
    try {
      const token = localStorage.getItem('dev_session_token');
      let url = forceRefresh 
        ? `${BACKEND_URL}/api/family-wall/daily-quote?refresh=true&quote_type=${quoteType}`
        : `${BACKEND_URL}/api/family-wall/daily-quote?quote_type=${quoteType}`;
      const res = await fetch(url, { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      setQuote(data.quote || '');
      if (forceRefresh) {
        // No toast - user requested removal of inspiration notifications
      }
    } catch (error) {
      console.error('Failed to fetch quote:', error);
      if (forceRefresh) {
        toast.error('Failed to load quote');
      }
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleSubmitPost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && !selectedGif) return;

    try {
      await fetch(`${BACKEND_URL}/api/family-wall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          content: newPost, 
          post_type: selectedGif ? 'gif' : 'text',
          media_url: selectedGif?.url,
          media_type: selectedGif ? 'gif' : null
        })
      });
      setNewPost('');
      setSelectedGif(null);
      fetchPosts();
      toast.success('Posted!');
    } catch (error) {
      toast.error('Failed to post');
    }
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
      toast.error('Please add a question and at least 2 options');
      return;
    }

    try {
      await fetch(`${BACKEND_URL}/api/family-wall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: pollQuestion,
          post_type: 'poll',
          poll_options: pollOptions.filter(o => o.trim()).map(text => ({ text, votes: [] }))
        })
      });
      setShowPollCreator(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      fetchPosts();
      toast.success('Poll created!');
    } catch (error) {
      toast.error('Failed to create poll');
    }
  };

  const handleVote = async (postId, optionIndex) => {
    try {
      await fetch(`${BACKEND_URL}/api/family-wall/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ option_index: optionIndex })
      });
      fetchPosts();
      toast.success('Vote recorded!');
    } catch (error) {
      toast.error('Failed to vote');
    }
  };

  const addEmoji = (emoji) => {
    setNewPost(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleSelectGif = (gif) => {
    setSelectedGif(gif);
    setShowGifPicker(false);
  };

  const addPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, '']);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-32" data-testid="family-wall">
          <div className="p-4 pt-16 md:pt-4 lg:p-6 lg:pt-6 pb-24 md:pb-6 space-y-4">
            <header className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-white">Family Wall</h1>
              {user?.role === 'parent' && (
                <button
                  onClick={() => setShowPollCreator(true)}
                  className="bg-accent hover:bg-accent/80 text-slate-950 px-4 py-2 rounded-full text-sm font-bold flex items-center space-x-2 transition-all"
                  data-testid="create-poll-btn"
                >
                  <BarChart2 className="w-4 h-4" />
                  <span>Create Poll</span>
                </button>
              )}
            </header>

            {/* Daily Quote */}
            {(quote || quoteLoading) && (
              <div className="glass-card rounded-2xl p-5 relative overflow-hidden" data-testid="daily-quote">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-accent">
                          {quoteType === 'bible' ? 'Daily Bible Verse' : 'Daily Inspiration'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Quote Type Toggle */}
                      <div className="flex bg-slate-800 rounded-lg p-0.5">
                        <button
                          onClick={() => setQuoteType('inspiration')}
                          className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                            quoteType === 'inspiration' 
                              ? 'bg-primary text-white' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          ✨ Inspire
                        </button>
                        <button
                          onClick={() => setQuoteType('bible')}
                          className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                            quoteType === 'bible' 
                              ? 'bg-primary text-white' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          ✝️ Bible
                        </button>
                      </div>
                      <button
                        onClick={() => fetchDailyQuote(true)}
                        disabled={quoteLoading}
                        className="p-2 rounded-full hover:bg-slate-800 transition-all disabled:opacity-50"
                        title="Get new quote"
                        data-testid="refresh-quote-btn"
                      >
                        <RefreshCw className={`w-4 h-4 text-slate-400 ${quoteLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                  {quoteLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 text-accent animate-spin" />
                    </div>
                  ) : (
                    <p className="text-base text-white font-medium italic leading-relaxed">&ldquo;{quote}&rdquo;</p>
                  )}
                </div>
              </div>
            )}

            {/* Posts */}
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.post_id} className="glass-card rounded-2xl p-4" data-testid="wall-post">
                  <div className="flex items-start space-x-3 mb-3">
                    <Avatar name={post.user_name} picture={post.author_picture || post.user_picture} size="md" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-sm">{post.user_name}</h3>
                      <p className="text-xs text-slate-400">
                        {new Date(post.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  {post.content && (
                    <p className="text-white text-sm leading-relaxed mb-3">{post.content}</p>
                  )}
                  
                  {post.media_url && (
                    <img 
                      src={post.media_url} 
                      alt="Post media" 
                      className="rounded-xl max-h-64 w-full object-cover mb-3"
                      data-testid="post-media"
                    />
                  )}

                  {post.post_type === 'poll' && (
                    <PollComponent poll={post} user={user} onVote={handleVote} familyMembers={familyMembers} />
                  )}

                  <div className="flex items-center space-x-4 pt-2 border-t border-slate-800">
                    <button className="flex items-center space-x-1 text-slate-400 hover:text-red-400 transition-all" data-testid="like-btn">
                      <Heart className="w-4 h-4" />
                      <span className="text-xs">Like</span>
                    </button>
                    <button className="flex items-center space-x-1 text-slate-400 hover:text-primary transition-all" data-testid="comment-btn">
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-xs">Comment</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div ref={postsEndRef} />
          </div>
        </div>

        {/* Sticky Input Bar at Bottom */}
        <div className={`fixed bottom-20 md:bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 p-3 z-40 transition-all duration-300 ${sidebarCollapsed ? 'lg:left-16' : 'lg:left-64'}`}>
          {/* Selected GIF Preview */}
          {selectedGif && (
            <div className="mb-2 relative inline-block">
              <img src={selectedGif.preview} alt="Selected GIF" className="h-20 rounded-lg" />
              <button
                onClick={() => setSelectedGif(null)}
                className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          )}
          
          <form onSubmit={handleSubmitPost} className="flex items-center space-x-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                className="p-2 hover:bg-slate-800 rounded-full transition-all"
                data-testid="emoji-btn"
              >
                <Smile className="w-5 h-5 text-slate-400" />
              </button>
              
              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl z-50">
                  <div className="grid grid-cols-5 gap-2">
                    {EMOJI_LIST.map((emoji, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => addEmoji(emoji)}
                        className="text-xl hover:scale-125 transition-transform p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                className={`p-2 hover:bg-slate-800 rounded-full transition-all ${showGifPicker ? 'bg-slate-800' : ''}`}
                data-testid="gif-btn"
              >
                <span className="text-xs font-bold text-slate-400">GIF</span>
              </button>
              
              {/* GIF Picker */}
              {showGifPicker && (
                <GifPicker onSelect={handleSelectGif} onClose={() => setShowGifPicker(false)} />
              )}
            </div>

            <button
              type="button"
              className="p-2 hover:bg-slate-800 rounded-full transition-all"
              data-testid="media-btn"
            >
              <ImageIcon className="w-5 h-5 text-slate-400" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Share something with your family..."
              className="flex-1 bg-slate-800/50 border border-slate-700 rounded-full px-4 py-2.5 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-primary transition-all"
              data-testid="post-input"
            />

            <button
              type="submit"
              disabled={!newPost.trim() && !selectedGif}
              className="p-2.5 bg-primary hover:bg-primary/80 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-full transition-all"
              data-testid="send-btn"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </form>
        </div>

        {/* Poll Creator Modal */}
        {showPollCreator && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-white">Create Poll</h2>
                <button onClick={() => setShowPollCreator(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Question</label>
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="What's for dinner tonight?"
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 text-sm"
                    data-testid="poll-question-input"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Options</label>
                  <div className="space-y-2">
                    {pollOptions.map((option, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className="text-slate-500 text-sm w-6">{idx + 1}.</span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...pollOptions];
                            newOptions[idx] = e.target.value;
                            setPollOptions(newOptions);
                          }}
                          placeholder={`Option ${idx + 1}`}
                          className="flex-1 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 text-sm"
                          data-testid={`poll-option-${idx}`}
                        />
                      </div>
                    ))}
                  </div>
                  {pollOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={addPollOption}
                      className="mt-2 text-primary text-sm font-medium hover:underline"
                    >
                      + Add another option
                    </button>
                  )}
                </div>

                <button
                  onClick={handleCreatePoll}
                  className="w-full bg-accent hover:bg-accent/80 text-slate-950 font-bold py-3 rounded-full transition-all"
                  data-testid="create-poll-submit"
                >
                  Create Poll
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

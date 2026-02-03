import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Image as ImageIcon, Plus, TrendingUp } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function FamilyWall({ user }) {
  const [posts, setPosts] = useState([]);
  const [quote, setQuote] = useState('');
  const [showAddPost, setShowAddPost] = useState(false);
  const [newPost, setNewPost] = useState({ content: '', post_type: 'text' });

  useEffect(() => {
    fetchPosts();
    fetchDailyQuote();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/family-wall`, { credentials: 'include' });
      const data = await res.json();
      setPosts(data.posts);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    }
  };

  const fetchDailyQuote = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/family-wall/daily-quote`, { credentials: 'include' });
      const data = await res.json();
      setQuote(data.quote);
    } catch (error) {
      console.error('Failed to fetch quote:', error);
    }
  };

  const handleAddPost = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BACKEND_URL}/api/family-wall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newPost)
      });
      setShowAddPost(false);
      setNewPost({ content: '', post_type: 'text' });
      fetchPosts();
    } catch (error) {
      console.error('Failed to add post:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-24" data-testid="family-wall">
      <div className="p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white">Family Wall</h1>
          <button
            onClick={() => setShowAddPost(true)}
            className="bg-primary hover:bg-primary/80 text-white p-2 rounded-full transition-all neon-glow"
            data-testid="add-post-button"
          >
            <Plus className="w-6 h-6" />
          </button>
        </header>

        {quote && (
          <div className="glass-card rounded-3xl p-6 relative overflow-hidden" data-testid="daily-quote">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-3">
                <TrendingUp className="w-5 h-5 text-accent" />
                <span className="text-sm font-bold text-accent">Daily Inspiration</span>
              </div>
              <p className="text-lg text-white font-medium italic">"{quote}"</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.post_id} className="glass-card rounded-2xl p-5" data-testid="wall-post">
              <div className="flex items-start space-x-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-black text-white flex-shrink-0">
                  {post.user_name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white">{post.user_name}</h3>
                  <p className="text-xs text-slate-400">
                    {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-white mb-4 leading-relaxed">{post.content}</p>
              <div className="flex items-center space-x-4 text-slate-400">
                <button className="flex items-center space-x-1 hover:text-red-400 transition-all" data-testid="like-button">
                  <Heart className="w-5 h-5" />
                  <span className="text-sm">Like</span>
                </button>
                <button className="flex items-center space-x-1 hover:text-primary transition-all" data-testid="comment-button">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm">Comment</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAddPost && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" data-testid="add-post-modal">
          <div className="glass-card rounded-3xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-black text-white mb-4">New Post</h2>
            <form onSubmit={handleAddPost} className="space-y-4">
              <textarea
                placeholder="Share something with your family..."
                value={newPost.content}
                onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 h-32 resize-none"
                required
                data-testid="post-content-input"
              />
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/80 text-white font-bold py-3 px-4 rounded-full transition-all"
                  data-testid="submit-post-button"
                >
                  Post
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPost(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-full transition-all"
                  data-testid="cancel-post-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <BottomNav userRole={user?.role} />
    </div>
  );
}
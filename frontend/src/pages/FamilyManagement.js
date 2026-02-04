import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, UserPlus, Check, X, ArrowLeftRight, Crown, Home, Mail, Loader2, ChevronRight, LogOut, Sparkles } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function FamilyManagement({ user, onFamilySwitch }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [selectedFamilyForInvite, setSelectedFamilyForInvite] = useState(null);
  const [switching, setSwitching] = useState(null);
  const [processing, setProcessing] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [familiesRes, invitesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/families`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/families/invites/pending`, { credentials: 'include' })
      ]);

      const familiesData = await familiesRes.json();
      const invitesData = await invitesRes.json();

      setFamilies(familiesData.families || []);
      setPendingInvites(invitesData.invites || []);
    } catch (error) {
      console.error('Failed to fetch families:', error);
      toast.error('Failed to load family data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim()) {
      toast.error('Please enter a family name');
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/families`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newFamilyName })
      });

      if (res.ok) {
        toast.success('Family created successfully!');
        setShowCreateModal(false);
        setNewFamilyName('');
        fetchData();
      } else {
        toast.error('Failed to create family');
      }
    } catch (error) {
      console.error('Failed to create family:', error);
      toast.error('Failed to create family');
    }
  };

  const handleSwitchFamily = async (familyId) => {
    setSwitching(familyId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/switch/${familyId}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (res.ok) {
        toast.success('Switched family successfully!');
        if (onFamilySwitch) onFamilySwitch(familyId);
        fetchData();
      } else {
        toast.error('Failed to switch family');
      }
    } catch (error) {
      console.error('Failed to switch family:', error);
      toast.error('Failed to switch family');
    } finally {
      setSwitching(null);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedFamilyForInvite) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${selectedFamilyForInvite}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      if (res.ok) {
        toast.success('Invitation sent!');
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteRole('member');
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error('Failed to send invitation');
    }
  };

  const handleAcceptInvite = async (inviteId) => {
    setProcessing(inviteId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/invites/${inviteId}/accept`, {
        method: 'POST',
        credentials: 'include'
      });

      if (res.ok) {
        toast.success('Joined family successfully!');
        fetchData();
      } else {
        toast.error('Failed to accept invitation');
      }
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      toast.error('Failed to accept invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    setProcessing(inviteId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/invites/${inviteId}/decline`, {
        method: 'POST',
        credentials: 'include'
      });

      if (res.ok) {
        toast.info('Invitation declined');
        fetchData();
      } else {
        toast.error('Failed to decline invitation');
      }
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      toast.error('Failed to decline invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleLeaveFamily = async (familyId) => {
    if (!window.confirm('Are you sure you want to leave this family?')) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${familyId}/leave`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        toast.success('Left family successfully');
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to leave family');
      }
    } catch (error) {
      console.error('Failed to leave family:', error);
      toast.error('Failed to leave family');
    }
  };

  const openInviteModal = (familyId) => {
    setSelectedFamilyForInvite(familyId);
    setShowInviteModal(true);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-indigo-900/30 via-purple-900/20 to-slate-950">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen relative">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/15 to-slate-950 pointer-events-none" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-purple-500/10 animate-float-slow"
            style={{
              width: Math.random() * 100 + 40,
              height: Math.random() * 100 + 40,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 20 + 15}s`
            }}
          />
        ))}
      </div>

      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      <main className={`flex-1 overflow-y-auto transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-6 pb-24 md:pb-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                Family Management
              </h1>
              <p className="text-sm text-slate-400 mt-1">Switch between families or create new ones</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/80 rounded-xl text-white font-bold transition-all"
              data-testid="create-family-btn"
            >
              <Plus className="w-5 h-5" />
              Create Family
            </button>
          </div>

          {/* Pending Invitations */}
          {pendingInvites.length > 0 && (
            <div className="glass-card rounded-2xl p-5" data-testid="pending-invites-section">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-accent" />
                Pending Invitations
                <span className="ml-2 px-2 py-0.5 bg-accent/20 text-accent text-xs font-bold rounded-full">
                  {pendingInvites.length}
                </span>
              </h2>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.invite_id}
                    className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700"
                    data-testid={`invite-${invite.invite_id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{invite.family_name || 'Unknown Family'}</h3>
                        <p className="text-xs text-slate-400">Invited as {invite.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptInvite(invite.invite_id)}
                        disabled={processing === invite.invite_id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-all"
                        data-testid={`accept-invite-${invite.invite_id}`}
                      >
                        {processing === invite.invite_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineInvite(invite.invite_id)}
                        disabled={processing === invite.invite_id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-slate-300 text-sm font-medium transition-all"
                        data-testid={`decline-invite-${invite.invite_id}`}
                      >
                        <X className="w-4 h-4" />
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Your Families */}
          <div className="glass-card rounded-2xl p-5" data-testid="families-section">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Home className="w-5 h-5 text-primary" />
              Your Families
            </h2>
            
            {families.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No families yet. Create one to get started!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {families.map((family) => (
                  <div
                    key={family.family_id}
                    className={`relative p-5 rounded-xl border-2 transition-all ${
                      family.is_current
                        ? 'bg-primary/10 border-primary'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    }`}
                    data-testid={`family-card-${family.family_id}`}
                  >
                    {family.is_current && (
                      <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-primary text-white text-xs font-bold rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Current
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          family.role === 'parent' || family.role === 'admin'
                            ? 'bg-gradient-to-br from-yellow-500 to-orange-500'
                            : 'bg-gradient-to-br from-primary to-secondary'
                        }`}>
                          {family.role === 'parent' || family.role === 'admin' ? (
                            <Crown className="w-6 h-6 text-white" />
                          ) : (
                            <Users className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-lg">{family.name}</h3>
                          <p className="text-xs text-slate-400 capitalize">{family.role}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm mb-4">
                      <span className="text-slate-400">
                        {family.member_count} member{family.member_count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!family.is_current && (
                        <button
                          onClick={() => handleSwitchFamily(family.family_id)}
                          disabled={switching === family.family_id}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-all"
                          data-testid={`switch-to-${family.family_id}`}
                        >
                          {switching === family.family_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowLeftRight className="w-4 h-4" />
                          )}
                          Switch
                        </button>
                      )}
                      
                      {(family.role === 'parent' || family.role === 'admin') && (
                        <button
                          onClick={() => openInviteModal(family.family_id)}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-white text-sm font-medium transition-all"
                          data-testid={`invite-to-${family.family_id}`}
                        >
                          <UserPlus className="w-4 h-4" />
                          Invite
                        </button>
                      )}
                      
                      {family.role !== 'parent' && !family.is_current && (
                        <button
                          onClick={() => handleLeaveFamily(family.family_id)}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-all"
                          data-testid={`leave-${family.family_id}`}
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Family Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md" data-testid="create-family-modal">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Create New Family
            </h2>
            
            <input
              type="text"
              placeholder="Family Name"
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary mb-4"
              data-testid="family-name-input"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFamily}
                className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/80 rounded-xl text-white font-bold transition-all"
                data-testid="confirm-create-family"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md" data-testid="invite-modal">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-secondary" />
              Invite to Family
            </h2>
            
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-secondary mb-4"
              data-testid="invite-email-input"
            />
            
            <div className="mb-4">
              <label className="text-sm text-slate-400 mb-2 block">Role</label>
              <div className="flex gap-2">
                {['member', 'parent'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setInviteRole(role)}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                      inviteRole === role
                        ? 'bg-secondary text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                }}
                className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                className="flex-1 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-xl text-white font-bold transition-all"
                data-testid="send-invite-btn"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

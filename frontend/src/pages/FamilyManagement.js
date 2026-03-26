import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, UserPlus, Check, X, Crown, Mail, Loader2, Trash2, Edit2, Baby, User, Shield, Lock, Copy, Link, Home, Share2, MessageCircle } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Avatar } from '@/components/Avatar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Role descriptions
const ROLE_INFO = {
  parent: {
    icon: Shield,
    color: 'from-yellow-500 to-orange-500',
    description: 'Full access: manage members, approve chores, set rewards'
  },
  member: {
    icon: User,
    color: 'from-blue-500 to-cyan-500',
    description: 'Standard access: view schedules, participate in family activities'
  },
  child: {
    icon: Baby,
    color: 'from-pink-500 to-purple-500',
    description: 'Limited access: complete chores, earn points, view rewards'
  },
  homehub: {
    icon: Home,
    color: 'from-green-500 to-teal-500',
    description: 'Home Hub display: shared family device, PIN required for actions'
  }
};

export default function FamilyManagement({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [modal, setModal] = useState({ type: null, data: null });
  const [formData, setFormData] = useState({ name: '', email: '', role: 'child' });
  const [processing, setProcessing] = useState(null);
  const [childFormData, setChildFormData] = useState({ name: '', pin: '', picture: '', username: '', password: '' });
  const [createdInviteLink, setCreatedInviteLink] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);
  const [editCredentialsModal, setEditCredentialsModal] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [familiesRes, invitesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/families`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/families/invites/pending`, { credentials: 'include' })
      ]);

      const familiesData = await familiesRes.json();
      const invitesData = await invitesRes.json();
      const familiesList = familiesData.families || [];

      // Get current/first family
      const currentFamily = familiesList.find(f => f.is_current) || familiesList[0];
      setFamily(currentFamily || null);
      setPendingInvites(invitesData.invites || []);
      
      // Fetch members if family exists
      if (currentFamily) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/families/${currentFamily.family_id}/members`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            setMembers(data.members || []);
          }
        } catch (e) {
          setMembers([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch family:', error);
      toast.error('Failed to load family data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateFamily = async () => {
    if (!formData.name.trim()) { toast.error('Please enter a family name'); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/api/families`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ name: formData.name })
      });
      if (res.ok) { 
        toast.success('Family created!'); 
        setModal({ type: null }); 
        setFormData({ name: '', email: '', role: 'child' }); 
        fetchData(); 
      } else { 
        toast.error('Failed to create family'); 
      }
    } catch (error) { toast.error('Failed to create family'); }
  };

  const handleEditFamily = async () => {
    if (!formData.name.trim() || !family) return;
    try {
      const token = localStorage.getItem('dev_session_token');
      const res = await fetch(`${BACKEND_URL}/api/families/${family.family_id}`, {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        credentials: 'include', body: JSON.stringify({ name: formData.name })
      });
      if (res.ok) { toast.success('Family name updated!'); setModal({ type: null }); fetchData(); }
      else { const data = await res.json(); toast.error(data.detail || 'Failed to update family'); }
    } catch (error) { toast.error('Failed to update family'); }
  };

  const handleInvite = async () => {
    if (!formData.email.trim() || !family) { toast.error('Please enter an email'); return; }
    setProcessing('invite');
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${family.family_id}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ email: formData.email, role: formData.role })
      });
      const data = await res.json();
      if (res.ok) { 
        setInviteResult(data);
        toast.success(data.email_status === 'sent' ? 'Invitation email sent!' : 'Invite code generated!');
      } else { 
        toast.error(data.detail || 'Failed to send invitation'); 
      }
    } catch (error) { toast.error('Failed to send invitation'); }
    finally { setProcessing(null); }
  };

  const handleChangeMemberRole = async (memberId, newRole) => {
    if (!family) return;
    setProcessing(memberId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${family.family_id}/members/${memberId}/role`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ role: newRole })
      });
      if (res.ok) { toast.success(`Role changed to ${newRole}!`); fetchData(); }
      else { const data = await res.json(); toast.error(data.detail || 'Failed to change role'); }
    } catch (error) { toast.error('Failed to change role'); }
    finally { setProcessing(null); setModal({ type: null }); }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!family) return;
    setModal({ type: 'deleteMember', data: { user_id: memberId, name: memberName } });
  };

  const executeRemoveMember = async (memberId) => {
    setProcessing(memberId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${family.family_id}/members/${memberId}`, { 
        method: 'DELETE', credentials: 'include' 
      });
      if (res.ok) { toast.success('Member removed from family'); fetchData(); }
      else { const data = await res.json(); toast.error(data.detail || 'Failed to remove member'); }
    } catch (error) { toast.error('Failed to remove member'); }
    finally { setProcessing(null); setModal({ type: null }); }
  };

  const executeDeleteProfile = async (memberId) => {
    setProcessing(memberId);
    try {
      const token = localStorage.getItem('dev_session_token');
      const res = await fetch(`${BACKEND_URL}/api/users/${memberId}`, { 
        method: 'DELETE', credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) { toast.success('Profile completely deleted'); fetchData(); }
      else { const data = await res.json(); toast.error(data.detail || 'Failed to delete profile'); }
    } catch (error) { toast.error('Failed to delete profile'); }
    finally { setProcessing(null); setModal({ type: null }); }
  };

  const handleAcceptInvite = async (inviteId) => {
    setProcessing(inviteId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/invites/${inviteId}/accept`, { method: 'POST', credentials: 'include' });
      if (res.ok) { toast.success('Welcome to the family!'); fetchData(); }
      else { toast.error('Failed to accept invitation'); }
    } catch (error) { toast.error('Failed to accept invitation'); }
    finally { setProcessing(null); }
  };

  const handleDeclineInvite = async (inviteId) => {
    setProcessing(inviteId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/invites/${inviteId}/decline`, { method: 'POST', credentials: 'include' });
      if (res.ok) { toast.info('Invitation declined'); fetchData(); }
      else { toast.error('Failed to decline invitation'); }
    } catch (error) { toast.error('Failed to decline invitation'); }
    finally { setProcessing(null); }
  };

  const handleCreateChildProfile = async () => {
    if (!childFormData.name.trim()) { 
      toast.error('Please enter a name for the child'); 
      return; 
    }
    if (!childFormData.username || childFormData.username.length < 3) {
      toast.error('Please enter a username (at least 3 characters)');
      return;
    }
    if (!childFormData.password || childFormData.password.length < 4) {
      toast.error('Please enter a password (at least 4 characters)');
      return;
    }
    if (!childFormData.pin || childFormData.pin.length !== 4 || !/^\d+$/.test(childFormData.pin)) {
      toast.error('Please enter a 4-digit PIN');
      return;
    }
    
    setProcessing('createChild');
    try {
      const token = localStorage.getItem('dev_session_token');
      const res = await fetch(`${BACKEND_URL}/api/users/child`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          name: childFormData.name,
          pin: childFormData.pin,
          username: childFormData.username,
          password: childFormData.password,
          picture: childFormData.picture || null
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`Profile created for ${childFormData.name}!`);
        
        // Show the invite link
        if (data.invite_link) {
          const fullLink = `${window.location.origin}${data.invite_link}`;
          setCreatedInviteLink(fullLink);
        }
        
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to create child profile');
      }
    } catch (error) {
      console.error('Create child error:', error);
      toast.error('Failed to create child profile');
    } finally {
      setProcessing(null);
    }
  };

  const handleSetMemberPin = async (memberId) => {
    const pin = prompt('Enter a 4-digit PIN for this family member:');
    if (!pin) return;
    
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    
    setProcessing(memberId);
    try {
      const token = localStorage.getItem('dev_session_token');
      const res = await fetch(`${BACKEND_URL}/api/users/${memberId}/pin`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ pin })
      });
      
      if (res.ok) {
        toast.success('PIN set successfully!');
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to set PIN');
      }
    } catch (error) {
      toast.error('Failed to set PIN');
    } finally {
      setProcessing(null);
    }
  };

  const copyInviteLink = () => {
    if (createdInviteLink) {
      navigator.clipboard.writeText(createdInviteLink);
      toast.success('Invite link copied to clipboard!');
    }
  };

  const handleUpdateCredentials = async () => {
    if (!editCredentialsModal) return;
    
    const { user_id, name, email, username, password, pin } = editCredentialsModal;
    
    if (username && (username.length < 3 || !/^[a-z0-9]+$/.test(username))) {
      toast.error('Username must be at least 3 alphanumeric characters');
      return;
    }
    if (password && password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    if (pin && (pin.length !== 4 || !/^\d+$/.test(pin))) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    
    setProcessing('updateCreds');
    try {
      const token = localStorage.getItem('dev_session_token');
      const res = await fetch(`${BACKEND_URL}/api/users/${user_id}/credentials`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ name, email, username, password, pin })
      });
      
      if (res.ok) {
        toast.success('Credentials updated successfully!');
        setEditCredentialsModal(null);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to update credentials');
      }
    } catch (error) {
      toast.error('Failed to update credentials');
    } finally {
      setProcessing(null);
    }
  };

  const isAdmin = family?.role === 'parent' || family?.role === 'admin';
  const parentCount = members.filter(m => m.role === 'parent').length;
  const childCount = members.filter(m => m.role === 'child').length;
  const memberCount = members.filter(m => m.role === 'member').length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-indigo-900/30 via-purple-900/20 to-slate-950">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/15 to-slate-950 pointer-events-none" />
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      <main className={`flex-1 overflow-hidden transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'lg:ml-0' : 'md:ml-64'}`}>
        <div className="h-full overflow-y-auto p-4 lg:p-6 pb-24 md:pb-6 pt-16 md:pt-6">
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Pending Invitations */}
            {pendingInvites.length > 0 && (
              <div className="glass-card rounded-xl p-4" data-testid="pending-invites-section">
                <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-accent" /> Pending Invitations
                  <span className="ml-1 px-1.5 py-0.5 bg-accent/20 text-accent text-xs font-bold rounded-full">{pendingInvites.length}</span>
                </h2>
                <div className="space-y-2">
                  {pendingInvites.map((invite) => (
                    <div key={invite.invite_id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white">{invite.family_name || 'Family'}</h3>
                          <p className="text-xs text-slate-400">You're invited to join as <span className="text-accent capitalize">{invite.role}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleAcceptInvite(invite.invite_id)} 
                          disabled={processing === invite.invite_id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-all"
                        >
                          {processing === invite.invite_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Accept
                        </button>
                        <button 
                          onClick={() => handleDeclineInvite(invite.invite_id)} 
                          disabled={processing === invite.invite_id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-slate-300 text-sm font-medium transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Family Yet */}
            {!family && (
              <div className="glass-card rounded-xl p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Create Your Family</h2>
                <p className="text-slate-400 mb-6 max-w-md mx-auto">
                  Start by creating your family. You can then invite parents, members, and children to join.
                </p>
                <button 
                  onClick={() => { setFormData({ name: '', email: '', role: 'child' }); setModal({ type: 'create' }); }}
                  className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/80 rounded-xl text-white font-bold transition-all mx-auto"
                  data-testid="create-family-btn"
                >
                  <Plus className="w-5 h-5" /> Create Family
                </button>
              </div>
            )}

            {/* Family Card */}
            {family && (
              <div className="glass-card rounded-xl overflow-hidden" data-testid="family-card">
                {/* Family Header */}
                <div className="p-5 bg-gradient-to-r from-primary/20 to-secondary/20 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
                        <Crown className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-black text-white">{family.name}</h1>
                        <p className="text-sm text-slate-400 mt-1">
                          {members.length} member{members.length !== 1 ? 's' : ''} • 
                          <span className="text-yellow-400"> {parentCount} parent{parentCount !== 1 ? 's' : ''}</span> • 
                          <span className="text-pink-400"> {childCount} child{childCount !== 1 ? 'ren' : ''}</span>
                          {memberCount > 0 && <span className="text-blue-400"> • {memberCount} member{memberCount !== 1 ? 's' : ''}</span>}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <button 
                        onClick={() => { setFormData({ ...formData, name: family.name }); setModal({ type: 'edit' }); }}
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                        title="Edit family name"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                {isAdmin && (
                  <div className="p-4 border-b border-white/10 bg-slate-900/30 flex flex-wrap gap-2">
                    <button 
                      onClick={() => { setFormData({ name: '', email: '', role: 'child' }); setModal({ type: 'invite' }); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-xl text-white font-bold transition-all"
                    >
                      <UserPlus className="w-5 h-5" /> Invite Member
                    </button>
                    <button 
                      onClick={() => { setChildFormData({ name: '', pin: '', picture: '' }); setCreatedInviteLink(null); setModal({ type: 'addChild' }); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-pink-500 hover:bg-pink-500/80 rounded-xl text-white font-bold transition-all"
                    >
                      <Baby className="w-5 h-5" /> Add Child Profile
                    </button>
                  </div>
                )}

                {/* Members List */}
                <div className="p-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Family Members</h3>
                  <div className="space-y-2">
                    {members.map((member) => {
                      const RoleIcon = ROLE_INFO[member.role]?.icon || User;
                      const isCurrentUser = member.user_id === user?.user_id;
                      
                      return (
                        <div 
                          key={member.user_id} 
                          className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                            isCurrentUser ? 'bg-primary/10 border border-primary/30' : 'bg-slate-800/50 hover:bg-slate-800/70'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar name={member.name} picture={member.picture} size="md" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-white">{member.name}</p>
                                {isCurrentUser && (
                                  <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded">YOU</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <RoleIcon className="w-3 h-3 text-slate-400" />
                                <p className="text-xs text-slate-400 capitalize">{member.role}</p>
                              </div>
                            </div>
                          </div>
                          
                          {isAdmin && !isCurrentUser && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setEditCredentialsModal({ 
                                  user_id: member.user_id, 
                                  name: member.name,
                                  email: member.email || '',
                                  username: member.username || '', 
                                  password: '', 
                                  pin: '' 
                                })}
                                className="p-2 hover:bg-primary/20 rounded-lg text-primary transition-all"
                                title="Edit profile info"
                                data-testid={`edit-member-${member.user_id}`}
                              >
                                <User className="w-4 h-4" />
                              </button>}
                              <button 
                                onClick={() => handleSetMemberPin(member.user_id)}
                                disabled={processing === member.user_id}
                                className={`p-2 rounded-lg transition-all ${
                                  member.has_pin 
                                    ? 'hover:bg-white/10 text-green-400' 
                                    : 'hover:bg-yellow-500/20 text-yellow-400'
                                }`}
                                title={member.has_pin ? 'Change PIN' : 'Set PIN'}
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setModal({ type: 'member', data: member })}
                                className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                                title="Change role"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleRemoveMember(member.user_id, member.name)}
                                disabled={processing === member.user_id}
                                className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all disabled:opacity-50"
                                title="Remove / Delete member"
                                data-testid={`delete-member-${member.user_id}`}
                              >
                                {processing === member.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Role Permissions Info */}
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-3">Role Permissions</h3>
              <div className="grid gap-3">
                {Object.entries(ROLE_INFO).map(([role, info]) => {
                  const Icon = info.icon;
                  return (
                    <div key={role} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${info.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-white capitalize">{role}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{info.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Create Family Modal */}
      {modal.type === 'create' && (
        <Modal title="Create Your Family" icon={<Plus className="w-5 h-5 text-primary" />} onClose={() => setModal({ type: null })}>
          <input 
            type="text" 
            placeholder="Family Name (e.g., The Smiths)" 
            value={formData.name} 
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary mb-4"
            autoFocus
          />
          <div className="flex gap-3">
            <button onClick={() => setModal({ type: null })} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium">Cancel</button>
            <button onClick={handleCreateFamily} className="flex-1 px-4 py-3 bg-primary hover:bg-primary/80 rounded-xl text-white font-bold">Create</button>
          </div>
        </Modal>
      )}

      {/* Edit Family Modal */}
      {modal.type === 'edit' && (
        <Modal title="Edit Family Name" icon={<Edit2 className="w-5 h-5 text-primary" />} onClose={() => setModal({ type: null })}>
          <input 
            type="text" 
            placeholder="Family Name" 
            value={formData.name} 
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary mb-4"
            autoFocus
          />
          <div className="flex gap-3">
            <button onClick={() => setModal({ type: null })} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium">Cancel</button>
            <button onClick={handleEditFamily} className="flex-1 px-4 py-3 bg-primary hover:bg-primary/80 rounded-xl text-white font-bold">Save</button>
          </div>
        </Modal>
      )}

      {/* Invite Member Modal */}
      {modal.type === 'invite' && (
        <Modal title="Invite Family Member" icon={<UserPlus className="w-5 h-5 text-secondary" />} onClose={() => { setModal({ type: null }); setInviteResult(null); setFormData({ name: '', email: '', role: 'child' }); }}>
          {inviteResult ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
                <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-semibold">Invite Created!</p>
                <p className="text-sm text-slate-400 mt-1">
                  {inviteResult.email_status === 'sent' ? 'Email sent successfully.' : 'Share the invite link or code below.'}
                </p>
              </div>

              {/* Invite Link */}
              {inviteResult.family_code && (() => {
                const inviteLink = `${window.location.origin}/join/${inviteResult.family_code}`;
                const shareText = `Join ${inviteResult.family_name || 'our family'} on FamFocus Hub! Use this link: ${inviteLink} or enter code: ${inviteResult.family_code}`;
                return (
                  <div className="space-y-3">
                    {/* Deep link */}
                    <div className="p-3 bg-slate-800 rounded-xl">
                      <p className="text-xs text-slate-400 mb-2">Invite Link</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-900 rounded-lg px-3 py-2 text-sm text-primary truncate font-mono">
                          {inviteLink}
                        </div>
                        <button 
                          onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Link copied!'); }}
                          className="p-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 flex-shrink-0"
                          data-testid="copy-invite-link"
                        >
                          <Link className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Code */}
                    <div className="p-3 bg-slate-800 rounded-xl text-center">
                      <p className="text-xs text-slate-400 mb-1">Or use code</p>
                      <p className="text-2xl font-black tracking-[0.2em] text-primary">{inviteResult.family_code}</p>
                    </div>

                    {/* Share Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => { navigator.clipboard.writeText(shareText); toast.success('Copied to clipboard!'); }}
                        className="flex flex-col items-center gap-1.5 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
                        data-testid="share-copy"
                      >
                        <Copy className="w-5 h-5 text-slate-300" />
                        <span className="text-xs text-slate-400">Copy All</span>
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1.5 p-3 bg-green-500/10 hover:bg-green-500/20 rounded-xl transition-all"
                        data-testid="share-whatsapp"
                      >
                        <MessageCircle className="w-5 h-5 text-green-400" />
                        <span className="text-xs text-green-400">WhatsApp</span>
                      </a>
                      <a
                        href={`sms:?body=${encodeURIComponent(shareText)}`}
                        className="flex flex-col items-center gap-1.5 p-3 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-all"
                        data-testid="share-sms"
                      >
                        <Share2 className="w-5 h-5 text-blue-400" />
                        <span className="text-xs text-blue-400">SMS</span>
                      </a>
                    </div>
                  </div>
                );
              })()}
              <button onClick={() => { setModal({ type: null }); setInviteResult(null); setFormData({ name: '', email: '', role: 'child' }); }} className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium">Done</button>
            </div>
          ) : (
            <>
              <input 
                type="email" 
                placeholder="Email address" 
                value={formData.email} 
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-secondary mb-4"
                autoFocus
              />
              <div className="mb-4">
                <label className="text-sm text-slate-400 mb-2 block">Invite as:</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['parent', 'member', 'child', 'homehub']).map((role) => {
                    const info = ROLE_INFO[role];
                    const Icon = info.icon;
                    return (
                      <button 
                        key={role} 
                        onClick={() => setFormData({ ...formData, role })}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl text-sm font-medium capitalize transition-all ${
                          formData.role === role 
                            ? `bg-gradient-to-br ${info.color} text-white` 
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {role === 'homehub' ? 'Hub' : role}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-2">{ROLE_INFO[formData.role]?.description}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setModal({ type: null }); setInviteResult(null); }} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium">Cancel</button>
                <button 
                  onClick={handleInvite} 
                  disabled={processing === 'invite'}
                  className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 disabled:opacity-50 rounded-xl text-white font-bold flex items-center justify-center gap-2"
                >
                  {processing === 'invite' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Invite
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Change Role Modal */}
      {modal.type === 'member' && modal.data && (
        <Modal title="Change Member Role" icon={<User className="w-5 h-5 text-primary" />} onClose={() => setModal({ type: null })}>
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl mb-4">
            <Avatar name={modal.data.name} picture={modal.data.picture} size="lg" />
            <div>
              <p className="font-semibold text-white">{modal.data.name}</p>
              <p className="text-xs text-slate-400">Current role: <span className="capitalize text-primary">{modal.data.role}</span></p>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-sm text-slate-400 mb-2 block">Change to:</label>
            <div className="grid grid-cols-4 gap-2">
              {(['parent', 'member', 'child', 'homehub']).map((role) => {
                const info = ROLE_INFO[role];
                const Icon = info.icon;
                const isCurrentRole = modal.data.role === role;
                return (
                  <button 
                    key={role} 
                    onClick={() => !isCurrentRole && handleChangeMemberRole(modal.data.user_id, role)}
                    disabled={isCurrentRole || processing === modal.data.user_id}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl text-sm font-medium capitalize transition-all ${
                      isCurrentRole 
                        ? `bg-gradient-to-br ${info.color} text-white ring-2 ring-white/30` 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {role}
                    {isCurrentRole && <span className="text-[10px]">(current)</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={() => setModal({ type: null })} className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium">
            Close
          </button>
        </Modal>
      )}

      {/* Add Child Profile Modal */}
      {modal.type === 'addChild' && (
        <Modal title="Add Child Profile" icon={<Baby className="w-5 h-5 text-pink-400" />} onClose={() => { setModal({ type: null }); setCreatedInviteLink(null); }}>
          {!createdInviteLink ? (
            <div className="max-h-[70vh] overflow-y-auto">
              <p className="text-sm text-slate-400 mb-4">
                Create a profile for your child. They'll use these credentials to login on their own device.
              </p>
              
              {/* Basic Info */}
              <input 
                type="text" 
                placeholder="Child's Name" 
                value={childFormData.name} 
                onChange={(e) => setChildFormData({ ...childFormData, name: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 mb-4"
                autoFocus
              />
              
              {/* Login Credentials */}
              <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-700">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Login Credentials
                </h4>
                <input 
                  type="text" 
                  placeholder="Username (for app login)" 
                  value={childFormData.username} 
                  onChange={(e) => setChildFormData({ ...childFormData, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary mb-3"
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={childFormData.password} 
                  onChange={(e) => setChildFormData({ ...childFormData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-slate-500 mt-2">Child will use these to login on their phone</p>
              </div>
              
              {/* PIN for Home Hub */}
              <div className="mb-4">
                <label className="text-sm text-slate-400 mb-2 block flex items-center gap-2">
                  <Lock className="w-4 h-4" /> 4-digit PIN (for Home Hub)
                </label>
                <input 
                  type="password" 
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN" 
                  value={childFormData.pin} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setChildFormData({ ...childFormData, pin: val });
                  }}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 text-center text-2xl tracking-[0.5em]"
                />
                <p className="text-xs text-slate-500 mt-1">Used for verification on shared Home Hub device</p>
              </div>
              
              <div className="flex gap-3">
                <button onClick={() => setModal({ type: null })} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium">Cancel</button>
                <button 
                  onClick={handleCreateChildProfile} 
                  disabled={processing === 'createChild'}
                  className="flex-1 px-4 py-3 bg-pink-500 hover:bg-pink-500/80 disabled:opacity-50 rounded-xl text-white font-bold flex items-center justify-center gap-2"
                >
                  {processing === 'createChild' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Profile
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Profile Created!</h3>
                <p className="text-sm text-slate-400 mt-1">{childFormData.name} can now login!</p>
              </div>
              
              {/* Login Info */}
              <div className="bg-slate-800 rounded-xl p-4 mb-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-400">Username:</p>
                  <p className="text-white font-mono font-bold">{childFormData.username}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Password:</p>
                  <p className="text-white font-mono">{childFormData.password ? '••••••••' : 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Home Hub PIN:</p>
                  <p className="text-white font-mono">{childFormData.pin || 'Not set'}</p>
                </div>
              </div>
              
              {/* Optional Invite Link */}
              <div className="bg-slate-800/50 rounded-xl p-3 mb-4">
                <p className="text-xs text-slate-400 mb-1">Optional Invite Link (for setup wizard):</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-white flex-1 truncate">{createdInviteLink}</p>
                  <button 
                    onClick={copyInviteLink}
                    className="p-2 bg-primary hover:bg-primary/80 rounded-lg text-white transition-all"
                    title="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-xs text-slate-500 text-center mb-4">
                Child will add their email and phone during first login.
              </p>
              <button 
                onClick={() => { setModal({ type: null }); setCreatedInviteLink(null); setChildFormData({ name: '', pin: '', picture: '', username: '', password: '' }); }}
                className="w-full px-4 py-3 bg-primary hover:bg-primary/80 rounded-xl text-white font-bold"
              >
                Done
              </button>
            </>
          )}
        </Modal>
      )}

      {/* Delete/Remove Member Modal */}
      {modal.type === 'deleteMember' && modal.data && (
        <Modal title={`Remove ${modal.data.name}`} icon={<Trash2 className="w-5 h-5 text-red-400" />} onClose={() => setModal({ type: null })}>
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              What would you like to do with <span className="text-white font-semibold">{modal.data.name}</span>'s profile?
            </p>
            
            <button
              onClick={() => executeRemoveMember(modal.data.user_id)}
              disabled={processing === modal.data.user_id}
              className="w-full flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700 transition-all text-left"
              data-testid="remove-from-family-btn"
            >
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Remove from Family</p>
                <p className="text-xs text-slate-400">Profile stays but is unlinked from this family</p>
              </div>
            </button>

            <button
              onClick={() => executeDeleteProfile(modal.data.user_id)}
              disabled={processing === modal.data.user_id}
              className="w-full flex items-center gap-3 p-4 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/30 transition-all text-left"
              data-testid="delete-profile-btn"
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-red-400">Delete Completely</p>
                <p className="text-xs text-slate-400">Permanently removes profile and all associated data</p>
              </div>
            </button>

            <button onClick={() => setModal({ type: null })} className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium mt-2">
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Credentials Modal */}
      {editCredentialsModal && (
        <Modal title={`Edit ${editCredentialsModal.name}'s Profile`} icon={<User className="w-5 h-5 text-primary" />} onClose={() => setEditCredentialsModal(null)}>
          <p className="text-sm text-slate-400 mb-4">
            Update profile information for {editCredentialsModal.name}. Leave fields empty to keep current values.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Display Name</label>
              <input 
                type="text" 
                placeholder="Full name" 
                value={editCredentialsModal.name} 
                onChange={(e) => setEditCredentialsModal({ ...editCredentialsModal, name: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary"
                data-testid="edit-name-input"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block flex items-center gap-2">
                <Mail className="w-3 h-3" /> Email (for Google Sign-in)
              </label>
              <input 
                type="email" 
                placeholder="email@example.com" 
                value={editCredentialsModal.email || ''} 
                onChange={(e) => setEditCredentialsModal({ ...editCredentialsModal, email: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary"
                data-testid="edit-email-input"
              />
              <p className="text-xs text-slate-500 mt-1">Attach an email so they can sign in with Google in the future</p>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Username</label>
              <input 
                type="text" 
                placeholder="New username" 
                value={editCredentialsModal.username} 
                onChange={(e) => setEditCredentialsModal({ ...editCredentialsModal, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary"
                data-testid="edit-username-input"
              />
            </div>
            
            <div>
              <label className="text-xs text-slate-400 mb-1 block">New Password</label>
              <input 
                type="password" 
                placeholder="Leave empty to keep current" 
                value={editCredentialsModal.password} 
                onChange={(e) => setEditCredentialsModal({ ...editCredentialsModal, password: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary"
                data-testid="edit-password-input"
              />
            </div>
            
            <div>
              <label className="text-xs text-slate-400 mb-1 block flex items-center gap-2">
                <Lock className="w-3 h-3" /> Home Hub PIN
              </label>
              <input 
                type="password" 
                inputMode="numeric"
                maxLength={4}
                placeholder="Leave empty to keep current" 
                value={editCredentialsModal.pin} 
                onChange={(e) => setEditCredentialsModal({ ...editCredentialsModal, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary text-center text-xl tracking-[0.5em]"
                data-testid="edit-pin-input"
              />
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button onClick={() => setEditCredentialsModal(null)} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium">Cancel</button>
            <button 
              onClick={handleUpdateCredentials} 
              disabled={processing === 'updateCreds'}
              className="flex-1 px-4 py-3 bg-primary hover:bg-primary/80 disabled:opacity-50 rounded-xl text-white font-bold flex items-center justify-center gap-2"
            >
              {processing === 'updateCreds' && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, icon, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">{icon}{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

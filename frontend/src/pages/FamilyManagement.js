import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, UserPlus, Check, X, Crown, Mail, Loader2, Trash2, Edit2, Baby, User, Shield } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
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
      const res = await fetch(`${BACKEND_URL}/api/families/${family.family_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ name: formData.name })
      });
      if (res.ok) { toast.success('Family updated!'); setModal({ type: null }); fetchData(); }
      else { toast.error('Failed to update family'); }
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
      if (res.ok) { 
        toast.success(`Invitation sent! They will join as ${formData.role}`); 
        setModal({ type: null }); 
        setFormData({ name: '', email: '', role: 'child' }); 
      } else { 
        const data = await res.json(); 
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

  const handleRemoveMember = async (memberId) => {
    if (!family || !window.confirm('Are you sure you want to remove this member from the family?')) return;
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
                  <div className="p-4 border-b border-white/10 bg-slate-900/30">
                    <button 
                      onClick={() => { setFormData({ name: '', email: '', role: 'child' }); setModal({ type: 'invite' }); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-xl text-white font-bold transition-all"
                    >
                      <UserPlus className="w-5 h-5" /> Invite New Member
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
                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${ROLE_INFO[member.role]?.color || 'from-slate-500 to-slate-600'} flex items-center justify-center text-sm font-bold text-white shadow-md`}>
                              {member.name?.charAt(0) || '?'}
                            </div>
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
                                onClick={() => setModal({ type: 'member', data: member })}
                                className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                                title="Change role"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleRemoveMember(member.user_id)}
                                disabled={processing === member.user_id}
                                className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all disabled:opacity-50"
                                title="Remove member"
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
        <Modal title="Invite Family Member" icon={<UserPlus className="w-5 h-5 text-secondary" />} onClose={() => setModal({ type: null })}>
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
            <div className="grid grid-cols-3 gap-2">
              {(['parent', 'member', 'child']).map((role) => {
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
                    {role}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">{ROLE_INFO[formData.role]?.description}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setModal({ type: null })} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium">Cancel</button>
            <button 
              onClick={handleInvite} 
              disabled={processing === 'invite'}
              className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 disabled:opacity-50 rounded-xl text-white font-bold flex items-center justify-center gap-2"
            >
              {processing === 'invite' && <Loader2 className="w-4 h-4 animate-spin" />}
              Send Invite
            </button>
          </div>
        </Modal>
      )}

      {/* Change Role Modal */}
      {modal.type === 'member' && modal.data && (
        <Modal title="Change Member Role" icon={<User className="w-5 h-5 text-primary" />} onClose={() => setModal({ type: null })}>
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl mb-4">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${ROLE_INFO[modal.data.role]?.color || 'from-slate-500 to-slate-600'} flex items-center justify-center text-lg font-bold text-white`}>
              {modal.data.name?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-semibold text-white">{modal.data.name}</p>
              <p className="text-xs text-slate-400">Current role: <span className="capitalize text-primary">{modal.data.role}</span></p>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-sm text-slate-400 mb-2 block">Change to:</label>
            <div className="grid grid-cols-3 gap-2">
              {(['parent', 'member', 'child']).map((role) => {
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

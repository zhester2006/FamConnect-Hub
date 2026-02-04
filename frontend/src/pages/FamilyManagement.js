import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, UserPlus, Check, X, ArrowLeftRight, Crown, Home, Mail, Loader2, LogOut, Sparkles, Trash2, Edit2, Baby, User, Shield } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function FamilyManagement({ user, onFamilySwitch }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState([]);
  const [familyMembers, setFamilyMembers] = useState({});
  const [pendingInvites, setPendingInvites] = useState([]);
  const [modal, setModal] = useState({ type: null, data: null });
  const [formData, setFormData] = useState({ name: '', email: '', role: 'child' });
  const [switching, setSwitching] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [expandedFamily, setExpandedFamily] = useState(null);

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

      setFamilies(familiesList);
      setPendingInvites(invitesData.invites || []);
      
      // Fetch members
      const membersMap = {};
      for (const family of familiesList) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/families/${family.family_id}/members`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            membersMap[family.family_id] = data.members || [];
          }
        } catch (e) {
          membersMap[family.family_id] = [];
        }
      }
      setFamilyMembers(membersMap);
    } catch (error) {
      console.error('Failed to fetch families:', error);
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
      if (res.ok) { toast.success('Family created!'); setModal({ type: null }); setFormData({ name: '', email: '', role: 'child' }); fetchData(); }
      else { toast.error('Failed to create family'); }
    } catch (error) { toast.error('Failed to create family'); }
  };

  const handleEditFamily = async () => {
    if (!formData.name.trim() || !modal.data) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${modal.data}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ name: formData.name })
      });
      if (res.ok) { toast.success('Family updated!'); setModal({ type: null }); fetchData(); }
      else { toast.error('Failed to update family'); }
    } catch (error) { toast.error('Failed to update family'); }
  };

  const handleDeleteFamily = async () => {
    if (!modal.data) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${modal.data}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Family deleted!'); setModal({ type: null }); fetchData(); }
      else { const data = await res.json(); toast.error(data.detail || 'Failed to delete family'); }
    } catch (error) { toast.error('Failed to delete family'); }
  };

  const handleSwitchFamily = async (familyId) => {
    setSwitching(familyId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/switch/${familyId}`, { method: 'POST', credentials: 'include' });
      if (res.ok) { toast.success('Switched family!'); if (onFamilySwitch) onFamilySwitch(familyId); fetchData(); }
      else { toast.error('Failed to switch family'); }
    } catch (error) { toast.error('Failed to switch family'); }
    finally { setSwitching(null); }
  };

  const handleInvite = async () => {
    if (!formData.email.trim() || !modal.data) { toast.error('Please enter an email'); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${modal.data}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ email: formData.email, role: formData.role })
      });
      if (res.ok) { toast.success(`Invitation sent as ${formData.role}!`); setModal({ type: null }); setFormData({ name: '', email: '', role: 'child' }); }
      else { const data = await res.json(); toast.error(data.detail || 'Failed to send invitation'); }
    } catch (error) { toast.error('Failed to send invitation'); }
  };

  const handleChangeMemberRole = async (memberId, newRole) => {
    if (!modal.data) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${modal.data.familyId}/members/${memberId}/role`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ role: newRole })
      });
      if (res.ok) { toast.success(`Role changed to ${newRole}!`); setModal({ type: null }); fetchData(); }
      else { const data = await res.json(); toast.error(data.detail || 'Failed to change role'); }
    } catch (error) { toast.error('Failed to change role'); }
  };

  const handleRemoveMember = async (memberId) => {
    if (!modal.data || !window.confirm('Remove this member?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${modal.data.familyId}/members/${memberId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Member removed'); setModal({ type: null }); fetchData(); }
      else { const data = await res.json(); toast.error(data.detail || 'Failed to remove member'); }
    } catch (error) { toast.error('Failed to remove member'); }
  };

  const handleAcceptInvite = async (inviteId) => {
    setProcessing(inviteId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/invites/${inviteId}/accept`, { method: 'POST', credentials: 'include' });
      if (res.ok) { toast.success('Joined family!'); fetchData(); }
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

  const handleLeaveFamily = async (familyId) => {
    if (!window.confirm('Leave this family?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${familyId}/leave`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Left family'); fetchData(); }
      else { const data = await res.json(); toast.error(data.detail || 'Failed to leave family'); }
    } catch (error) { toast.error('Failed to leave family'); }
  };

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

      <main className={`flex-1 overflow-hidden transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'lg:ml-0' : 'lg:ml-64'}`}>
        <div className="h-full overflow-y-auto p-4 lg:p-6 pb-24 md:pb-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2">
                  <Users className="w-6 h-6 text-primary" />
                  Family Management
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">Manage your families and members</p>
              </div>
              <button onClick={() => { setFormData({ name: '', email: '', role: 'child' }); setModal({ type: 'create' }); }}
                className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary/80 rounded-lg text-white text-sm font-bold transition-all"
                data-testid="create-family-btn">
                <Plus className="w-4 h-4" /> Create Family
              </button>
            </div>

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
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                          <Users className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">{invite.family_name || 'Family'}</h3>
                          <p className="text-xs text-slate-400">as {invite.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleAcceptInvite(invite.invite_id)} disabled={processing === invite.invite_id}
                          className="flex items-center gap-1 px-2 py-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded text-white text-xs font-medium transition-all">
                          {processing === invite.invite_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        </button>
                        <button onClick={() => handleDeclineInvite(invite.invite_id)} disabled={processing === invite.invite_id}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-slate-300 text-xs font-medium transition-all">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Your Families */}
            <div className="glass-card rounded-xl p-4" data-testid="families-section">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Home className="w-4 h-4 text-primary" /> Your Families
              </h2>
              
              {families.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No families yet. Create one!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {families.map((family) => (
                    <FamilyCard 
                      key={family.family_id} 
                      family={family} 
                      user={user}
                      members={familyMembers[family.family_id] || []}
                      expanded={expandedFamily === family.family_id}
                      onToggleExpand={() => setExpandedFamily(expandedFamily === family.family_id ? null : family.family_id)}
                      switching={switching}
                      onSwitch={handleSwitchFamily}
                      onInvite={(fid) => { setFormData({ name: '', email: '', role: 'child' }); setModal({ type: 'invite', data: fid }); }}
                      onEdit={(f) => { setFormData({ ...formData, name: f.name }); setModal({ type: 'edit', data: f.family_id }); }}
                      onDelete={(fid) => setModal({ type: 'delete', data: fid })}
                      onLeave={handleLeaveFamily}
                      onManageMember={(m, fid) => setModal({ type: 'member', data: { ...m, familyId: fid } })}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {modal.type === 'create' && (
        <Modal title="Create New Family" icon={<Plus className="w-5 h-5 text-primary" />} onClose={() => setModal({ type: null })}>
          <input type="text" placeholder="Family Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary mb-3 text-sm" />
          <div className="flex gap-2">
            <button onClick={() => setModal({ type: null })} className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium">Cancel</button>
            <button onClick={handleCreateFamily} className="flex-1 px-3 py-2 bg-primary hover:bg-primary/80 rounded-lg text-white text-sm font-bold">Create</button>
          </div>
        </Modal>
      )}

      {modal.type === 'edit' && (
        <Modal title="Edit Family" icon={<Edit2 className="w-5 h-5 text-primary" />} onClose={() => setModal({ type: null })}>
          <input type="text" placeholder="Family Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary mb-3 text-sm" />
          <div className="flex gap-2">
            <button onClick={() => setModal({ type: null })} className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium">Cancel</button>
            <button onClick={handleEditFamily} className="flex-1 px-3 py-2 bg-primary hover:bg-primary/80 rounded-lg text-white text-sm font-bold">Save</button>
          </div>
        </Modal>
      )}

      {modal.type === 'delete' && (
        <Modal title="Delete Family" icon={<Trash2 className="w-5 h-5 text-red-400" />} onClose={() => setModal({ type: null })}>
          <p className="text-sm text-slate-400 mb-4">Are you sure? This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setModal({ type: null })} className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium">Cancel</button>
            <button onClick={handleDeleteFamily} className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm font-bold">Delete</button>
          </div>
        </Modal>
      )}

      {modal.type === 'invite' && (
        <Modal title="Invite Member" icon={<UserPlus className="w-5 h-5 text-secondary" />} onClose={() => setModal({ type: null })}>
          <input type="email" placeholder="Email address" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-secondary mb-3 text-sm" />
          <div className="mb-3">
            <label className="text-xs text-slate-400 mb-1.5 block">Invite as:</label>
            <div className="grid grid-cols-3 gap-1">
              {['child', 'member', 'parent'].map((role) => (
                <button key={role} onClick={() => setFormData({ ...formData, role })}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium capitalize transition-all ${formData.role === role ? 'bg-secondary text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  {role === 'child' && <Baby className="w-4 h-4" />}
                  {role === 'member' && <User className="w-4 h-4" />}
                  {role === 'parent' && <Shield className="w-4 h-4" />}
                  {role}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setModal({ type: null })} className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium">Cancel</button>
            <button onClick={handleInvite} className="flex-1 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-white text-sm font-bold">Send Invite</button>
          </div>
        </Modal>
      )}

      {modal.type === 'member' && modal.data && (
        <Modal title="Manage Member" icon={<User className="w-5 h-5 text-primary" />} onClose={() => setModal({ type: null })}>
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-white">
              {modal.data.name?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-medium text-white">{modal.data.name}</p>
              <p className="text-xs text-slate-400">{modal.data.email}</p>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-1.5 block">Change role to:</label>
            <div className="grid grid-cols-3 gap-1">
              {['child', 'member', 'parent'].map((role) => (
                <button key={role} onClick={() => handleChangeMemberRole(modal.data.user_id, role)}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium capitalize transition-all ${modal.data.role === role ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  {role === 'child' && <Baby className="w-4 h-4" />}
                  {role === 'member' && <User className="w-4 h-4" />}
                  {role === 'parent' && <Shield className="w-4 h-4" />}
                  {role}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setModal({ type: null })} className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium">Close</button>
            <button onClick={() => handleRemoveMember(modal.data.user_id)} className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-sm font-bold">Remove</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, icon, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-xl p-5 w-full max-w-sm">
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">{icon}{title}</h2>
        {children}
      </div>
    </div>
  );
}

function FamilyCard({ family, user, members, expanded, onToggleExpand, switching, onSwitch, onInvite, onEdit, onDelete, onLeave, onManageMember }) {
  const isAdmin = family.role === 'parent' || family.role === 'admin';
  
  return (
    <div className={`relative p-4 rounded-xl border transition-all ${family.is_current ? 'bg-primary/10 border-primary' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}>
      {family.is_current && (
        <div className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center gap-0.5">
          <Sparkles className="w-2.5 h-2.5" /> Current
        </div>
      )}
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isAdmin ? 'bg-gradient-to-br from-yellow-500 to-orange-500' : 'bg-gradient-to-br from-primary to-secondary'}`}>
            {isAdmin ? <Crown className="w-5 h-5 text-white" /> : <Users className="w-5 h-5 text-white" />}
          </div>
          <div>
            <h3 className="font-bold text-white">{family.name}</h3>
            <p className="text-xs text-slate-400 capitalize">{family.role} • {family.member_count} members</p>
          </div>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(family)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all" title="Edit">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(family.family_id)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mb-3">
          <button onClick={onToggleExpand} className="text-xs text-slate-400 hover:text-white transition-all flex items-center gap-1">
            <Users className="w-3 h-3" /> {expanded ? 'Hide members' : 'Show members'}
          </button>
          
          {expanded && members.length > 0 && (
            <div className="mt-2 space-y-1">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/50 to-secondary/50 flex items-center justify-center text-[10px] font-bold text-white">
                      {member.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{member.name}</p>
                      <p className="text-[10px] text-slate-500 capitalize flex items-center gap-1">
                        {member.role === 'child' ? <Baby className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5" />}
                        {member.role}
                      </p>
                    </div>
                  </div>
                  {member.user_id !== user?.user_id && (
                    <button onClick={() => onManageMember(member, family.family_id)} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-all" title="Manage">
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {!family.is_current && (
          <button onClick={() => onSwitch(family.family_id)} disabled={switching === family.family_id}
            className="flex items-center gap-1 px-2 py-1.5 bg-primary hover:bg-primary/80 disabled:opacity-50 rounded-lg text-white text-xs font-medium transition-all">
            {switching === family.family_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowLeftRight className="w-3 h-3" />} Switch
          </button>
        )}
        
        {isAdmin && (
          <button onClick={() => onInvite(family.family_id)} className="flex items-center gap-1 px-2 py-1.5 bg-secondary hover:bg-secondary/80 rounded-lg text-white text-xs font-medium transition-all">
            <UserPlus className="w-3 h-3" /> Invite
          </button>
        )}
        
        {!isAdmin && !family.is_current && (
          <button onClick={() => onLeave(family.family_id)} className="flex items-center gap-1 px-2 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-xs font-medium transition-all">
            <LogOut className="w-3 h-3" /> Leave
          </button>
        )}
      </div>
    </div>
  );
}

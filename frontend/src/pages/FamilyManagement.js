import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, UserPlus, Check, X, ArrowLeftRight, Crown, Home, Mail, Loader2, LogOut, Sparkles, Trash2, Edit2, Baby, User, Shield } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function FamilyManagement({ user, onFamilySwitch }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // Default collapsed
  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState([]);
  const [familyMembers, setFamilyMembers] = useState({});
  const [pendingInvites, setPendingInvites] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('child');
  const [selectedFamilyForInvite, setSelectedFamilyForInvite] = useState(null);
  const [selectedFamilyForEdit, setSelectedFamilyForEdit] = useState(null);
  const [selectedFamilyForDelete, setSelectedFamilyForDelete] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [editFamilyName, setEditFamilyName] = useState('');
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

      setFamilies(familiesData.families || []);
      setPendingInvites(invitesData.invites || []);
      
      // Fetch members for each family
      const memberPromises = (familiesData.families || []).map(async (family) => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/families/${family.family_id}/members`, { 
            credentials: 'include' 
          });
          if (res.ok) {
            const data = await res.json();
            return { familyId: family.family_id, members: data.members || [] };
          }
        } catch (e) {
          console.error('Failed to fetch members:', e);
        }
        return { familyId: family.family_id, members: [] };
      });
      
      const membersResults = await Promise.all(memberPromises);
      const membersMap = {};
      membersResults.forEach(result => {
        membersMap[result.familyId] = result.members;
      });
      setFamilyMembers(membersMap);
      
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

  const handleEditFamily = async () => {
    if (!editFamilyName.trim() || !selectedFamilyForEdit) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${selectedFamilyForEdit}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editFamilyName })
      });

      if (res.ok) {
        toast.success('Family updated successfully!');
        setShowEditModal(false);
        setSelectedFamilyForEdit(null);
        setEditFamilyName('');
        fetchData();
      } else {
        toast.error('Failed to update family');
      }
    } catch (error) {
      console.error('Failed to update family:', error);
      toast.error('Failed to update family');
    }
  };

  const handleDeleteFamily = async () => {
    if (!selectedFamilyForDelete) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${selectedFamilyForDelete}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        toast.success('Family deleted successfully!');
        setShowDeleteModal(false);
        setSelectedFamilyForDelete(null);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to delete family');
      }
    } catch (error) {
      console.error('Failed to delete family:', error);
      toast.error('Failed to delete family');
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
        toast.success(`Invitation sent as ${inviteRole}!`);
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteRole('child');
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error('Failed to send invitation');
    }
  };

  const handleChangeMemberRole = async (memberId, newRole) => {
    if (!selectedMember) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${selectedMember.familyId}/members/${memberId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole })
      });

      if (res.ok) {
        toast.success(`Role changed to ${newRole}!`);
        setShowMemberModal(false);
        setSelectedMember(null);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to change role');
      }
    } catch (error) {
      console.error('Failed to change role:', error);
      toast.error('Failed to change role');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!selectedMember) return;
    
    if (!window.confirm('Are you sure you want to remove this member from the family?')) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/families/${selectedMember.familyId}/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        toast.success('Member removed from family');
        setShowMemberModal(false);
        setSelectedMember(null);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
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
    setInviteRole('child'); // Default to child
    setShowInviteModal(true);
  };

  const openEditModal = (family) => {
    setSelectedFamilyForEdit(family.family_id);
    setEditFamilyName(family.name);
    setShowEditModal(true);
  };

  const openDeleteModal = (familyId) => {
    setSelectedFamilyForDelete(familyId);
    setShowDeleteModal(true);
  };

  const openMemberModal = (member, familyId) => {
    setSelectedMember({ ...member, familyId });
    setShowMemberModal(true);
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
      {/* Animated Background */}
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
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary/80 rounded-lg text-white text-sm font-bold transition-all"
                data-testid="create-family-btn"
              >
                <Plus className="w-4 h-4" />
                Create Family
              </button>
            </div>

            {/* Pending Invitations */}
            {pendingInvites.length > 0 && (
              <div className="glass-card rounded-xl p-4" data-testid="pending-invites-section">
                <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-accent" />
                  Pending Invitations
                  <span className="ml-1 px-1.5 py-0.5 bg-accent/20 text-accent text-xs font-bold rounded-full">
                    {pendingInvites.length}
                  </span>
                </h2>
                <div className="space-y-2">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.invite_id}
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                      data-testid={`invite-${invite.invite_id}`}
                    >
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
                        <button
                          onClick={() => handleAcceptInvite(invite.invite_id)}
                          disabled={processing === invite.invite_id}
                          className="flex items-center gap-1 px-2 py-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded text-white text-xs font-medium transition-all"
                          data-testid={`accept-invite-${invite.invite_id}`}
                        >
                          {processing === invite.invite_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeclineInvite(invite.invite_id)}
                          disabled={processing === invite.invite_id}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-slate-300 text-xs font-medium transition-all"
                          data-testid={`decline-invite-${invite.invite_id}`}
                        >
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
                <Home className="w-4 h-4 text-primary" />
                Your Families
              </h2>
              
              {families.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No families yet. Create one!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {families.map((family) => (
                    <div
                      key={family.family_id}
                      className={`relative p-4 rounded-xl border transition-all ${
                        family.is_current
                          ? 'bg-primary/10 border-primary'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }`}
                      data-testid={`family-card-${family.family_id}`}
                    >
                      {family.is_current && (
                        <div className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" />
                          Current
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            family.role === 'parent' || family.role === 'admin'
                              ? 'bg-gradient-to-br from-yellow-500 to-orange-500'
                              : 'bg-gradient-to-br from-primary to-secondary'
                          }`}>
                            {family.role === 'parent' || family.role === 'admin' ? (
                              <Crown className="w-5 h-5 text-white" />
                            ) : (
                              <Users className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-white">{family.name}</h3>
                            <p className="text-xs text-slate-400 capitalize">{family.role} • {family.member_count} members</p>
                          </div>
                        </div>
                        
                        {/* Family Actions */}
                        {(family.role === 'parent' || family.role === 'admin') && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(family)}
                              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                              title="Edit family"
                              data-testid={`edit-family-${family.family_id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openDeleteModal(family.family_id)}
                              className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                              title="Delete family"
                              data-testid={`delete-family-${family.family_id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Members Section - Collapsible */}
                      {(family.role === 'parent' || family.role === 'admin') && (
                        <div className="mb-3">
                          <button
                            onClick={() => setExpandedFamily(expandedFamily === family.family_id ? null : family.family_id)}
                            className="text-xs text-slate-400 hover:text-white transition-all flex items-center gap-1"
                          >
                            <Users className="w-3 h-3" />
                            {expandedFamily === family.family_id ? 'Hide members' : 'Show members'}
                          </button>
                          
                          {expandedFamily === family.family_id && familyMembers[family.family_id] && (
                            <div className="mt-2 space-y-1">
                              {familyMembers[family.family_id].map((member) => (
                                <div
                                  key={member.user_id}
                                  className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/50 to-secondary/50 flex items-center justify-center text-[10px] font-bold text-white">
                                      {member.name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-white">{member.name}</p>
                                      <p className="text-[10px] text-slate-500 capitalize flex items-center gap-1">
                                        {member.role === 'child' ? (
                                          <Baby className="w-2.5 h-2.5" />
                                        ) : (
                                          <Shield className="w-2.5 h-2.5" />
                                        )}
                                        {member.role}
                                      </p>
                                    </div>
                                  </div>
                                  {member.user_id !== user?.user_id && (
                                    <button
                                      onClick={() => openMemberModal(member, family.family_id)}
                                      className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-all"
                                      title="Manage member"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {!family.is_current && (
                          <button
                            onClick={() => handleSwitchFamily(family.family_id)}
                            disabled={switching === family.family_id}
                            className="flex items-center gap-1 px-2 py-1.5 bg-primary hover:bg-primary/80 disabled:opacity-50 rounded-lg text-white text-xs font-medium transition-all"
                            data-testid={`switch-to-${family.family_id}`}
                          >
                            {switching === family.family_id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ArrowLeftRight className="w-3 h-3" />
                            )}
                            Switch
                          </button>
                        )}
                        
                        {(family.role === 'parent' || family.role === 'admin') && (
                          <button
                            onClick={() => openInviteModal(family.family_id)}
                            className="flex items-center gap-1 px-2 py-1.5 bg-secondary hover:bg-secondary/80 rounded-lg text-white text-xs font-medium transition-all"
                            data-testid={`invite-to-${family.family_id}`}
                          >
                            <UserPlus className="w-3 h-3" />
                            Invite
                          </button>
                        )}
                        
                        {family.role !== 'parent' && family.role !== 'admin' && !family.is_current && (
                          <button
                            onClick={() => handleLeaveFamily(family.family_id)}
                            className="flex items-center gap-1 px-2 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-xs font-medium transition-all"
                            data-testid={`leave-${family.family_id}`}
                          >
                            <LogOut className="w-3 h-3" />
                            Leave
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Create Family Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-5 w-full max-w-sm" data-testid="create-family-modal">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Create New Family
            </h2>
            
            <input
              type="text"
              placeholder="Family Name"
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary mb-3 text-sm"
              data-testid="family-name-input"
            />
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFamily}
                className="flex-1 px-3 py-2 bg-primary hover:bg-primary/80 rounded-lg text-white text-sm font-bold transition-all"
                data-testid="confirm-create-family"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Family Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-5 w-full max-w-sm" data-testid="edit-family-modal">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-primary" />
              Edit Family
            </h2>
            
            <input
              type="text"
              placeholder="Family Name"
              value={editFamilyName}
              onChange={(e) => setEditFamilyName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary mb-3 text-sm"
              data-testid="edit-family-name-input"
            />
            
            <div className="flex gap-2">
              <button
                onClick={() => { setShowEditModal(false); setSelectedFamilyForEdit(null); }}
                className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleEditFamily}
                className="flex-1 px-3 py-2 bg-primary hover:bg-primary/80 rounded-lg text-white text-sm font-bold transition-all"
                data-testid="confirm-edit-family"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Family Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-5 w-full max-w-sm" data-testid="delete-family-modal">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Delete Family
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Are you sure? This will remove all family data and cannot be undone.
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteModal(false); setSelectedFamilyForDelete(null); }}
                className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFamily}
                className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm font-bold transition-all"
                data-testid="confirm-delete-family"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-5 w-full max-w-sm" data-testid="invite-modal">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-secondary" />
              Invite Member
            </h2>
            
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-secondary mb-3 text-sm"
              data-testid="invite-email-input"
            />
            
            <div className="mb-3">
              <label className="text-xs text-slate-400 mb-1.5 block">Invite as:</label>
              <div className="grid grid-cols-3 gap-1">
                {['child', 'member', 'parent'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setInviteRole(role)}
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                      inviteRole === role
                        ? 'bg-secondary text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                    data-testid={`invite-role-${role}`}
                  >
                    {role === 'child' && <Baby className="w-4 h-4" />}
                    {role === 'member' && <User className="w-4 h-4" />}
                    {role === 'parent' && <Shield className="w-4 h-4" />}
                    {role}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => { setShowInviteModal(false); setInviteEmail(''); }}
                className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                className="flex-1 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-white text-sm font-bold transition-all"
                data-testid="send-invite-btn"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Management Modal */}
      {showMemberModal && selectedMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-5 w-full max-w-sm" data-testid="member-modal">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Manage Member
            </h2>
            
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-white">
                {selectedMember.name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="font-medium text-white">{selectedMember.name}</p>
                <p className="text-xs text-slate-400">{selectedMember.email}</p>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1.5 block">Change role to:</label>
              <div className="grid grid-cols-3 gap-1">
                {['child', 'member', 'parent'].map((role) => (
                  <button
                    key={role}
                    onClick={() => handleChangeMemberRole(selectedMember.user_id, role)}
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                      selectedMember.role === role
                        ? 'bg-primary text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {role === 'child' && <Baby className="w-4 h-4" />}
                    {role === 'member' && <User className="w-4 h-4" />}
                    {role === 'parent' && <Shield className="w-4 h-4" />}
                    {role}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => { setShowMemberModal(false); setSelectedMember(null); }}
                className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-all"
              >
                Close
              </button>
              <button
                onClick={() => handleRemoveMember(selectedMember.user_id)}
                className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-sm font-bold transition-all"
                data-testid="remove-member-btn"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

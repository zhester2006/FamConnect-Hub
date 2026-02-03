import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, Shield, User as UserIcon, Baby, X } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import RoleManager from '@/components/RoleManager';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function FamilyManagement({ user }) {
  const [familyMembers, setFamilyMembers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    role: 'child'
  });

  useEffect(() => {
    fetchFamilyMembers();
  }, []);

  const fetchFamilyMembers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/family/members`, { credentials: 'include' });
      const data = await res.json();
      setFamilyMembers(data.members || []);
    } catch (error) {
      console.error('Failed to fetch family members:', error);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/child`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newMember)
      });

      if (!res.ok) throw new Error('Failed to add member');

      toast.success(`${newMember.name} added to family!`);
      setShowAddMember(false);
      setNewMember({ name: '', email: '', role: 'child' });
      fetchFamilyMembers();
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error('Failed to add family member');
    }
  };

  const getRoleStats = () => {
    const stats = {
      parent: familyMembers.filter(m => m.role === 'parent').length,
      member: familyMembers.filter(m => m.role === 'member').length,
      child: familyMembers.filter(m => m.role === 'child').length
    };
    return stats;
  };

  const stats = getRoleStats();

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-6 space-y-4" data-testid="family-management">
          <header className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-white">Family Management</h1>
              <p className="text-sm text-slate-400 mt-1">{familyMembers.length} total members</p>
            </div>
            <button
              onClick={() => setShowAddMember(true)}
              className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-full font-bold transition-all flex items-center space-x-2"
              data-testid="add-member-button"
            >
              <UserPlus className="w-5 h-5" />
              <span>Add Member</span>
            </button>
          </header>

          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card rounded-xl p-4">
              <Shield className="w-5 h-5 text-primary mb-2" />
              <p className="text-2xl font-black text-white">{stats.parent}</p>
              <p className="text-xs text-slate-400">Parents</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <UserIcon className="w-5 h-5 text-secondary mb-2" />
              <p className="text-2xl font-black text-white">{stats.member}</p>
              <p className="text-xs text-slate-400">Members</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <Baby className="w-5 h-5 text-accent mb-2" />
              <p className="text-2xl font-black text-white">{stats.child}</p>
              <p className="text-xs text-slate-400">Children</p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">All Members</h2>
            {familyMembers.map((member) => (
              <div key={member.user_id} className="glass-card rounded-xl p-4" data-testid={`member-${member.user_id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl font-black text-white flex-shrink-0">
                      {member.name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{member.name}</h3>
                      <div className="flex items-center space-x-2 text-sm text-slate-400">
                        <Mail className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{member.email}</span>
                      </div>
                      {member.online_status && (
                        <div className="flex items-center space-x-1 mt-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-xs text-green-400">Online</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <div className="space-y-1">
                    {member.role === 'child' && (
                      <div className="flex items-center space-x-3 text-sm">
                        <span className="text-slate-400">Points: <span className="text-accent font-bold">{member.points || 0}</span></span>
                        <span className="text-slate-400">Badges: <span className="text-secondary font-bold">{member.badges?.length || 0}</span></span>
                      </div>
                    )}
                    {member.user_id === user?.user_id && (
                      <span className="text-xs text-primary font-medium">(You)</span>
                    )}
                  </div>
                  
                  <RoleManager 
                    member={member} 
                    currentUser={user}
                    onRoleUpdated={fetchFamilyMembers}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-xl p-4">
            <h3 className="text-lg font-bold text-white mb-3">Role Descriptions</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-sm">Parent</p>
                  <p className="text-xs text-slate-400">Full access, can manage family, assign chores, approve requests</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <UserIcon className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-sm">Member</p>
                  <p className="text-xs text-slate-400">Adult family member with limited admin access</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Baby className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-sm">Child</p>
                  <p className="text-xs text-slate-400">Points, rewards, parental approval for requests</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showAddMember && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="add-member-modal">
          <div className="glass-card rounded-2xl p-5 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-white">Add Family Member</h2>
              <button onClick={() => setShowAddMember(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                <input
                  type="text"
                  placeholder="Member name"
                  value={newMember.name}
                  onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                  required
                  data-testid="member-name-input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email (optional)</label>
                <input
                  type="email"
                  placeholder="member@family.com"
                  value={newMember.email}
                  onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                  data-testid="member-email-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'parent', label: 'Parent', icon: Shield },
                    { value: 'member', label: 'Member', icon: UserIcon },
                    { value: 'child', label: 'Child', icon: Baby }
                  ].map(role => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setNewMember({...newMember, role: role.value})}
                        className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                          newMember.role === role.value
                            ? 'bg-primary/20 border-primary'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                        }`}
                        data-testid={`role-select-${role.value}`}
                      >
                        <Icon className="w-5 h-5 text-white mb-1" />
                        <span className="text-xs text-white font-medium">{role.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/80 text-white font-bold py-3 px-4 rounded-full transition-all"
                  data-testid="submit-member-button"
                >
                  Add Member
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMember(false);
                    setNewMember({ name: '', email: '', role: 'child' });
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-full transition-all"
                  data-testid="cancel-member-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

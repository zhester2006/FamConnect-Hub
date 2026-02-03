import React, { useState } from 'react';
import { Shield, User, Baby } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function RoleManager({ member, currentUser, onRoleUpdated }) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  const roles = [
    { value: 'parent', label: 'Parent', icon: Shield, color: 'text-primary', description: 'Full access to all features' },
    { value: 'member', label: 'Member', icon: User, color: 'text-secondary', description: 'Adult family member with limited admin' },
    { value: 'child', label: 'Child', icon: Baby, color: 'text-accent', description: 'Limited access with points & rewards' }
  ];

  const handleRoleChange = async (newRole) => {
    if (member.user_id === currentUser.user_id) {
      toast.error("You cannot change your own role");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/${member.user_id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to update role');
      }

      const updatedMember = await res.json();
      toast.success(`${member.name}'s role updated to ${newRole}`);
      setShowRoleMenu(false);
      if (onRoleUpdated) onRoleUpdated(updatedMember);
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error(error.message || 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const currentRole = roles.find(r => r.value === member.role) || roles[2];
  const Icon = currentRole.icon;

  if (member.user_id === currentUser?.user_id) {
    return (
      <div className="flex items-center space-x-2">
        <Icon className={`w-4 h-4 ${currentRole.color}`} />
        <span className="text-sm text-slate-400 capitalize">{member.role} (You)</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowRoleMenu(!showRoleMenu)}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-all"
        data-testid={`role-manager-${member.user_id}`}
      >
        <Icon className={`w-4 h-4 ${currentRole.color}`} />
        <span className="text-sm text-white capitalize">{member.role}</span>
        <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {showRoleMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowRoleMenu(false)}
          />
          <div className="absolute top-full mt-2 right-0 z-50 glass-card rounded-xl border border-slate-700 shadow-xl min-w-[280px]" data-testid="role-menu">
            <div className="p-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">Change Role</h4>
              <p className="text-xs text-slate-400 mt-1">Select a role for {member.name}</p>
            </div>
            <div className="p-2 space-y-1">
              {roles.map(role => {
                const RoleIcon = role.icon;
                const isSelected = member.role === role.value;
                return (
                  <button
                    key={role.value}
                    onClick={() => handleRoleChange(role.value)}
                    disabled={loading || isSelected}
                    className={`w-full flex items-start space-x-3 p-3 rounded-lg transition-all ${
                      isSelected 
                        ? 'bg-primary/20 border border-primary/50' 
                        : 'hover:bg-slate-800/50 border border-transparent'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    data-testid={`role-option-${role.value}`}
                  >
                    <RoleIcon className={`w-5 h-5 ${role.color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{role.label}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{role.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

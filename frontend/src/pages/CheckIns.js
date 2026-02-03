import React, { useState, useEffect } from 'react';
import { MapPin, Clock, User } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function CheckIns({ user }) {
  const [checkins, setCheckins] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    fetchFamilyMembers();
  }, []);

  const fetchFamilyMembers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/family/members`, { credentials: 'include' });
      const data = await res.json();
      const children = data.members.filter(m => m.role === 'child');
      setFamilyMembers(children);
      if (children.length > 0) {
        fetchCheckins(children[0].user_id);
        setSelectedMember(children[0]);
      }
    } catch (error) {
      console.error('Failed to fetch family members:', error);
    }
  };

  const fetchCheckins = async (userId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/checkins/${userId}`, { credentials: 'include' });
      const data = await res.json();
      setCheckins(data.checkins);
    } catch (error) {
      console.error('Failed to fetch check-ins:', error);
    }
  };

  const handleRequestCheckin = async (memberId) => {
    toast.info('Check-in request sent! (Feature coming soon)');
  };

  const handleMemberSelect = (member) => {
    setSelectedMember(member);
    fetchCheckins(member.user_id);
  };

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto lg:ml-72">
        <div className="p-6 lg:p-8 space-y-6 pb-24 lg:pb-8">
          <header>
            <h1 className="text-3xl font-black text-white flex items-center space-x-2">
              <MapPin className="w-8 h-8 text-red-400" />
              <span>Check-Ins</span>
            </h1>
            <p className="text-slate-400 mt-1">Track family member locations</p>
          </header>

          {user?.role === 'parent' && (
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-lg font-bold text-white mb-3">Family Members</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {familyMembers.map(member => (
                  <button
                    key={member.user_id}
                    onClick={() => handleMemberSelect(member)}
                    className={`flex items-center space-x-3 p-4 rounded-xl transition-all border ${
                      selectedMember?.user_id === member.user_id
                        ? 'bg-primary/20 border-primary'
                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    }`}
                    data-testid={`member-${member.user_id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg font-black text-white">
                      {member.name.charAt(0)}
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-bold text-white text-sm">{member.name}</p>
                      {member.online_status && (
                        <div className="flex items-center space-x-1 mt-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-xs text-green-400">Online</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedMember && (
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{selectedMember.name}'s Check-Ins</h3>
                <button
                  onClick={() => handleRequestCheckin(selectedMember.user_id)}
                  className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-full text-sm font-bold transition-all"
                  data-testid="request-checkin-button"
                >
                  Request Check-In
                </button>
              </div>

              {checkins.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No check-ins yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {checkins.map(checkin => (
                    <div key={checkin.checkin_id} className="bg-slate-900/50 rounded-xl p-4" data-testid="checkin-item">
                      <div className="flex items-start space-x-3">
                        <MapPin className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-white">{checkin.address || 'Location data'}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-slate-400">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{new Date(checkin.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            <span>Lat: {checkin.latitude.toFixed(6)}, Long: {checkin.longitude.toFixed(6)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white mb-3">About Check-Ins</h3>
            <div className="space-y-2 text-sm text-slate-400">
              <p>• Parents can request check-ins from children</p>
              <p>• Children receive a push notification to check in</p>
              <p>• Location and timestamp are recorded for safety</p>
              <p>• Check-ins can be disabled in settings</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
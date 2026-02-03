import React, { useState, useEffect } from 'react';
import { Users, Calendar, MessageCircle, Sun } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function HomeHub({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [familyMembers, setFamilyMembers] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [quote, setQuote] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    fetchHubData();
    return () => clearInterval(timer);
  }, []);

  const fetchHubData = async () => {
    try {
      const [membersRes, eventsRes, quoteRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/family/members`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/events`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/family-wall/daily-quote`, { credentials: 'include' })
      ]);

      const members = await membersRes.json();
      const events = await eventsRes.json();
      const quoteData = await quoteRes.json();

      setFamilyMembers(members.members);
      
      const today = new Date().toISOString().split('T')[0];
      setTodayEvents(events.events.filter(e => e.event_date === today));
      setQuote(quoteData.quote);
    } catch (error) {
      console.error('Failed to fetch hub data:', error);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto lg:ml-72">
        <div className="p-4 lg:p-6" data-testid="home-hub">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-7xl mx-auto">
            <div className="lg:col-span-8 space-y-4">
              <div className="glass-card rounded-3xl p-5 lg:p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <p className="text-slate-400 text-sm lg:text-base mb-1">{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                  <h1 className="text-4xl lg:text-6xl font-black text-white mb-3">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </h1>
                  <div className="flex items-center space-x-3">
                    <Sun className="w-6 h-6 text-accent" />
                    <span className="text-xl text-white">72°F</span>
                    <span className="text-slate-400 text-sm">Sunny</span>
                  </div>
                </div>
              </div>

          {quote && (
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-xs font-bold text-accent mb-1">Daily Inspiration</h3>
              <p className="text-sm lg:text-base text-white italic">"{quote}"</p>
            </div>
          )}

          <div className="glass-card rounded-2xl p-4">
            <h2 className="text-lg lg:text-xl font-bold text-white mb-3 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-secondary" />
              <span>Today's Schedule</span>
            </h2>
            {todayEvents.length === 0 ? (
              <p className="text-slate-400 text-sm">No events scheduled for today</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.map(event => (
                  <div key={event.event_id} className="bg-slate-900/50 rounded-xl p-3">
                    <h4 className="font-bold text-white text-sm">{event.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{event.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="glass-card rounded-2xl p-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Family</span>
            </h3>
            <div className="space-y-2">
              {familyMembers.map(member => (
                <div key={member.user_id} className="flex items-center space-x-2">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-black text-white">
                      {member.name.charAt(0)}
                    </div>
                    {member.online_status && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-slate-950 rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{member.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4">
            <h3 className="text-lg font-bold text-white mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-slate-900/50 hover:bg-slate-800/50 rounded-xl p-3 transition-all text-center">
                <MessageCircle className="w-6 h-6 text-primary mx-auto mb-1" />
                <p className="text-xs text-white font-medium">Chat</p>
              </button>
              <button className="bg-slate-900/50 hover:bg-slate-800/50 rounded-xl p-3 transition-all text-center">
                <Calendar className="w-6 h-6 text-secondary mx-auto mb-1" />
                <p className="text-xs text-white font-medium">Events</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </main>
    </div>
  );
}
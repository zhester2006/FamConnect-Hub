import React, { useState, useEffect } from 'react';
import { Home, Users, Calendar, MessageCircle, Sun, Cloud, Wind } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function HomeHub({ user }) {
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
    <div className="min-h-screen bg-slate-950 p-8" data-testid="home-hub">
      <div className="grid grid-cols-12 gap-6 max-w-7xl mx-auto">
        <div className="col-span-8 space-y-6">
          <div className="glass-card rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <p className="text-slate-400 text-lg mb-2">{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              <h1 className="text-7xl font-black text-white mb-4">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </h1>
              <div className="flex items-center space-x-4">
                <Sun className="w-8 h-8 text-accent" />
                <span className="text-2xl text-white">72°F</span>
                <span className="text-slate-400">Sunny</span>
              </div>
            </div>
          </div>

          {quote && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-sm font-bold text-accent mb-2">Daily Inspiration</h3>
              <p className="text-lg text-white italic">"{quote}"</p>
            </div>
          )}

          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center space-x-2">
              <Calendar className="w-6 h-6 text-secondary" />
              <span>Today's Schedule</span>
            </h2>
            {todayEvents.length === 0 ? (
              <p className="text-slate-400">No events scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {todayEvents.map(event => (
                  <div key={event.event_id} className="bg-slate-900/50 rounded-xl p-4">
                    <h4 className="font-bold text-white">{event.title}</h4>
                    <p className="text-sm text-slate-400 mt-1">{event.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-4 space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Family</span>
            </h3>
            <div className="space-y-3">
              {familyMembers.map(member => (
                <div key={member.user_id} className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg font-black text-white">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-white">{member.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{member.role}</p>
                  </div>
                  {member.online_status && (
                    <div className="ml-auto w-3 h-3 bg-green-400 rounded-full"></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-slate-900/50 hover:bg-slate-800/50 rounded-xl p-4 transition-all text-center">
                <MessageCircle className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-white font-medium">Chat</p>
              </button>
              <button className="bg-slate-900/50 hover:bg-slate-800/50 rounded-xl p-4 transition-all text-center">
                <Calendar className="w-8 h-8 text-secondary mx-auto mb-2" />
                <p className="text-sm text-white font-medium">Events</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
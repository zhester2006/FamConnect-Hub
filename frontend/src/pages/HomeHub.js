import React, { useState, useEffect } from 'react';
import { Calendar, Plus, ShoppingCart, CheckCircle, Clock, Users, Sun, Cloud, CloudRain, Wind } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const WeatherIcon = ({ condition }) => {
  const icons = {
    sunny: <Sun className="w-8 h-8 text-yellow-400 animate-pulse" />,
    cloudy: <Cloud className="w-8 h-8 text-slate-400" />,
    rainy: <CloudRain className="w-8 h-8 text-blue-400" />,
    windy: <Wind className="w-8 h-8 text-cyan-400" />
  };
  return icons[condition] || icons.sunny;
};

export default function HomeHub({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [familyMembers, setFamilyMembers] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [quote, setQuote] = useState('');
  const [shoppingItems, setShoppingItems] = useState([]);
  const [todayChores, setTodayChores] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', event_date: new Date().toISOString().split('T')[0] });
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    fetchHubData();
    return () => clearInterval(timer);
  }, []);

  const fetchHubData = async () => {
    try {
      const [membersRes, eventsRes, quoteRes, shoppingRes, choresRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/family/members`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/events`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/family-wall/daily-quote`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/shopping`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/chores`, { credentials: 'include' })
      ]);

      const members = await membersRes.json();
      const events = await eventsRes.json();
      const quoteData = await quoteRes.json();
      const shopping = await shoppingRes.json();
      const chores = await choresRes.json();

      setFamilyMembers(members.members);
      
      const today = new Date().toISOString().split('T')[0];
      setTodayEvents(events.events.filter(e => e.event_date === today));
      setQuote(quoteData.quote);
      setShoppingItems(shopping.items.filter(i => i.status === 'approved'));
      setTodayChores(chores.chores.filter(c => c.scheduled_date === today));
    } catch (error) {
      console.error('Failed to fetch hub data:', error);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BACKEND_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newEvent)
      });
      toast.success('Event added!');
      setShowAddEvent(false);
      setNewEvent({ title: '', event_date: new Date().toISOString().split('T')[0] });
      fetchHubData();
    } catch (error) {
      toast.error('Failed to add event');
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BACKEND_URL}/api/shopping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newItem })
      });
      toast.success('Item added to shopping list!');
      setShowAddItem(false);
      setNewItem('');
      fetchHubData();
    } catch (error) {
      toast.error('Failed to add item');
    }
  };

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto lg:ml-72">
        <div className="p-3 lg:p-4" data-testid="home-hub">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 max-w-7xl mx-auto">
            {/* Top Row: Date/Time & Family */}
            <div className="lg:col-span-7">
              <div className="glass-card rounded-2xl p-4 relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <p className="text-slate-400 text-xs mb-1">{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                  <h1 className="text-3xl lg:text-5xl font-black text-white mb-2">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </h1>
                  <div className="flex items-center space-x-2">
                    <WeatherIcon condition="sunny" />
                    <span className="text-xl text-white">72°F</span>
                    <span className="text-slate-400 text-sm">Sunny</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="glass-card rounded-2xl p-4">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Family Online</span>
                </h3>
                <div className="space-y-2">
                  {familyMembers.slice(0, 3).map(member => (
                    <div key={member.user_id} className="flex items-center space-x-2">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-black text-white">
                          {member.name.charAt(0)}
                        </div>
                        {member.online_status && (
                          <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 border border-slate-950 rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-xs truncate">{member.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Second Row: Calendar & Chores */}
            <div className="lg:col-span-6">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-secondary" />
                    <span>Today's Events</span>
                  </h3>
                  <button
                    onClick={() => setShowAddEvent(true)}
                    className="p-1 bg-secondary hover:bg-secondary/80 rounded-full transition-all"
                    data-testid="add-event-btn"
                  >
                    <Plus className="w-3 h-3 text-white" />
                  </button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
                  {todayEvents.length === 0 ? (
                    <p className="text-slate-400 text-xs">No events today</p>
                  ) : (
                    todayEvents.map(event => (
                      <div key={event.event_id} className="bg-slate-900/50 rounded-lg p-2">
                        <p className="font-bold text-white text-xs">{event.title}</p>
                        <p className="text-xs text-slate-400 truncate">{event.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="glass-card rounded-2xl p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Today's Chores</span>
                </h3>
                <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
                  {todayChores.length === 0 ? (
                    <p className="text-slate-400 text-xs">No chores scheduled</p>
                  ) : (
                    todayChores.map(chore => (
                      <div key={chore.chore_id} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2">
                        <div className="flex-1">
                          <p className="font-medium text-white text-xs">{chore.title}</p>
                          <p className="text-xs text-slate-400">Assigned to: {chore.assigned_to}</p>
                        </div>
                        {chore.status === 'approved' && (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        )}
                        {chore.status === 'pending' && (
                          <Clock className="w-4 h-4 text-yellow-400" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Third Row: Shopping & Quote */}
            <div className="lg:col-span-6">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <ShoppingCart className="w-4 h-4 text-blue-400" />
                    <span>Shopping List</span>
                  </h3>
                  <button
                    onClick={() => setShowAddItem(true)}
                    className="p-1 bg-blue-500 hover:bg-blue-600 rounded-full transition-all"
                    data-testid="add-item-btn"
                  >
                    <Plus className="w-3 h-3 text-white" />
                  </button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
                  {shoppingItems.length === 0 ? (
                    <p className="text-slate-400 text-xs">List is empty</p>
                  ) : (
                    shoppingItems.slice(0, 5).map(item => (
                      <div key={item.item_id} className="flex items-center space-x-2 bg-slate-900/50 rounded-lg p-2">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                        <p className="text-white text-xs">{item.name}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="glass-card rounded-2xl p-4">
                <h3 className="text-xs font-bold text-accent mb-2">Daily Inspiration</h3>
                <p className="text-sm text-white italic leading-relaxed">"{quote || 'Loading...'}"</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-black text-white mb-4">Add Event</h2>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <input
                type="text"
                placeholder="Event title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                required
              />
              <input
                type="date"
                value={newEvent.event_date}
                onChange={(e) => setNewEvent({...newEvent, event_date: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white"
                required
              />
              <div className="flex space-x-2">
                <button type="submit" className="flex-1 bg-primary hover:bg-primary/80 text-white font-bold py-3 rounded-full">
                  Add Event
                </button>
                <button type="button" onClick={() => setShowAddEvent(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-full">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Shopping Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-black text-white mb-4">Add Item</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <input
                type="text"
                placeholder="Item name"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                required
              />
              <div className="flex space-x-2">
                <button type="submit" className="flex-1 bg-primary hover:bg-primary/80 text-white font-bold py-3 rounded-full">
                  Add Item
                </button>
                <button type="button" onClick={() => setShowAddItem(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-full">
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
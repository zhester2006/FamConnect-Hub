import React, { useState, useEffect } from 'react';
import { Calendar, Plus, ShoppingCart, CheckCircle, Clock, Users, Sun, Cloud, CloudRain, Wind, Snowflake, CloudLightning, Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const WeatherAnimation = ({ condition, temp }) => {
  const getAnimation = () => {
    switch (condition) {
      case 'sunny':
        return (
          <div className="relative w-16 h-16">
            <Sun className="w-12 h-12 text-yellow-400 animate-spin-slow absolute top-2 left-2" />
            <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-xl animate-pulse" />
          </div>
        );
      case 'cloudy':
        return (
          <div className="relative w-16 h-16">
            <Cloud className="w-10 h-10 text-slate-300 absolute top-1 left-1 animate-bounce-slow" />
            <Cloud className="w-8 h-8 text-slate-400 absolute top-4 left-6 animate-bounce-slow" style={{ animationDelay: '0.5s' }} />
          </div>
        );
      case 'rainy':
        return (
          <div className="relative w-16 h-16">
            <CloudRain className="w-12 h-12 text-blue-400 absolute top-0 left-2" />
            <div className="absolute bottom-0 left-4 flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-0.5 h-3 bg-blue-400 rounded-full animate-rain" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        );
      case 'snowy':
        return (
          <div className="relative w-16 h-16">
            <Snowflake className="w-10 h-10 text-cyan-200 absolute top-2 left-3 animate-spin-slow" />
            <div className="absolute bottom-1 left-2 flex space-x-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-1 h-1 bg-white rounded-full animate-snow" style={{ animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>
          </div>
        );
      case 'stormy':
        return (
          <div className="relative w-16 h-16">
            <CloudLightning className="w-12 h-12 text-purple-400 absolute top-0 left-2 animate-pulse" />
            <div className="absolute bottom-2 left-6 w-1 h-4 bg-yellow-400 animate-flash" />
          </div>
        );
      case 'windy':
        return (
          <div className="relative w-16 h-16">
            <Wind className="w-12 h-12 text-cyan-400 absolute top-2 left-2 animate-wind" />
          </div>
        );
      default:
        return <Sun className="w-12 h-12 text-yellow-400 animate-pulse" />;
    }
  };

  return (
    <div className="flex items-center space-x-3">
      {getAnimation()}
      <div>
        <span className="text-3xl font-black text-white">{temp}°F</span>
        <p className="text-sm text-slate-400 capitalize">{condition}</p>
      </div>
    </div>
  );
};

const MiniCalendar = ({ events, onDateClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();
  
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const hasEvents = (day) => {
    if (!day) return false;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.some(e => e.event_date === dateStr);
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-1 hover:bg-white/10 rounded">
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>
        <span className="text-sm font-bold text-white">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-1 hover:bg-white/10 rounded">
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayNames.map((d, idx) => <div key={idx} className="text-center text-[10px] text-slate-500 font-bold">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {getDaysInMonth(currentDate).map((day, i) => {
          const isToday = day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
          return (
            <div
              key={i}
              onClick={() => day && onDateClick && onDateClick(day)}
              className={`aspect-square flex items-center justify-center text-[10px] rounded cursor-pointer transition-all
                ${day ? 'hover:bg-white/10' : ''}
                ${isToday ? 'bg-primary text-white font-bold' : 'text-slate-300'}
                ${hasEvents(day) && !isToday ? 'text-accent font-bold' : ''}`}
            >
              {day}
              {hasEvents(day) && <span className="absolute w-1 h-1 bg-accent rounded-full -bottom-0.5" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function HomeHub({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [familyMembers, setFamilyMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [quote, setQuote] = useState('');
  const [shoppingItems, setShoppingItems] = useState([]);
  const [todayChores, setTodayChores] = useState([]);
  const [weather, setWeather] = useState({ condition: 'sunny', temp: 72 });
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', event_date: new Date().toISOString().split('T')[0] });
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    fetchHubData();
    simulateWeather();
    return () => clearInterval(timer);
  }, []);

  const simulateWeather = () => {
    const conditions = ['sunny', 'cloudy', 'rainy', 'windy'];
    const temps = [65, 68, 72, 75, 78, 80, 82];
    setWeather({
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      temp: temps[Math.floor(Math.random() * temps.length)]
    });
  };

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
      const eventsData = await eventsRes.json();
      const quoteData = await quoteRes.json();
      const shopping = await shoppingRes.json();
      const chores = await choresRes.json();

      setFamilyMembers(members.members || []);
      setEvents(eventsData.events || []);
      setQuote(quoteData.quote || '');
      setShoppingItems(shopping.items || []);
      
      const today = new Date().toISOString().split('T')[0];
      setTodayChores((chores.chores || []).filter(c => c.scheduled_date === today));
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
      toast.success('Item added!');
      setShowAddItem(false);
      setNewItem('');
      fetchHubData();
    } catch (error) {
      toast.error('Failed to add item');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'chores', label: 'Chores' },
    { id: 'shopping', label: 'Shopping' },
    { id: 'events', label: 'Events' }
  ];

  const todayEvents = events.filter(e => e.event_date === new Date().toISOString().split('T')[0]);

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto lg:ml-72">
        <div className="p-3 lg:p-4 max-w-7xl mx-auto" data-testid="home-hub">
          {/* Compact Tabs */}
          <div className="flex space-x-1 mb-3 bg-slate-900/50 p-1 rounded-xl overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id 
                    ? 'bg-primary text-white shadow-lg' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Top Left: Date/Time/Weather */}
            <div className="lg:col-span-7">
              <div className="glass-card rounded-2xl p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <p className="text-slate-400 text-xs mb-1">
                      {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <h1 className="text-4xl lg:text-5xl font-black text-white mb-3">
                      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </h1>
                    <WeatherAnimation condition={weather.condition} temp={weather.temp} />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Right: Family Online Status */}
            <div className="lg:col-span-5">
              <div className="glass-card rounded-2xl p-4 h-full">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Family</span>
                  <span className="text-xs text-green-400 bg-green-400/20 px-2 py-0.5 rounded-full">
                    {familyMembers.filter(m => m.online_status).length} online
                  </span>
                </h3>
                <div className="space-y-2 max-h-28 overflow-y-auto scrollbar-hide">
                  {familyMembers.map(member => (
                    <div key={member.user_id} className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-800/50 transition-all">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-black text-white">
                          {member.name?.charAt(0)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                          member.online_status ? 'bg-green-400' : 'bg-slate-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-xs truncate">{member.name}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{member.role}</p>
                      </div>
                      {member.online_status && (
                        <span className="text-[10px] text-green-400">Active</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Daily Inspiration */}
            <div className="lg:col-span-12">
              <div className="glass-card rounded-2xl p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl" />
                <div className="relative z-10 flex items-start space-x-3">
                  <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold text-accent mb-1">Daily Inspiration</h3>
                    <p className="text-sm text-white italic leading-relaxed">"{quote || 'Loading your daily inspiration...'}"</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar Widget */}
            <div className="lg:col-span-4">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-secondary" />
                    <span>Calendar</span>
                  </h3>
                  <button
                    onClick={() => setShowAddEvent(true)}
                    className="p-1.5 bg-secondary/20 hover:bg-secondary/40 rounded-lg transition-all"
                    data-testid="add-event-btn"
                  >
                    <Plus className="w-3 h-3 text-secondary" />
                  </button>
                </div>
                <MiniCalendar events={events} />
                {todayEvents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <p className="text-[10px] text-slate-400 mb-2">TODAY</p>
                    <div className="space-y-1.5">
                      {todayEvents.slice(0, 2).map(event => (
                        <div key={event.event_id} className="bg-slate-800/50 rounded-lg p-2">
                          <p className="text-xs font-bold text-white truncate">{event.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chores Section */}
            <div className="lg:col-span-4">
              <div className="glass-card rounded-2xl p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Today's Chores</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {todayChores.filter(c => c.status === 'approved').length}/{todayChores.length}
                  </span>
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                  {todayChores.length === 0 ? (
                    <p className="text-slate-400 text-xs text-center py-4">No chores today!</p>
                  ) : (
                    todayChores.map(chore => (
                      <div key={chore.chore_id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-xs truncate">{chore.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {chore.assigned_to_name || 'Unassigned'} • +{chore.points}pts
                          </p>
                        </div>
                        {chore.status === 'approved' && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />}
                        {chore.status === 'completed' && <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                        {chore.status === 'pending' && <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Shopping List Section */}
            <div className="lg:col-span-4">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <ShoppingCart className="w-4 h-4 text-blue-400" />
                    <span>Shopping List</span>
                  </h3>
                  <button
                    onClick={() => setShowAddItem(true)}
                    className="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg transition-all"
                    data-testid="add-item-btn"
                  >
                    <Plus className="w-3 h-3 text-blue-400" />
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                  {shoppingItems.length === 0 ? (
                    <p className="text-slate-400 text-xs text-center py-4">List is empty</p>
                  ) : (
                    shoppingItems.slice(0, 8).map(item => (
                      <div key={item.item_id} className="flex items-center space-x-2 bg-slate-800/50 rounded-lg p-2.5">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          item.status === 'approved' ? 'bg-green-400' : 
                          item.status === 'purchased' ? 'bg-slate-500' : 'bg-yellow-400'
                        }`} />
                        <p className={`text-xs flex-1 truncate ${
                          item.status === 'purchased' ? 'text-slate-500 line-through' : 'text-white'
                        }`}>{item.name}</p>
                        <span className="text-[10px] text-slate-500 capitalize">{item.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-5 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">Add Event</h2>
              <button onClick={() => setShowAddEvent(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddEvent} className="space-y-3">
              <input
                type="text"
                placeholder="Event title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 text-sm"
                required
              />
              <input
                type="date"
                value={newEvent.event_date}
                onChange={(e) => setNewEvent({...newEvent, event_date: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm"
                required
              />
              <button type="submit" className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-3 rounded-full transition-all">
                Add Event
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Shopping Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-5 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">Add Item</h2>
              <button onClick={() => setShowAddItem(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="space-y-3">
              <input
                type="text"
                placeholder="Item name"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 text-sm"
                required
              />
              <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-full transition-all">
                Add Item
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

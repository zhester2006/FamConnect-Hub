import React, { useState, useEffect } from 'react';
import { Calendar, Plus, ShoppingCart, CheckCircle, Clock, Users, Sun, Cloud, CloudRain, Wind, Snowflake, CloudLightning, Sparkles, X, ChevronLeft, ChevronRight, Star, Bell, CalendarDays, Briefcase } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const EVENT_TYPES = {
  appointment: { label: 'Appointment', color: 'bg-green-500', textColor: 'text-green-400' },
  event: { label: 'Event', color: 'bg-accent', textColor: 'text-accent' },
  work_schedule: { label: 'Work', color: 'bg-orange-500', textColor: 'text-orange-400' },
  task: { label: 'Task', color: 'bg-purple-500', textColor: 'text-purple-400' }
};

const WeatherIcon = ({ condition, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-6 h-6' : 'w-10 h-10';
  const icons = {
    sunny: <Sun className={`${sizeClass} text-yellow-400 animate-pulse`} />,
    cloudy: <Cloud className={`${sizeClass} text-slate-300`} />,
    rainy: <CloudRain className={`${sizeClass} text-blue-400`} />,
    windy: <Wind className={`${sizeClass} text-cyan-400`} />,
    snowy: <Snowflake className={`${sizeClass} text-cyan-200`} />,
    stormy: <CloudLightning className={`${sizeClass} text-purple-400`} />
  };
  return icons[condition] || icons.sunny;
};

const MiniCalendar = ({ events, currentDate, setCurrentDate }) => {
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

  const getEventType = (day) => {
    if (!day) return null;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const event = events.find(e => e.event_date === dateStr);
    return event?.event_type;
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-1 hover:bg-white/10 rounded">
          <ChevronLeft className="w-3 h-3 text-slate-400" />
        </button>
        <span className="text-xs font-bold text-white">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-1 hover:bg-white/10 rounded">
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayNames.map((d, i) => <div key={i} className="text-center text-[9px] text-slate-500 font-bold">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {getDaysInMonth(currentDate).map((day, i) => {
          const isToday = day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
          const eventType = getEventType(day);
          return (
            <div
              key={i}
              className={`aspect-square flex items-center justify-center text-[9px] rounded transition-all relative
                ${day ? 'hover:bg-white/10 cursor-pointer' : ''}
                ${isToday ? 'bg-primary text-white font-bold' : 'text-slate-300'}
                ${hasEvents(day) && !isToday ? 'font-bold' : ''}`}
            >
              {day}
              {hasEvents(day) && (
                <span className={`absolute bottom-0 w-1 h-1 rounded-full ${
                  eventType === 'work_schedule' ? 'bg-orange-400' :
                  eventType === 'appointment' ? 'bg-green-400' : 'bg-accent'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function HomeHub({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [time, setTime] = useState(new Date());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [familyMembers, setFamilyMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [quote, setQuote] = useState('');
  const [shoppingItems, setShoppingItems] = useState([]);
  const [todayChores, setTodayChores] = useState([]);
  const [weather, setWeather] = useState({ condition: 'sunny', temp: 72 });
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newEvent, setNewEvent] = useState({ 
    title: '', 
    event_date: new Date().toISOString().split('T')[0],
    event_time: '09:00',
    event_type: 'appointment'
  });
  const [newItem, setNewItem] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayEvents, setDayEvents] = useState([]);

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
        body: JSON.stringify({
          ...newEvent,
          description: newEvent.event_time ? `Time: ${newEvent.event_time}` : ''
        })
      });
      toast.success('Event added!');
      setShowAddEvent(false);
      setNewEvent({ title: '', event_date: new Date().toISOString().split('T')[0], event_time: '09:00', event_type: 'appointment' });
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

  const handleDayClick = (day) => {
    if (!day) return;
    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const eventsForDay = events.filter(e => e.event_date === dateStr);
    setDayEvents(eventsForDay);
    setSelectedDay({ day, dateStr, fullDate: new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day) });
  };

  const todayEvents = events.filter(e => e.event_date === new Date().toISOString().split('T')[0]);
  const onlineMembers = familyMembers.filter(m => m.online_status);

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="h-full p-3 flex flex-col" data-testid="home-hub">
          {/* Top Bar: Weather + Family Online Status */}
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* Weather & Time */}
            <div className="glass-card rounded-xl px-4 py-2 flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <WeatherIcon condition={weather.condition} size="sm" />
                <span className="text-xl font-black text-white">{weather.temp}°F</span>
              </div>
              <div className="border-l border-slate-700 pl-4">
                <p className="text-lg font-black text-white">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-[10px] text-slate-400">{time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
              </div>
            </div>

            {/* Family Online */}
            <div className="glass-card rounded-xl px-4 py-2 flex items-center space-x-3">
              <Users className="w-4 h-4 text-primary" />
              <div className="flex -space-x-2">
                {familyMembers.slice(0, 5).map(member => (
                  <div key={member.user_id} className="relative" title={member.name}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-black text-white border-2 border-slate-950">
                      {member.name?.charAt(0)}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${member.online_status ? 'bg-green-400' : 'bg-slate-500'}`} />
                  </div>
                ))}
              </div>
              <span className="text-xs text-green-400 font-bold">{onlineMembers.length} online</span>
            </div>
          </div>

          {/* Main Content Grid - Single Screen */}
          <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
            {/* Left Column: Calendar */}
            <div className="col-span-3 flex flex-col gap-3">
              {/* Mini Calendar */}
              <div className="glass-card rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-white flex items-center space-x-1">
                    <Calendar className="w-3 h-3 text-secondary" />
                    <span>Calendar</span>
                  </h3>
                  <button onClick={() => setShowAddEvent(true)} className="p-1 bg-secondary/20 hover:bg-secondary/40 rounded transition-all" data-testid="add-event-btn">
                    <Plus className="w-3 h-3 text-secondary" />
                  </button>
                </div>
                <MiniCalendar events={events} currentDate={calendarDate} setCurrentDate={setCalendarDate} onDayClick={handleDayClick} />
              </div>

              {/* Today's Events */}
              <div className="glass-card rounded-xl p-3 flex-1 overflow-hidden">
                <h3 className="text-xs font-bold text-white mb-2 flex items-center space-x-1">
                  <Bell className="w-3 h-3 text-accent" />
                  <span>Today</span>
                  <span className="text-[10px] text-slate-500 ml-auto">{todayEvents.length}</span>
                </h3>
                <div className="space-y-1.5 overflow-y-auto max-h-32 scrollbar-hide">
                  {todayEvents.length === 0 ? (
                    <p className="text-slate-500 text-[10px]">No events today</p>
                  ) : (
                    todayEvents.map(event => (
                      <div key={event.event_id} className={`rounded-lg p-2 text-[10px] ${
                        event.event_type === 'work_schedule' ? 'bg-orange-500/10 border-l-2 border-orange-400' :
                        event.event_type === 'appointment' ? 'bg-green-500/10 border-l-2 border-green-400' :
                        'bg-accent/10 border-l-2 border-accent'
                      }`}>
                        <p className="font-bold text-white truncate">{event.title}</p>
                        <p className="text-slate-400">{event.event_type?.replace('_', ' ')}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Chores, Shopping, Quote */}
            <div className="col-span-9 flex flex-col gap-3">
              {/* Daily Inspiration */}
              <div className="glass-card rounded-xl p-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-accent/10 rounded-full blur-2xl" />
                <div className="relative z-10 flex items-start space-x-2">
                  <Sparkles className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-[10px] font-bold text-accent mb-0.5">Daily Inspiration</h3>
                    <p className="text-xs text-white italic leading-relaxed line-clamp-2">"{quote || 'Loading...'}"</p>
                  </div>
                </div>
              </div>

              {/* Chores & Shopping Row */}
              <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
                {/* Today's Chores */}
                <div className="glass-card rounded-xl p-3 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-white flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      <span>Chores</span>
                    </h3>
                    <span className="text-[10px] text-slate-400">
                      {todayChores.filter(c => c.status === 'approved').length}/{todayChores.length}
                    </span>
                  </div>
                  <div className="flex-1 space-y-1.5 overflow-y-auto scrollbar-hide">
                    {todayChores.length === 0 ? (
                      <p className="text-slate-500 text-[10px] text-center py-2">No chores today!</p>
                    ) : (
                      todayChores.map(chore => (
                        <div key={chore.chore_id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-[10px] truncate">{chore.title}</p>
                            <p className="text-[9px] text-slate-400 truncate">
                              {chore.assigned_to_name || 'Unassigned'} • <span className="text-accent">+{chore.points}pts</span>
                            </p>
                          </div>
                          {chore.status === 'approved' && <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />}
                          {chore.status === 'completed' && <Clock className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                          {chore.status === 'pending' && <Clock className="w-3 h-3 text-slate-500 flex-shrink-0" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Shopping List */}
                <div className="glass-card rounded-xl p-3 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-white flex items-center space-x-1">
                      <ShoppingCart className="w-3 h-3 text-blue-400" />
                      <span>Shopping</span>
                    </h3>
                    <button onClick={() => setShowAddItem(true)} className="p-1 bg-blue-500/20 hover:bg-blue-500/40 rounded transition-all" data-testid="add-item-btn">
                      <Plus className="w-3 h-3 text-blue-400" />
                    </button>
                  </div>
                  <div className="flex-1 space-y-1.5 overflow-y-auto scrollbar-hide">
                    {shoppingItems.length === 0 ? (
                      <p className="text-slate-500 text-[10px] text-center py-2">List empty</p>
                    ) : (
                      shoppingItems.slice(0, 8).map(item => (
                        <div key={item.item_id} className="flex items-center space-x-2 bg-slate-800/50 rounded-lg p-2">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            item.status === 'approved' ? 'bg-green-400' : 
                            item.status === 'purchased' ? 'bg-slate-500' : 'bg-yellow-400'
                          }`} />
                          <p className={`text-[10px] flex-1 truncate ${item.status === 'purchased' ? 'text-slate-500 line-through' : 'text-white'}`}>
                            {item.name}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
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
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 text-sm"
                required
              />
              <select
                value={newEvent.event_type}
                onChange={(e) => setNewEvent({...newEvent, event_type: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm"
                data-testid="event-type-select"
              >
                <option value="appointment">Appointment</option>
                <option value="event">Event</option>
                <option value="work_schedule">Work Schedule</option>
                <option value="task">Task</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={newEvent.event_date}
                  onChange={(e) => setNewEvent({...newEvent, event_date: e.target.value})}
                  className="bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm"
                  required
                />
                <input
                  type="time"
                  value={newEvent.event_time}
                  onChange={(e) => setNewEvent({...newEvent, event_time: e.target.value})}
                  className="bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm"
                  data-testid="event-time-input"
                />
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-2.5 rounded-full transition-all text-sm">
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
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 text-sm"
                required
              />
              <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 rounded-full transition-all text-sm">
                Add Item
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

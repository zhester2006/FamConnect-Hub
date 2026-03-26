import React, { useState, useEffect } from 'react';
import { Calendar, Plus, ShoppingCart, CheckCircle, Clock, Users, Sun, Cloud, CloudRain, Wind, Snowflake, CloudLightning, Sparkles, X, ChevronLeft, ChevronRight, Star, Bell, CalendarDays, Briefcase, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Avatar } from '@/components/Avatar';
import { toast } from 'sonner';
import { SCREENSAVER_IMAGES } from '@/utils/pageBackgrounds';
import ProfilePinVerification from '@/components/ProfilePinVerification';

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

const MiniCalendar = ({ events, currentDate, setCurrentDate, onDayClick }) => {
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
              onClick={() => onDayClick && onDayClick(day)}
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
  const [weatherForecast, setWeatherForecast] = useState([]);
  const [showForecast, setShowForecast] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showPinVerify, setShowPinVerify] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [pendingChoresByMember, setPendingChoresByMember] = useState([]);
  const [selectedChore, setSelectedChore] = useState(null);
  const [quoteType, setQuoteType] = useState('inspiration');
  const [newEvent, setNewEvent] = useState({ 
    title: '', 
    event_date: new Date().toISOString().split('T')[0],
    event_time: '09:00',
    event_type: 'appointment'
  });
  const [newItem, setNewItem] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayEvents, setDayEvents] = useState([]);
  
  // Screensaver background state
  const [bgIndex, setBgIndex] = useState(() => Math.floor(Math.random() * SCREENSAVER_IMAGES.length));
  const [nextBgIndex, setNextBgIndex] = useState(() => (Math.floor(Math.random() * SCREENSAVER_IMAGES.length) + 1) % SCREENSAVER_IMAGES.length);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    fetchHubData();
    fetchWeather();
    
    // Background rotation every 15 seconds
    const bgTimer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setBgIndex(nextBgIndex);
        setNextBgIndex((nextBgIndex + 1 + Math.floor(Math.random() * 3)) % SCREENSAVER_IMAGES.length);
        setIsTransitioning(false);
      }, 2000);
    }, 15000);
    
    return () => {
      clearInterval(timer);
      clearInterval(bgTimer);
    };
  }, [nextBgIndex]);

  const fetchWeather = async () => {
    try {
      // Try to get user's location for accurate weather
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const [weatherRes, forecastRes] = await Promise.all([
              fetch(`${BACKEND_URL}/api/weather?lat=${position.coords.latitude}&lon=${position.coords.longitude}`, { credentials: 'include' }),
              fetch(`${BACKEND_URL}/api/weather/forecast?lat=${position.coords.latitude}&lon=${position.coords.longitude}&days=3`, { credentials: 'include' })
            ]);
            if (weatherRes.ok) {
              const data = await weatherRes.json();
              setWeather({
                condition: data.condition || 'sunny',
                temp: data.temp || 72,
                description: data.description,
                city: data.city,
                humidity: data.humidity,
                isMocked: data.is_mocked
              });
            }
            if (forecastRes.ok) {
              const forecastData = await forecastRes.json();
              setWeatherForecast(forecastData.forecast || []);
            }
          },
          async () => {
            // Fallback to default location if geolocation fails
            const [weatherRes, forecastRes] = await Promise.all([
              fetch(`${BACKEND_URL}/api/weather`, { credentials: 'include' }),
              fetch(`${BACKEND_URL}/api/weather/forecast?days=3`, { credentials: 'include' })
            ]);
            if (weatherRes.ok) {
              const data = await weatherRes.json();
              setWeather({
                condition: data.condition || 'sunny',
                temp: data.temp || 72,
                description: data.description,
                city: data.city,
                humidity: data.humidity,
                isMocked: data.is_mocked
              });
            }
            if (forecastRes.ok) {
              const forecastData = await forecastRes.json();
              setWeatherForecast(forecastData.forecast || []);
            }
          }
        );
      } else {
        // No geolocation, use default
        const [weatherRes, forecastRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/weather`, { credentials: 'include' }),
          fetch(`${BACKEND_URL}/api/weather/forecast?days=3`, { credentials: 'include' })
        ]);
        if (weatherRes.ok) {
          const data = await weatherRes.json();
          setWeather({
            condition: data.condition || 'sunny',
            temp: data.temp || 72,
            description: data.description,
            city: data.city,
            humidity: data.humidity,
            isMocked: data.is_mocked
          });
        }
        if (forecastRes.ok) {
          const forecastData = await forecastRes.json();
          setWeatherForecast(forecastData.forecast || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      // Keep default simulated weather on error
    }
  };

  const fetchHubData = async () => {
    try {
      const token = localStorage.getItem('dev_session_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const [membersRes, eventsRes, quoteRes, shoppingRes, choresRes, pendingChoresRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/family/members`, { credentials: 'include', headers }),
        fetch(`${BACKEND_URL}/api/events`, { credentials: 'include', headers }),
        fetch(`${BACKEND_URL}/api/family-wall/daily-quote?quote_type=${quoteType}`, { credentials: 'include', headers }),
        fetch(`${BACKEND_URL}/api/shopping`, { credentials: 'include', headers }),
        fetch(`${BACKEND_URL}/api/chores`, { credentials: 'include', headers }),
        fetch(`${BACKEND_URL}/api/chores/pending-by-member`, { credentials: 'include', headers })
      ]);

      const members = await membersRes.json();
      const eventsData = await eventsRes.json();
      const quoteData = await quoteRes.json();
      const shopping = await shoppingRes.json();
      const chores = await choresRes.json();
      const pendingChores = pendingChoresRes.ok ? await pendingChoresRes.json() : { members: [] };

      setFamilyMembers(members.members || []);
      setEvents(eventsData.events || []);
      setQuote(quoteData.quote || '');
      setShoppingItems(shopping.items || []);
      setPendingChoresByMember(pendingChores.members || []);
      
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

  const handleCompleteChore = async (choreId) => {
    try {
      const token = localStorage.getItem('dev_session_token');
      const res = await fetch(`${BACKEND_URL}/api/chores/${choreId}/complete`, {
        method: 'PUT',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        toast.success('Chore marked as complete!');
        setSelectedChore(null);
        setVerifiedUser(null);
        fetchHubData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Failed to complete chore');
      }
    } catch (error) {
      toast.error('Failed to complete chore');
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
  
  const currentBg = SCREENSAVER_IMAGES[bgIndex];
  const nextBg = SCREENSAVER_IMAGES[nextBgIndex];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Screensaver Background */}
      <div className="fixed inset-0 z-0">
        {/* Current Image */}
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-2000 animate-kenburns ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ backgroundImage: `url(${currentBg?.url})` }}
        />
        {/* Next Image */}
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-2000 ${
            isTransitioning ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url(${nextBg?.url})` }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-slate-950/70" />
      </div>
      
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-hidden transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="h-full p-3 flex flex-col" data-testid="home-hub">
          {/* Top Bar: Weather + Family Online Status */}
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* Weather & Time - Expandable */}
            <div className="relative">
              <button 
                onClick={() => setShowForecast(!showForecast)}
                className="glass-card rounded-xl px-4 py-2 flex items-center space-x-4 hover:bg-slate-800/50 transition-all"
              >
                <div className="flex items-center space-x-2">
                  <WeatherIcon condition={weather.condition} size="sm" />
                  <div>
                    <span className="text-xl font-black text-white">{weather.temp}°F</span>
                    {weather.city && <p className="text-[10px] text-slate-400">{weather.city}</p>}
                  </div>
                </div>
                <div className="border-l border-slate-700 pl-4">
                  <p className="text-lg font-black text-white">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-[10px] text-slate-400">{time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
                {showForecast ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
              
              {/* Weather Forecast Dropdown */}
              {showForecast && (
                <div className="absolute top-full left-0 mt-2 glass-card rounded-xl p-3 z-50 min-w-[280px] animate-fadeIn">
                  <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                    <Sun className="w-3 h-3 text-yellow-400" />
                    {weatherForecast.length > 0 ? `${weatherForecast.length}-Day Forecast` : '3-Day Forecast'}
                  </h4>
                  <div className="space-y-2">
                    {weatherForecast.length > 0 ? (
                      weatherForecast.map((day, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                          <div className="flex items-center gap-2">
                            <WeatherIcon condition={day.condition} size="sm" />
                            <div>
                              <p className="text-xs font-bold text-white">{day.day_name}</p>
                              <p className="text-[10px] text-slate-400 capitalize">{day.description || day.condition}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-white">{day.temp_high}°</p>
                            <p className="text-[10px] text-slate-400">{day.temp_low}°</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-2">Loading forecast...</p>
                    )}
                  </div>
                  {weather.humidity && (
                    <p className="text-[10px] text-slate-500 mt-2 text-center">
                      Current humidity: {weather.humidity}%
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Family Online */}
            <div className="glass-card rounded-xl px-4 py-2 flex items-center space-x-3">
              <Users className="w-4 h-4 text-primary" />
              <div className="flex -space-x-2">
                {familyMembers.slice(0, 5).map(member => (
                  <div key={member.user_id} className="relative" title={member.name}>
                    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-950 flex-shrink-0">
                      {member.picture ? (
                        <img src={member.picture} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-black text-white">
                          {member.name?.charAt(0)}
                        </div>
                      )}
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
                  <button 
                    onClick={() => {
                      if (user?.role === 'homehub') {
                        setPendingAction('addEvent');
                        setShowPinVerify(true);
                      } else {
                        setShowAddEvent(true);
                      }
                    }} 
                    className="p-1 bg-secondary/20 hover:bg-secondary/40 rounded transition-all flex items-center gap-1" 
                    data-testid="add-event-btn"
                  >
                    {user?.role === 'homehub' && <Lock className="w-2 h-2 text-secondary" />}
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
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-accent" />
                      <h3 className="text-[10px] font-bold text-accent">
                        {quoteType === 'bible' ? 'Daily Bible Verse' : 'Daily Inspiration'}
                      </h3>
                    </div>
                    <div className="flex bg-slate-800 rounded p-0.5">
                      <button
                        onClick={() => { setQuoteType('inspiration'); fetchHubData(); }}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-medium transition-all ${
                          quoteType === 'inspiration' ? 'bg-accent text-white' : 'text-slate-400'
                        }`}
                      >
                        ✨
                      </button>
                      <button
                        onClick={() => { setQuoteType('bible'); fetchHubData(); }}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-medium transition-all ${
                          quoteType === 'bible' ? 'bg-accent text-white' : 'text-slate-400'
                        }`}
                      >
                        ✝️
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-white italic leading-relaxed line-clamp-2">"{quote || 'Loading...'}"</p>
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
                    <button 
                      onClick={() => {
                        if (user?.role === 'homehub') {
                          setPendingAction('addItem');
                          setShowPinVerify(true);
                        } else {
                          setShowAddItem(true);
                        }
                      }} 
                      className="p-1 bg-blue-500/20 hover:bg-blue-500/40 rounded transition-all flex items-center gap-1" 
                      data-testid="add-item-btn"
                    >
                      {user?.role === 'homehub' && <Lock className="w-2 h-2 text-blue-400" />}
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

              {/* Quick Actions - Mark Chores Complete */}
              {pendingChoresByMember.length > 0 && (
                <div className="glass-card rounded-xl p-3">
                  <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    Quick Actions - Complete Your Chores
                  </h3>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {pendingChoresByMember.map(member => (
                      <div key={member.user_id} className="bg-slate-800/50 rounded-lg p-2">
                        <div className="flex items-center gap-2 mb-1">
                          {member.picture ? (
                            <img src={member.picture} alt={member.name} className="w-5 h-5 rounded-full" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center">
                              <span className="text-[10px] text-white font-bold">{member.name?.charAt(0)}</span>
                            </div>
                          )}
                          <span className="text-[10px] text-white font-medium">{member.name}</span>
                          <span className="text-[10px] text-slate-400">({member.chores?.length || 0} pending)</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(member.chores || []).slice(0, 3).map(chore => (
                            <button
                              key={chore.chore_id}
                              onClick={() => {
                                if (user?.role === 'homehub') {
                                  setSelectedChore(chore);
                                  setPendingAction('completeChore');
                                  setShowPinVerify(true);
                                } else {
                                  handleCompleteChore(chore.chore_id);
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 bg-green-500/20 hover:bg-green-500/40 rounded-lg text-green-400 text-[10px] font-medium transition-all"
                            >
                              {user?.role === 'homehub' && <Lock className="w-2.5 h-2.5" />}
                              <CheckCircle className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[80px]">{chore.title}</span>
                              <span className="text-green-300">+{chore.points}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

      {/* Day Detail Popup */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
          <div className="glass-card rounded-2xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-white">
                  {selectedDay.fullDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h2>
                <p className="text-xs text-slate-400">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-1.5 hover:bg-slate-800 rounded-lg" data-testid="close-day-detail">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            {dayEvents.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No events scheduled</p>
                <button
                  onClick={() => { setSelectedDay(null); setShowAddEvent(true); setNewEvent({...newEvent, event_date: selectedDay.dateStr}); }}
                  className="mt-4 bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-full text-sm font-bold transition-all"
                >
                  Add Event
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {dayEvents.map(event => (
                  <div key={event.event_id} className={`p-3 rounded-xl border-l-4 bg-slate-800/50 ${
                    EVENT_TYPES[event.event_type]?.color?.replace('bg-', 'border-') || 'border-primary'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          {event.event_type === 'work_schedule' ? (
                            <Briefcase className={`w-4 h-4 ${EVENT_TYPES[event.event_type]?.textColor}`} />
                          ) : (
                            <CalendarDays className={`w-4 h-4 ${EVENT_TYPES[event.event_type]?.textColor}`} />
                          )}
                          <span className={`text-xs font-bold ${EVENT_TYPES[event.event_type]?.textColor}`}>
                            {EVENT_TYPES[event.event_type]?.label}
                          </span>
                        </div>
                        <h3 className="font-bold text-white">{event.title}</h3>
                        {event.event_type === 'work_schedule' && event.work_start_time && (
                          <p className="text-sm text-orange-400 mt-1">
                            {event.work_start_time} - {event.work_end_time}
                          </p>
                        )}
                        {event.event_time && event.event_type !== 'work_schedule' && (
                          <p className="text-sm text-slate-400 mt-1">{event.event_time}</p>
                        )}
                        {event.created_by_name && (
                          <p className="text-xs text-slate-500 mt-1">Added by {event.created_by_name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PIN Verification Modal */}
      <ProfilePinVerification
        isOpen={showPinVerify}
        onClose={() => {
          setShowPinVerify(false);
          setPendingAction(null);
          setSelectedChore(null);
        }}
        onVerified={(user) => {
          setVerifiedUser(user);
          toast.success(`Welcome, ${user.name}!`);
          // Execute pending action
          if (pendingAction === 'addEvent') {
            setShowAddEvent(true);
          } else if (pendingAction === 'addItem') {
            setShowAddItem(true);
          } else if (pendingAction === 'completeChore' && selectedChore) {
            handleCompleteChore(selectedChore.chore_id);
          }
          setPendingAction(null);
        }}
        actionLabel="Verify & Continue"
        title="Who's making this request?"
      />
    </div>
  );
}

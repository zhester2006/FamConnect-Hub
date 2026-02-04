import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Clock, Briefcase, CalendarDays, Star } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const EVENT_TYPES = {
  appointment: { label: 'Appointment', color: 'bg-green-500', icon: CalendarDays },
  event: { label: 'Event', color: 'bg-accent', icon: Star },
  work_schedule: { label: 'Work Schedule', color: 'bg-orange-500', icon: Briefcase },
  task: { label: 'Task', color: 'bg-purple-500', icon: Clock }
};

export default function Calendar({ user }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [dayPopupEvents, setDayPopupEvents] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    event_date: '',
    event_time: '09:00',
    event_type: 'appointment',
    work_start_time: '',
    work_end_time: ''
  });

  useEffect(() => {
    fetchEvents();
  }, [filterType]);

  const fetchEvents = async () => {
    try {
      let url = `${BACKEND_URL}/api/events`;
      if (filterType !== 'all') {
        url += `?event_type=${filterType}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    try {
      const eventData = {
        title: newEvent.title,
        event_date: newEvent.event_date,
        event_time: newEvent.event_time,
        event_type: newEvent.event_type
      };

      if (newEvent.event_type === 'work_schedule') {
        eventData.work_start_time = newEvent.work_start_time;
        eventData.work_end_time = newEvent.work_end_time;
        eventData.title = `${user.name}'s Work`;
      }

      await fetch(`${BACKEND_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(eventData)
      });
      toast.success('Event added!');
      setShowAddEvent(false);
      setNewEvent({ title: '', event_date: '', event_time: '09:00', event_type: 'appointment', work_start_time: '', work_end_time: '' });
      fetchEvents();
    } catch (error) {
      toast.error('Failed to add event');
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const getEventsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.event_date === dateStr);
  };

  const today = new Date();
  const isToday = (day) => day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

  const handleDayClick = (day) => {
    if (!day) return;
    setSelectedDate(day);
    const eventsForDay = getEventsForDay(day);
    setDayPopupEvents(eventsForDay);
    setShowDayPopup(true);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  return (
    <div className="flex h-screen relative">
      {/* Blue gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900/30 via-cyan-900/20 to-slate-950 pointer-events-none" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-blue-500/10 animate-float-slow"
            style={{
              width: Math.random() * 120 + 40,
              height: Math.random() * 120 + 40,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 18 + 12}s`
            }}
          />
        ))}
      </div>
      
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-y-auto transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-6 pb-24 md:pb-6 space-y-4" data-testid="calendar-page">
          {/* Header */}
          <header className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3">
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 hover:bg-slate-800 rounded-lg transition-all">
                <ChevronLeft className="w-5 h-5 text-slate-400" />
              </button>
              <h1 className="text-xl lg:text-2xl font-black text-white">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h1>
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 hover:bg-slate-800 rounded-lg transition-all">
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                data-testid="filter-type"
              >
                <option value="all">All Types</option>
                <option value="appointment">Appointments</option>
                <option value="event">Events</option>
                <option value="work_schedule">Work Schedules</option>
                <option value="task">Tasks</option>
              </select>
              <button
                onClick={() => { setShowAddEvent(true); setNewEvent({...newEvent, event_date: selectedDate ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}` : ''}); }}
                className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center space-x-2"
                data-testid="add-event-btn"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </header>

          {/* Event Type Legend */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(EVENT_TYPES).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-1.5 px-2 py-1 bg-slate-800/50 rounded-full">
                <div className={`w-2 h-2 rounded-full ${value.color}`} />
                <span className="text-xs text-slate-400">{value.label}</span>
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="glass-card rounded-2xl p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-center text-sm font-bold text-slate-500 py-2">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth().map((day, i) => {
                const dayEventsForCell = getEventsForDay(day);
                return (
                  <div
                    key={i}
                    onClick={() => day && handleDayClick(day)}
                    className={`min-h-[80px] p-1 rounded-lg transition-all cursor-pointer ${
                      day ? 'hover:bg-slate-800/50' : ''
                    } ${selectedDate === day ? 'bg-primary/20 border border-primary' : ''} ${
                      isToday(day) ? 'bg-accent/10 border border-accent' : ''
                    }`}
                  >
                    {day && (
                      <>
                        <span className={`text-sm font-bold ${isToday(day) ? 'text-accent' : 'text-white'}`}>{day}</span>
                        <div className="space-y-0.5 mt-1">
                          {dayEventsForCell.slice(0, 3).map(event => (
                            <div
                              key={event.event_id}
                              className={`text-[9px] px-1 py-0.5 rounded truncate text-white ${EVENT_TYPES[event.event_type]?.color || 'bg-primary'}`}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEventsForCell.length > 3 && (
                            <span className="text-[9px] text-slate-400">+{dayEventsForCell.length - 3} more</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Events */}
          {selectedDate && (
            <div className="glass-card rounded-2xl p-4">
              <h2 className="text-lg font-bold text-white mb-3">
                {monthNames[currentDate.getMonth()]} {selectedDate}, {currentDate.getFullYear()}
              </h2>
              {selectedDateEvents.length === 0 ? (
                <p className="text-slate-400 text-sm">No events on this day</p>
              ) : (
                <div className="space-y-2">
                  {selectedDateEvents.map(event => {
                    const EventIcon = EVENT_TYPES[event.event_type]?.icon || CalendarDays;
                    return (
                      <div key={event.event_id} className={`flex items-start space-x-3 p-3 rounded-xl border-l-4 ${EVENT_TYPES[event.event_type]?.color?.replace('bg-', 'border-') || 'border-primary'} bg-slate-800/50`}>
                        <EventIcon className={`w-5 h-5 mt-0.5 ${EVENT_TYPES[event.event_type]?.color?.replace('bg-', 'text-') || 'text-primary'}`} />
                        <div className="flex-1">
                          <h3 className="font-bold text-white">{event.title}</h3>
                          <p className="text-sm text-slate-400">{EVENT_TYPES[event.event_type]?.label}</p>
                          {event.event_type === 'work_schedule' && event.work_start_time && (
                            <p className="text-sm text-orange-400 mt-1">
                              {event.work_start_time} - {event.work_end_time}
                            </p>
                          )}
                          {event.event_time && event.event_type !== 'work_schedule' && (
                            <p className="text-sm text-slate-500 mt-1">{event.event_time}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">Added by {event.created_by_name}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-5 max-w-sm w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">Add Event</h2>
              <button onClick={() => setShowAddEvent(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddEvent} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Event Type *</label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({...newEvent, event_type: e.target.value})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm"
                  required
                  data-testid="event-type-select"
                >
                  <option value="appointment">Appointment</option>
                  <option value="event">Event</option>
                  <option value="work_schedule">Work Schedule</option>
                  <option value="task">Task</option>
                </select>
              </div>

              {newEvent.event_type !== 'work_schedule' && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Title *</label>
                  <input
                    type="text"
                    placeholder="Event title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 text-sm"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Date *</label>
                <input
                  type="date"
                  value={newEvent.event_date}
                  onChange={(e) => setNewEvent({...newEvent, event_date: e.target.value})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm"
                  required
                />
              </div>

              {newEvent.event_type === 'work_schedule' ? (
                <>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Start Time *</label>
                    <input
                      type="time"
                      value={newEvent.work_start_time}
                      onChange={(e) => setNewEvent({...newEvent, work_start_time: e.target.value})}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">End Time *</label>
                    <input
                      type="time"
                      value={newEvent.work_end_time}
                      onChange={(e) => setNewEvent({...newEvent, work_end_time: e.target.value})}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm"
                      required
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Time</label>
                  <input
                    type="time"
                    value={newEvent.event_time}
                    onChange={(e) => setNewEvent({...newEvent, event_time: e.target.value})}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm"
                  />
                </div>
              )}

              <button type="submit" className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-3 rounded-full transition-all">
                Add Event
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Day Detail Popup */}
      {showDayPopup && selectedDate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDayPopup(false)}>
          <div className="glass-card rounded-2xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-white">
                  {new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h2>
                <p className="text-xs text-slate-400">{dayPopupEvents.length} event{dayPopupEvents.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setShowDayPopup(false)} className="p-1.5 hover:bg-slate-800 rounded-lg" data-testid="close-day-popup">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            {dayPopupEvents.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No events scheduled</p>
                <button
                  onClick={() => { 
                    setShowDayPopup(false); 
                    setShowAddEvent(true); 
                    setNewEvent({...newEvent, event_date: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`}); 
                  }}
                  className="mt-4 bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-full text-sm font-bold transition-all"
                >
                  Add Event
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {dayPopupEvents.map(event => {
                  const EventIcon = EVENT_TYPES[event.event_type]?.icon || CalendarDays;
                  return (
                    <div key={event.event_id} className={`p-3 rounded-xl border-l-4 bg-slate-800/50 ${
                      EVENT_TYPES[event.event_type]?.color?.replace('bg-', 'border-') || 'border-primary'
                    }`}>
                      <div className="flex items-start space-x-3">
                        <EventIcon className={`w-5 h-5 mt-0.5 ${EVENT_TYPES[event.event_type]?.color?.replace('bg-', 'text-') || 'text-primary'}`} />
                        <div className="flex-1">
                          <p className={`text-xs font-bold ${EVENT_TYPES[event.event_type]?.color?.replace('bg-', 'text-')}`}>
                            {EVENT_TYPES[event.event_type]?.label}
                          </p>
                          <h3 className="font-bold text-white mt-0.5">{event.title}</h3>
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
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

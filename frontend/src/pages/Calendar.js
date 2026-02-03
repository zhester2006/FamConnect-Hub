import React, { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Calendar({ user }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [view, setView] = useState('month');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_date: '',
    event_type: 'appointment'
  });

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/events`, { credentials: 'include' });
        const data = await res.json();
        setEvents(data.events);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      }
    };
    
    fetchEvents();
  }, [currentDate]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/events`, { credentials: 'include' });
      const data = await res.json();
      setEvents(data.events);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  }, []);

  const handleAddEvent = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BACKEND_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newEvent)
      });
      setShowAddEvent(false);
      setNewEvent({ title: '', description: '', event_date: '', event_type: 'appointment' });
      fetchEvents();
    } catch (error) {
      console.error('Failed to add event:', error);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getEventsForDate = (day) => {
    if (!day) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.event_date === dateStr);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto lg:ml-72">
        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6" data-testid="calendar-page">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 className="text-2xl lg:text-3xl font-black text-white">Family Calendar</h1>
            <button
              onClick={() => setShowAddEvent(true)}
              className="bg-primary hover:bg-primary/80 active:scale-95 text-white p-3 lg:p-2 rounded-full transition-all neon-glow w-full sm:w-auto"
              data-testid="add-event-button"
            >
              <Plus className="w-5 h-5 lg:w-6 lg:h-6 mx-auto sm:mx-0" />
            </button>
          </header>

        <div className="glass-card rounded-2xl p-3 lg:p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
              className="p-2 hover:bg-white/5 rounded-lg transition-all"
              data-testid="prev-month-button"
            >
              <ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
            </button>
            <h2 className="text-lg lg:text-xl font-bold text-white">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
              className="p-2 hover:bg-white/5 rounded-lg transition-all"
              data-testid="next-month-button"
            >
              <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 lg:gap-2 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-xs font-bold text-slate-400">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 lg:gap-2">
            {getDaysInMonth(currentDate).map((day, index) => {
              const dayEvents = getEventsForDate(day);
              const isToday = day === new Date().getDate() && 
                currentDate.getMonth() === new Date().getMonth() && 
                currentDate.getFullYear() === new Date().getFullYear();
              
              return (
                <div
                  key={index}
                  className={`aspect-square rounded-lg p-1 lg:p-2 ${
                    day ? 'bg-slate-900/50 hover:bg-slate-800/50' : ''
                  } ${
                    isToday ? 'ring-2 ring-primary' : ''
                  } transition-all cursor-pointer`}
                  data-testid={`calendar-day-${day}`}
                >
                  {day && (
                    <>
                      <div className="text-xs lg:text-sm font-bold text-white mb-1">{day}</div>
                      {dayEvents.length > 0 && (
                        <div className="space-y-1">
                          {dayEvents.slice(0, 2).map(event => (
                            <div key={event.event_id} className="w-full h-0.5 lg:h-1 bg-accent rounded-full"></div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white">Upcoming Events</h3>
          {events.slice(0, 5).map(event => (
            <div key={event.event_id} className="glass-card rounded-2xl p-3 lg:p-4" data-testid="event-item">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white truncate">{event.title}</h4>
                  <p className="text-sm text-slate-400 mt-1 line-clamp-2">{event.description}</p>
                  <p className="text-xs text-accent mt-2">{new Date(event.event_date).toLocaleDateString()}</p>
                </div>
                <CalendarIcon className="w-5 h-5 text-secondary flex-shrink-0 ml-2" />
              </div>
            </div>
          ))}
        </div>
        </div>
      </main>

      {showAddEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 lg:p-6" data-testid="add-event-modal">
          <div className="glass-card rounded-3xl p-4 lg:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl lg:text-2xl font-black text-white mb-4">Add Event</h2>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <input
                type="text"
                placeholder="Event title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 text-base"
                required
                data-testid="event-title-input"
              />
              <textarea
                placeholder="Description (optional)"
                value={newEvent.description}
                onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 h-20 lg:h-24 resize-none text-base"
                data-testid="event-description-input"
              />
              <input
                type="date"
                value={newEvent.event_date}
                onChange={(e) => setNewEvent({...newEvent, event_date: e.target.value})}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white text-base"
                required
                data-testid="event-date-input"
              />
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/80 active:scale-95 text-white font-bold py-3 px-4 rounded-full transition-all"
                  data-testid="submit-event-button"
                >
                  Add Event
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddEvent(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold py-3 px-4 rounded-full transition-all"
                  data-testid="cancel-event-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <BottomNav userRole={user?.role} />
    </div>
  );
}
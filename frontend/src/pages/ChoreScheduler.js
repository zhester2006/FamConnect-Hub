import React, { useState, useEffect, useCallback } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, closestCorners, rectIntersection } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar as CalendarIcon, Users, GripVertical, Check, X, Plus, ArrowLeft, Sparkles, Save, Loader2, Trash2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Avatar } from '@/components/Avatar';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Draggable Chore Item Component
function DraggableChore({ chore, isOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chore.id,
    data: { type: 'chore', chore }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={isOverlay ? {} : style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg cursor-grab active:cursor-grabbing transition-all hover:border-primary/50 ${
        isOverlay ? 'shadow-xl scale-105 bg-slate-700' : ''
      } ${isDragging ? 'ring-2 ring-primary' : ''}`}
      data-testid={`chore-item-${chore.name?.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <GripVertical className="w-4 h-4 text-slate-500 flex-shrink-0" />
      <span className="text-white text-sm font-medium truncate flex-1">{chore.name}</span>
      <span className="text-accent text-xs font-bold bg-accent/10 px-2 py-0.5 rounded-full flex-shrink-0">
        {chore.points} pts
      </span>
    </div>
  );
}

// Droppable Day Column Component
function DroppableDay({ date, dayName, chores, onRemoveChore }) {
  const { setNodeRef, isOver } = useSortable({
    id: `day-${date}`,
    data: { type: 'day', date }
  });

  const isToday = new Date().toISOString().split('T')[0] === date;

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[140px] max-w-[180px] glass-card rounded-xl p-3 transition-all ${
        isOver ? 'ring-2 ring-primary bg-primary/10' : ''
      } ${isToday ? 'border-accent/50' : ''}`}
      data-testid={`day-column-${date}`}
    >
      <div className={`text-center mb-3 pb-2 border-b border-slate-700 ${isToday ? 'text-accent' : ''}`}>
        <p className="text-xs text-slate-400 uppercase">{dayName}</p>
        <p className={`font-bold ${isToday ? 'text-accent' : 'text-white'}`}>
          {new Date(date + 'T12:00:00').getDate()}
        </p>
      </div>
      <SortableContext items={chores.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[100px]">
          {chores.length === 0 ? (
            <div className="text-center py-4 border-2 border-dashed border-slate-700 rounded-lg">
              <p className="text-slate-500 text-xs">Drop chores here</p>
            </div>
          ) : (
            chores.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-slate-800/60 rounded-lg p-2 relative group"
                data-testid={`assigned-chore-${assignment.id}`}
              >
                <button
                  onClick={() => onRemoveChore(assignment.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  data-testid={`remove-chore-${assignment.id}`}
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <p className="text-white text-xs font-medium truncate">{assignment.choreName}</p>
                <p className="text-primary text-[10px] truncate">{assignment.childName}</p>
              </div>
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Droppable Child Row Component
function DroppableChild({ child, chores, onRemoveChore }) {
  const { setNodeRef, isOver } = useSortable({
    id: `child-${child.user_id}`,
    data: { type: 'child', child }
  });

  return (
    <div
      ref={setNodeRef}
      className={`glass-card rounded-xl p-4 transition-all ${
        isOver ? 'ring-2 ring-secondary bg-secondary/10' : ''
      }`}
      data-testid={`child-row-${child.user_id}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={child.name} picture={child.picture} size="md" />
        <div>
          <h3 className="font-bold text-white">{child.nickname || child.name}</h3>
          <p className="text-xs text-slate-400">{chores.length} chores assigned</p>
        </div>
      </div>
      <SortableContext items={chores.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-wrap gap-2 min-h-[60px] p-2 border-2 border-dashed border-slate-700 rounded-lg">
          {chores.length === 0 ? (
            <p className="text-slate-500 text-xs m-auto">Drop chores here</p>
          ) : (
            chores.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-slate-800/60 rounded-lg px-3 py-1.5 flex items-center gap-2 relative group"
                data-testid={`child-chore-${assignment.id}`}
              >
                <span className="text-white text-xs font-medium">{assignment.choreName}</span>
                <span className="text-slate-400 text-[10px]">{assignment.date}</span>
                <button
                  onClick={() => onRemoveChore(assignment.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-2 h-2 text-white" />
                </button>
              </div>
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function ChoreScheduler({ user }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'children'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [choreTypes, setChoreTypes] = useState([]);
  const [children, setChildren] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [activeDragData, setActiveDragData] = useState(null);

  // Generate week dates (7 days starting today)
  const getWeekDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' })
      });
    }
    return dates;
  };

  const weekDates = getWeekDates();

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [typesRes, membersRes, choresRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/chores/types`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/family/members`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/chores`, { credentials: 'include' })
      ]);

      const typesData = await typesRes.json();
      const membersData = await membersRes.json();
      const choresData = await choresRes.json();

      // Format chore types for drag and drop
      const formattedTypes = (typesData.chore_types || []).map((ct, i) => ({
        id: `type-${ct.name?.replace(/\s+/g, '-').toLowerCase() || i}`,
        name: ct.name,
        points: ct.points || 10,
        description: ct.description
      }));

      setChoreTypes(formattedTypes);
      setChildren((membersData.members || []).filter(m => m.role === 'child'));
      
      // Convert existing chores to assignments format
      const existingAssignments = (choresData.chores || [])
        .filter(c => c.scheduled_date && c.assigned_to)
        .map(c => ({
          id: c.chore_id,
          choreId: c.chore_id,
          choreName: c.title,
          childId: c.assigned_to,
          childName: (membersData.members || []).find(m => m.user_id === c.assigned_to)?.name || 'Unknown',
          date: c.scheduled_date,
          points: c.points || 10
        }));
      
      setAssignments(existingAssignments);

      // Set default selected child
      const kids = (membersData.members || []).filter(m => m.role === 'child');
      if (kids.length > 0) {
        setSelectedChild(kids[0].user_id);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load chore data');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = useCallback((event) => {
    const { active } = event;
    setActiveId(active.id);
    setActiveDragData(active.data.current);
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Only handle dragging chore types to destinations
    if (activeData?.type !== 'chore') return;

    const chore = activeData.chore;
    let targetDate = null;
    let targetChildId = null;
    let targetChildName = null;

    // Determine target based on drop zone
    if (overData?.type === 'day') {
      targetDate = overData.date;
      targetChildId = selectedChild;
      targetChildName = children.find(c => c.user_id === selectedChild)?.name || 'Unknown';
    } else if (overData?.type === 'child') {
      targetDate = weekDates[0].date; // Default to today if dropping on child
      targetChildId = overData.child.user_id;
      targetChildName = overData.child.name;
    } else {
      return;
    }

    if (!targetChildId) {
      toast.error('Please select a child first');
      return;
    }

    // Create new assignment
    const newAssignment = {
      id: `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      choreId: chore.id,
      choreName: chore.name,
      childId: targetChildId,
      childName: targetChildName,
      date: targetDate,
      points: chore.points
    };

    setAssignments(prev => [...prev, newAssignment]);
    toast.success(`Assigned "${chore.name}" to ${targetChildName}`);
  }, [selectedChild, children, weekDates]);

  const handleRemoveAssignment = useCallback((assignmentId) => {
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    toast.info('Chore assignment removed');
  }, []);

  const handleSaveSchedule = async () => {
    setSaving(true);
    try {
      // Create chores from assignments
      const createPromises = assignments
        .filter(a => a.id.startsWith('assignment-')) // Only new assignments
        .map(async (assignment) => {
          const response = await fetch(`${BACKEND_URL}/api/chores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              title: assignment.choreName,
              assigned_to: assignment.childId,
              scheduled_date: assignment.date,
              points: assignment.points,
              recurring: false
            })
          });
          return response.json();
        });

      await Promise.all(createPromises);
      toast.success('Schedule saved successfully!');
      
      // Refresh data to get server-generated IDs
      await fetchData();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleClearSchedule = () => {
    setAssignments([]);
    toast.info('Schedule cleared');
  };

  // Get assignments for a specific day and child (in calendar view)
  const getDayAssignments = (date) => {
    return assignments.filter(a => a.date === date && a.childId === selectedChild);
  };

  // Get assignments for a specific child (in children view)
  const getChildAssignments = (childId) => {
    return assignments.filter(a => a.childId === childId);
  };

  const draggedChore = activeId && choreTypes.find(c => c.id === activeId);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-purple-900/30 via-indigo-900/20 to-slate-950">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen relative">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-900/20 via-teal-900/15 to-slate-950 pointer-events-none" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-teal-500/10 animate-float-slow"
            style={{
              width: Math.random() * 80 + 30,
              height: Math.random() * 80 + 30,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 15 + 15}s`
            }}
          />
        ))}
      </div>

      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      <main className={`flex-1 overflow-y-auto transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="p-4 pt-16 md:pt-4 lg:p-6 lg:pt-6 pb-24 md:pb-6 space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/parent')}
                className="p-2 rounded-lg hover:bg-slate-800 transition-all"
                data-testid="back-button"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl lg:text-2xl font-black text-white">Chore Scheduler</h1>
                <p className="text-sm text-slate-400">Drag and drop to assign chores</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearSchedule}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 text-sm font-medium transition-all"
                data-testid="clear-schedule-btn"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
              <button
                onClick={handleSaveSchedule}
                disabled={saving || assignments.filter(a => a.id.startsWith('assignment-')).length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white text-sm font-bold transition-all"
                data-testid="save-schedule-btn"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="hidden sm:inline">Save Schedule</span>
              </button>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-xl w-fit">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'calendar' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'
              }`}
              data-testid="calendar-view-btn"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Calendar View</span>
            </button>
            <button
              onClick={() => setViewMode('children')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'children' ? 'bg-secondary text-white' : 'text-slate-400 hover:text-white'
              }`}
              data-testid="children-view-btn"
            >
              <Users className="w-4 h-4" />
              <span>By Children</span>
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid lg:grid-cols-[280px_1fr] gap-4">
              {/* Chore Types Panel */}
              <div className="glass-card rounded-xl p-4">
                <h2 className="font-bold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  Available Chores
                </h2>
                <SortableContext items={choreTypes.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                    {choreTypes.map((chore) => (
                      <DraggableChore key={chore.id} chore={chore} />
                    ))}
                  </div>
                </SortableContext>
              </div>

              {/* Main Schedule Area */}
              <div className="space-y-4">
                {viewMode === 'calendar' ? (
                  <>
                    {/* Child Selector for Calendar View */}
                    {children.length > 0 && (
                      <div className="glass-card rounded-xl p-4">
                        <label className="text-sm text-slate-400 mb-2 block">Scheduling for:</label>
                        <div className="flex flex-wrap gap-2">
                          {children.map(child => (
                            <button
                              key={child.user_id}
                              onClick={() => setSelectedChild(child.user_id)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                selectedChild === child.user_id
                                  ? 'bg-primary text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                              data-testid={`select-child-${child.user_id}`}
                            >
                              <Avatar name={child.name} picture={child.picture} size="xs" />
                              {child.nickname || child.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Week Calendar */}
                    <div className="glass-card rounded-xl p-4 overflow-x-auto">
                      <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        This Week
                      </h2>
                      <div className="flex gap-3 min-w-max pb-2">
                        {weekDates.map(({ date, dayName }) => (
                          <DroppableDay
                            key={date}
                            date={date}
                            dayName={dayName}
                            chores={getDayAssignments(date)}
                            onRemoveChore={handleRemoveAssignment}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Children View */
                  <div className="space-y-4">
                    {children.length === 0 ? (
                      <div className="glass-card rounded-xl p-8 text-center">
                        <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No children in your family yet.</p>
                        <p className="text-sm text-slate-500 mt-1">Add children from Settings to start scheduling.</p>
                      </div>
                    ) : (
                      children.map(child => (
                        <DroppableChild
                          key={child.user_id}
                          child={child}
                          chores={getChildAssignments(child.user_id)}
                          onRemoveChore={handleRemoveAssignment}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
              {draggedChore && <DraggableChore chore={draggedChore} isOverlay />}
            </DragOverlay>
          </DndContext>

          {/* Help Text */}
          <div className="glass-card rounded-xl p-4 border-dashed border-2 border-slate-700">
            <p className="text-sm text-slate-400">
              <strong className="text-white">How it works:</strong> Drag chores from the left panel and drop them onto either a day (in Calendar View) or directly onto a child (in Children View). Click the X to remove an assignment. When you&apos;re done, click Save Schedule to create the chores.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

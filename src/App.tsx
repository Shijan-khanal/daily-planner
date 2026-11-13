import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  ListTodo,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  SunMedium,
  Upload,
  X,
} from 'lucide-react';
import type { AppData, AppSettings, NavKey, Priority, Task, TaskStatus, ThemeMode } from './types';
import { defaultAppData, loadAppData, saveAppData } from './storage';

type DraftTask = {
  title: string;
  description: string;
  notes: string;
  dueDate: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  priority: Priority;
  color: string;
  status: TaskStatus;
  listId: string;
  labels: string;
  checklist: { id: string; text: string; checked: boolean }[];
};

const navItems: { key: NavKey; label: string; icon: typeof Inbox }[] = [
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'today', label: 'Today', icon: CalendarDays },
  { key: 'upcoming', label: 'Upcoming', icon: ListTodo },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'tasks', label: 'Tasks', icon: CheckCheck },
  { key: 'lists', label: 'Lists', icon: ListTodo },
  { key: 'productivity', label: 'Productivity', icon: Sparkles },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const priorityColors: Record<Priority, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
};

const defaultDraft = (listId = 'list-work', selectedDate = new Date()): DraftTask => ({
  title: '',
  description: '',
  notes: '',
  dueDate: format(selectedDate, 'yyyy-MM-dd'),
  scheduledDate: format(selectedDate, 'yyyy-MM-dd'),
  startTime: '',
  endTime: '',
  priority: 'medium',
  color: '',
  status: 'not-started',
  listId,
  labels: '',
  checklist: [],
});

function App() {
  const [appData, setAppData] = useState<AppData>(defaultAppData());
  const [selectedView, setSelectedView] = useState<NavKey>('inbox');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftTask>(defaultDraft());
  const [loaded, setLoaded] = useState(false);
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    void loadAppData().then((loadedData) => {
      setAppData(loadedData);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    void saveAppData(appData);
  }, [appData, loaded]);

  useEffect(() => {
    const theme = appData.settings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : appData.settings.theme;
    document.documentElement.dataset.theme = theme;
  }, [appData.settings.theme]);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const searchInput = document.getElementById('global-search');
        searchInput?.focus();
      }
      if (event.key.toLowerCase() === 'n' && !['INPUT', 'TEXTAREA'].includes(activeTag ?? '')) {
        event.preventDefault();
        openTaskEditor();
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, []);

  const listMap = useMemo(
    () => new Map(appData.lists.map((list) => [list.id, list])),
    [appData.lists],
  );

  const tasksByStatus = useMemo(() => {
    const safe = appData.tasks.filter((task) => task.status !== 'archived');
    return {
      total: safe.length,
      complete: safe.filter((task) => task.status === 'completed').length,
      active: safe.filter((task) => task.status !== 'completed').length,
      overdue: safe.filter((task) => task.dueDate && task.dueDate < format(new Date(), 'yyyy-MM-dd') && task.status !== 'completed').length,
    };
  }, [appData.tasks]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return appData.tasks.filter((task) => {
      if (!query) {
        return true;
      }
      const target = `${task.title} ${task.description} ${task.notes} ${task.labels.join(' ')} ${task.status}`.toLowerCase();
      return target.includes(query);
    });
  }, [search, appData.tasks]);

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const openTaskEditor = (task?: Task) => {
    if (task) {
      setEditingTaskId(task.id);
      setDraft({
        title: task.title,
        description: task.description,
        notes: task.notes,
        dueDate: task.dueDate ?? '',
        scheduledDate: task.scheduledDate ?? '',
        startTime: task.startTime ?? '',
        endTime: task.endTime ?? '',
        priority: task.priority,
        color: task.color ?? '',
        status: task.status,
        listId: task.listId,
        labels: task.labels.join(', '),
        checklist: task.checklist,
      });
    } else {
      setEditingTaskId(null);
      setDraft(defaultDraft(appData.lists[0]?.id, selectedDate));
    }
    setTaskEditorOpen(true);
  };

  const closeTaskEditor = () => {
    setTaskEditorOpen(false);
    setEditingTaskId(null);
    setDraft(defaultDraft(appData.lists[0]?.id, selectedDate));
  };

  const saveTask = () => {
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) {
      return;
    }

    const iso = new Date().toISOString();
    const labels = draft.labels
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean);

    const taskPayload: Task = {
      id: editingTaskId ?? `task-${Date.now()}`,
      title: trimmedTitle,
      description: draft.description.trim(),
      notes: draft.notes.trim(),
      dueDate: draft.dueDate || null,
      scheduledDate: draft.scheduledDate || null,
      startTime: draft.startTime || null,
      endTime: draft.endTime || null,
      priority: draft.priority,
      color: draft.color || undefined,
      status: draft.status,
      listId: draft.listId,
      labels,
      checklist: draft.checklist.filter((item) => item.text.trim()),
      createdAt: editingTaskId ? appData.tasks.find((task) => task.id === editingTaskId)?.createdAt ?? iso : iso,
      updatedAt: iso,
    };

    setAppData((current) => {
      if (editingTaskId) {
        return {
          ...current,
          tasks: current.tasks.map((task) => (task.id === editingTaskId ? taskPayload : task)),
        };
      }
      return {
        ...current,
        tasks: [taskPayload, ...current.tasks],
      };
    });

    closeTaskEditor();
  };

  const addQuickTask = () => {
    const title = quickTitle.trim();
    if (!title) {
      return;
    }

    const iso = new Date().toISOString();
    const task: Task = {
      id: `task-${Date.now()}`,
      title,
      description: '',
      notes: '',
      dueDate: null,
      scheduledDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null,
      startTime: null,
      endTime: null,
      priority: 'medium',
      status: 'not-started',
      listId: appData.lists[0]?.id ?? 'list-work',
      labels: [],
      checklist: [],
      createdAt: iso,
      updatedAt: iso,
    };

    setAppData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
    setQuickTitle('');
  };

  const toggleTaskComplete = (taskId: string) => {
    setAppData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }
        const nextStatus: TaskStatus = task.status === 'completed' ? 'not-started' : 'completed';
        return { ...task, status: nextStatus, updatedAt: new Date().toISOString() };
      }),
    }));
  };

  const deleteTask = (taskId: string) => {
    setAppData((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setAppData((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }));
  };

  const exportBackup = () => {
    const serialized = JSON.stringify(appData, null, 2);
    const blob = new Blob([serialized], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'planner-backup.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<AppData>;
    const nextData: AppData = {
      tasks: parsed.tasks ?? [],
      lists: parsed.lists ?? defaultAppData().lists,
      calendarEvents: parsed.calendarEvents ?? [],
      settings: {
        ...defaultAppData().settings,
        ...(parsed.settings ?? {}),
      },
    };

    setAppData(nextData);
    event.target.value = '';
  };

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: appData.settings.firstDayOfWeek === 'monday' ? 1 : 0 });
    return eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: appData.settings.firstDayOfWeek === 'monday' ? 1 : 0 }) });
  }, [selectedDate, appData.settings.firstDayOfWeek]);

  const monthGrid = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: appData.settings.firstDayOfWeek === 'monday' ? 1 : 0 });
    const monthEnd = endOfMonth(selectedDate);
    return eachDayOfInterval({
      start: gridStart,
      end: endOfWeek(monthEnd, { weekStartsOn: appData.settings.firstDayOfWeek === 'monday' ? 1 : 0 }),
    });
  }, [selectedDate, appData.settings.firstDayOfWeek]);

  const renderTaskCard = (task: Task) => {
    const list = listMap.get(task.listId);
    const isDone = task.status === 'completed';
    const taskColor = task.color || priorityColors[task.priority];

    return (
      <div key={task.id} className={`task-card ${isDone ? 'task-card--done' : ''}`} style={{ borderLeftColor: taskColor }}>
        <div className="task-card__main">
          <button type="button" className="task-check" aria-label="Toggle task complete" onClick={() => toggleTaskComplete(task.id)}>
            {isDone ? <Check size={12} /> : null}
          </button>
          <div className="task-card__content">
            <div className="task-card__title-row">
              <span className="task-title">{task.title}</span>
              <span className="priority-pill" style={{ backgroundColor: `${taskColor}20`, color: taskColor }}>
                {task.priority}
              </span>
            </div>
            {task.description ? <p className="task-description">{task.description}</p> : null}
            <div className="task-meta">
              {list ? <span className="meta-badge">{list.name}</span> : null}
              {task.dueDate ? <span className="meta-badge">Due {task.dueDate}</span> : null}
              {task.scheduledDate ? <span className="meta-badge">Scheduled {task.scheduledDate}</span> : null}
              {task.startTime ? <span className="meta-badge">{task.startTime}</span> : null}
            </div>
            {task.labels.length ? (
              <div className="label-row">
                {task.labels.map((label) => (
                  <span className="label-pill" key={`${task.id}-${label}`}>{label}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="task-card__actions">
          <button type="button" onClick={() => openTaskEditor(task)} className="ghost-button">Edit</button>
          <button type="button" onClick={() => deleteTask(task.id)} className="ghost-button ghost-button--danger">Delete</button>
        </div>
      </div>
    );
  };

  const renderCalendarLayout = () => {
    if (calendarView === 'month') {
      return (
        <div className="month-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
            <div key={dayName} className="month-grid__header">{dayName}</div>
          ))}
          {monthGrid.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayTasks = appData.tasks.filter((task) => task.scheduledDate === dateKey && task.status !== 'archived');
            const dayEvents = appData.calendarEvents.filter((event) => event.date === dateKey);
            return (
              <button type="button" key={dateKey} className={`month-cell ${isToday(date) ? 'month-cell--today' : ''}`} onClick={() => setSelectedDate(date)}>
                <span className="month-cell__day">{format(date, 'd')}</span>
                <div className="month-cell__items">
                  {dayTasks.slice(0, 2).map((task) => (
                    <span key={task.id} className="mini-tag" style={{ background: `${task.color || priorityColors[task.priority]}22`, color: task.color || priorityColors[task.priority] }}>{task.title}</span>
                  ))}
                  {dayEvents.slice(0, 1).map((event) => (
                    <span key={event.id} className="mini-tag mini-tag--event" style={{ background: `${event.color}22`, color: event.color }}>{event.title}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="week-grid">
        {weekDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = visibleTasks.filter((task) => task.scheduledDate === dateKey && task.status !== 'archived');
          const dayEvents = appData.calendarEvents.filter((event) => event.date === dateKey);

          return (
            <div key={dateKey} className={`week-column ${isToday(day) ? 'week-column--today' : ''}`}>
              <div className="week-column__header">
                <span>{format(day, 'EEE')}</span>
                <strong>{format(day, 'd')}</strong>
              </div>
              {dayEvents.map((event) => (
                <div key={event.id} className="calendar-event" style={{ backgroundColor: `${event.color}20`, borderLeftColor: event.color }}>
                  <span>{event.title}</span>
                  <small>{event.start} - {event.end}</small>
                </div>
              ))}
              {dayTasks.length ? (
                <div className="week-column__tasks">
                  {dayTasks.map((task) => renderTaskCard(task))}
                </div>
              ) : (
                <button type="button" className="empty-day" onClick={() => openTaskEditor()}>+ Add task</button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">P</div>
          <div>
            <h1>Planner</h1>
            <small>Personal flow</small>
          </div>
        </div>

        <nav className="nav">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              type="button"
              key={key}
              className={`nav-item ${selectedView === key ? 'nav-item--active' : ''}`}
              onClick={() => setSelectedView(key)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <div className="sidebar-card__header">
            <Bell size={14} />
            <span>Focus</span>
          </div>
          <strong>{tasksByStatus.active}</strong>
          <small>open tasks</small>
        </div>
      </aside>

      <main className="content-shell">
        <header className="topbar">
          <div className="topbar__search">
            <Search size={16} />
            <input
              id="global-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks, notes, labels..."
            />
          </div>
          <div className="topbar__actions">
            <button type="button" className="icon-button" aria-label="Theme toggle" onClick={() => updateSetting('theme', appData.settings.theme === 'dark' ? 'light' : 'dark')}>
              {appData.settings.theme === 'dark' ? <SunMedium size={16} /> : <Moon size={16} />}
            </button>
            <button type="button" className="primary-button" onClick={() => openTaskEditor()}>
              <Plus size={16} />
              New task
            </button>
          </div>
        </header>

        {showShortcuts ? (
          <div className="shortcut-panel">
            <div className="shortcut-panel__header">
              <h3>Keyboard shortcuts</h3>
              <button type="button" className="icon-button" onClick={() => setShowShortcuts(false)}><X size={14} /></button>
            </div>
            <div className="shortcut-grid">
              <div><kbd>Ctrl/Cmd + K</kbd><span>Focus search</span></div>
              <div><kbd>N</kbd><span>Create task</span></div>
              <div><kbd>Esc</kbd><span>Close panels</span></div>
            </div>
          </div>
        ) : null}

        <section className="page-header">
          <div>
            <h2>
              {selectedView === 'inbox' && 'Inbox'}
              {selectedView === 'today' && 'Today'}
              {selectedView === 'upcoming' && 'Upcoming'}
              {selectedView === 'calendar' && 'Calendar'}
              {selectedView === 'tasks' && 'Tasks'}
              {selectedView === 'lists' && 'Lists'}
              {selectedView === 'productivity' && 'Productivity'}
              {selectedView === 'settings' && 'Settings'}
            </h2>
            <p>
              {selectedView === 'inbox' && 'Capture everything that needs attention without slowing down.'}
              {selectedView === 'today' && `Focus on ${format(new Date(), 'EEEE, MMM d')}.`}
              {selectedView === 'upcoming' && 'Plan ahead and keep the week in motion.'}
              {selectedView === 'calendar' && 'See your schedule, tasks, and time blocks together.'}
              {selectedView === 'tasks' && 'Everything in one complete list.'}
              {selectedView === 'lists' && 'Organize life by projects, categories, and routines.'}
              {selectedView === 'productivity' && 'Track momentum, progress, and completion.'}
              {selectedView === 'settings' && 'Adjust the planner to match your rhythm.'}
            </p>
          </div>
          {selectedView === 'calendar' ? (
            <div className="date-controls">
              <button type="button" className="nav-button" onClick={() => setSelectedDate((value) => addWeeks(value, -1))}><ChevronLeft size={16} /></button>
              <button type="button" className="ghost-button" onClick={() => setSelectedDate(new Date())}>This week</button>
              <button type="button" className="nav-button" onClick={() => setSelectedDate((value) => addWeeks(value, 1))}><ChevronRight size={16} /></button>
              <div className="segmented-control">
                <button type="button" className={calendarView === 'week' ? 'active' : ''} onClick={() => setCalendarView('week')}>Week</button>
                <button type="button" className={calendarView === 'month' ? 'active' : ''} onClick={() => setCalendarView('month')}>Month</button>
              </div>
            </div>
          ) : null}
        </section>

        {selectedView === 'inbox' ? (
          <div className="panel panel--padded">
            <div className="quick-add">
              <input
                type="text"
                value={quickTitle}
                onChange={(event) => setQuickTitle(event.target.value)}
                placeholder="Capture a quick task..."
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    addQuickTask();
                  }
                }}
              />
              <button type="button" className="primary-button" onClick={addQuickTask}>Add</button>
            </div>
            <div className="task-list">
              {visibleTasks.filter((task) => task.status !== 'completed' && task.status !== 'archived').slice(0, 8).map((task) => renderTaskCard(task))}
            </div>
          </div>
        ) : null}

        {selectedView === 'today' ? (
          <div className="dashboard-grid">
            <div className="panel panel--padded stat-panel">
              <div>
                <small>Today</small>
                <h3>{format(new Date(), 'EEEE, MMM d')}</h3>
              </div>
              <div className="ring" style={{ ['--ratio' as string]: `${tasksByStatus.complete || 1}` }}>
                <span>{Math.round((tasksByStatus.complete / Math.max(tasksByStatus.total, 1)) * 100)}%</span>
              </div>
            </div>
            <div className="panel panel--padded">
              <h3>Due today</h3>
              <div className="task-list compact-list">
                {appData.tasks.filter((task) => task.scheduledDate === todayKey || task.dueDate === todayKey).map((task) => renderTaskCard(task))}
              </div>
            </div>
          </div>
        ) : null}

        {selectedView === 'upcoming' ? (
          <div className="panel panel--padded">
            <div className="date-controls date-controls--inline">
              <button type="button" className="nav-button" onClick={() => setSelectedDate((value) => addDays(value, -1))}><ChevronLeft size={16} /></button>
              <span>{format(selectedDate, 'MMMM yyyy')}</span>
              <button type="button" className="nav-button" onClick={() => setSelectedDate((value) => addDays(value, 1))}><ChevronRight size={16} /></button>
            </div>
            {Array.from({ length: 5 }).map((_, index) => {
              const date = addDays(new Date(), index + 1);
              const dateKey = format(date, 'yyyy-MM-dd');
              const tasks = appData.tasks.filter((task) => task.scheduledDate === dateKey || task.dueDate === dateKey);
              return (
                <div key={dateKey} className="upcoming-day">
                  <h4>{format(date, 'EEEE, MMM d')}</h4>
                  {tasks.length ? <div className="task-list compact-list">{tasks.map((task) => renderTaskCard(task))}</div> : <p className="empty-state">No tasks scheduled</p>}
                </div>
              );
            })}
          </div>
        ) : null}

        {selectedView === 'calendar' ? (
          <div className="panel panel--padded">
            {renderCalendarLayout()}
          </div>
        ) : null}

        {selectedView === 'tasks' ? (
          <div className="panel panel--padded">
            <div className="task-list">
              {visibleTasks.map((task) => renderTaskCard(task))}
            </div>
          </div>
        ) : null}

        {selectedView === 'lists' ? (
          <div className="list-grid">
            {appData.lists.map((list) => (
              <div key={list.id} className="panel panel--padded">
                <div className="list-header" style={{ borderColor: list.color }}>
                  <span className="color-dot" style={{ backgroundColor: list.color }} />
                  <h3>{list.name}</h3>
                </div>
                <div className="task-list compact-list">
                  {appData.tasks.filter((task) => task.listId === list.id).slice(0, 5).map((task) => renderTaskCard(task))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {selectedView === 'productivity' ? (
          <div className="stats-grid">
            <div className="panel panel--padded">
              <small>Total tasks</small>
              <h3>{tasksByStatus.total}</h3>
            </div>
            <div className="panel panel--padded">
              <small>Completed</small>
              <h3>{tasksByStatus.complete}</h3>
            </div>
            <div className="panel panel--padded">
              <small>Overdue</small>
              <h3>{tasksByStatus.overdue}</h3>
            </div>
            <div className="panel panel--padded">
              <small>Open</small>
              <h3>{tasksByStatus.active}</h3>
            </div>
            <div className="panel panel--padded stats-panel__wide">
              <h3>Completion trend</h3>
              <div className="bars">
                {Array.from({ length: 6 }).map((_, index) => {
                  const height = 25 + ((index * 11) % 55);
                  return <span key={index} style={{ height: `${height}%` }} />;
                })}
              </div>
            </div>
          </div>
        ) : null}

        {selectedView === 'settings' ? (
          <div className="settings-grid">
            <div className="panel panel--padded">
              <h3>Appearance</h3>
              <div className="settings-row">
                <label>Theme</label>
                <select value={appData.settings.theme} onChange={(event) => updateSetting('theme', event.target.value as ThemeMode)}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div className="settings-row">
                <label>First day of week</label>
                <select value={appData.settings.firstDayOfWeek} onChange={(event) => updateSetting('firstDayOfWeek', event.target.value as AppSettings['firstDayOfWeek'])}>
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>
            </div>

            <div className="panel panel--padded">
              <h3>Planning</h3>
              <div className="settings-row">
                <label>Default calendar view</label>
                <select value={appData.settings.defaultCalendarView} onChange={(event) => updateSetting('defaultCalendarView', event.target.value as AppSettings['defaultCalendarView'])}>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>
              <div className="settings-row">
                <label>Default task duration (min)</label>
                <input type="number" value={appData.settings.defaultTaskDuration} onChange={(event) => updateSetting('defaultTaskDuration', Number(event.target.value))} />
              </div>
            </div>

            <div className="panel panel--padded">
              <h3>Data</h3>
              <div className="settings-actions">
                <button type="button" className="primary-button" onClick={exportBackup}><Download size={15} /> Export</button>
                <label className="primary-button upload-button">
                  <Upload size={15} /> Import
                  <input type="file" accept="application/json" onChange={importBackup} />
                </label>
              </div>
            </div>

            <div className="panel panel--padded">
              <h3>Shortcuts</h3>
              <button type="button" className="ghost-button" onClick={() => setShowShortcuts(true)}>View shortcuts</button>
            </div>
          </div>
        ) : null}
      </main>

      {taskEditorOpen ? (
        <div className="modal-backdrop" onClick={closeTaskEditor}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h3>{editingTaskId ? 'Edit task' : 'Create task'}</h3>
              <button type="button" className="icon-button" onClick={closeTaskEditor}><X size={16} /></button>
            </div>
            <div className="form-grid">
              <label>
                <span>Title</span>
                <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label>
                <span>List</span>
                <select value={draft.listId} onChange={(event) => setDraft((current) => ({ ...current, listId: event.target.value }))}>
                  {appData.lists.map((list) => (
                    <option key={list.id} value={list.id}>{list.name}</option>
                  ))}
                </select>
              </label>
              <label className="full-width">
                <span>Description</span>
                <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <label className="full-width">
                <span>Notes</span>
                <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
              </label>
              <label>
                <span>Due date</span>
                <input type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} />
              </label>
              <label>
                <span>Scheduled</span>
                <input type="date" value={draft.scheduledDate} onChange={(event) => setDraft((current) => ({ ...current, scheduledDate: event.target.value }))} />
              </label>
              <label>
                <span>Start time</span>
                <input type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} />
              </label>
              <label>
                <span>End time</span>
                <input type="time" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} />
              </label>
              <label>
                <span>Priority</span>
                <select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as Priority }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label>
                <span>Task color</span>
                <div className="task-color-control">
                  <input
                    aria-label="Custom task color"
                    type="color"
                    value={draft.color || priorityColors[draft.priority]}
                    onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
                  />
                  <span>{draft.color ? 'Custom color' : `Priority color (${draft.priority})`}</span>
                  {draft.color ? (
                    <button type="button" className="ghost-button" onClick={() => setDraft((current) => ({ ...current, color: '' }))}>
                      Use priority
                    </button>
                  ) : null}
                </div>
              </label>
              <label>
                <span>Status</span>
                <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as TaskStatus }))}>
                  <option value="not-started">Not started</option>
                  <option value="in-progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="full-width">
                <span>Labels</span>
                <input value={draft.labels} onChange={(event) => setDraft((current) => ({ ...current, labels: event.target.value }))} placeholder="work, university, focus" />
              </label>
              <div className="full-width checklist-box">
                <span>Checklist</span>
                {draft.checklist.length ? (
                  draft.checklist.map((item) => (
                    <div key={item.id} className="checklist-item">
                      <input type="checkbox" checked={item.checked} onChange={() => setDraft((current) => ({ ...current, checklist: current.checklist.map((entry) => entry.id === item.id ? { ...entry, checked: !entry.checked } : entry) }))} />
                      <input value={item.text} onChange={(event) => setDraft((current) => ({ ...current, checklist: current.checklist.map((entry) => entry.id === item.id ? { ...entry, text: event.target.value } : entry) }))} />
                    </div>
                  ))
                ) : <p className="empty-state">No checklist items yet.</p>}
                <button type="button" className="ghost-button" onClick={() => setDraft((current) => ({ ...current, checklist: [...current.checklist, { id: `check-${Date.now()}`, text: '', checked: false }] }))}>Add item</button>
              </div>
            </div>

            <div className="modal__footer">
              <button type="button" className="ghost-button" onClick={closeTaskEditor}>Cancel</button>
              <button type="button" className="primary-button" onClick={saveTask}>Save task</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;

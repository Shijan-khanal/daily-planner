import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
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
  ChevronLeft,
  ChevronRight,
  Download,
  ListTodo,
  MoreHorizontal,
  Moon,
  Plus,
  Search,
  Settings,
  SunMedium,
  Upload,
  X,
} from 'lucide-react';
import type { AppData, AppSettings, NavKey, Priority, Subject, Task, TaskStatus, ThemeMode } from './types';
import { defaultAppData, loadAppData, normalizeTask, saveAppData } from './storage';

type DraftTask = {
  title: string;
  priority: Priority;
  status: TaskStatus;
  label: string;
  description: string;
};

const navItems: { key: NavKey; label: string; icon: typeof CalendarDays }[] = [
  { key: 'today', label: 'Today', icon: CalendarDays },
  { key: 'upcoming', label: 'Upcoming', icon: ListTodo },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const priorityColors: Record<Priority, string> = {
  low: '#8791a3',
  medium: '#f59e0b',
  high: '#e35d6a',
  urgent: '#ef4444',
};

const defaultDraft = (): DraftTask => ({
  title: '',
  priority: 'medium',
  status: 'not-started',
  label: 'Other',
  description: '',
});

function App() {
  const [appData, setAppData] = useState<AppData>(defaultAppData());
  const [selectedView, setSelectedView] = useState<NavKey>('calendar');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftTask>(defaultDraft());
  const [draftScheduledDate, setDraftScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loaded, setLoaded] = useState(false);
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [persistenceError, setPersistenceError] = useState('');

  useEffect(() => {
    void loadAppData().then((loadedData) => {
      setAppData(loadedData);
      setCalendarView(loadedData.settings.defaultCalendarView);
      setLoaded(true);
    }).catch((error: unknown) => {
      setPersistenceError(error instanceof Error ? error.message : 'Could not load planner data.');
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded || persistenceError) {
      return;
    }
    void saveAppData(appData).then(() => setPersistenceError('')).catch((error: unknown) => {
      setPersistenceError(error instanceof Error ? error.message : 'Could not save planner data.');
    });
  }, [appData, loaded, persistenceError]);

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
        setEditingTaskId(null);
        setDraft(defaultDraft());
        setDraftScheduledDate(format(selectedDate, 'yyyy-MM-dd'));
        setTaskEditorOpen(true);
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [selectedDate]);

  const tasksByStatus = useMemo(() => {
    const safe = appData.tasks.filter((task) => task.status !== 'archived');
    return {
      total: safe.length,
      complete: safe.filter((task) => task.status === 'completed').length,
      active: safe.filter((task) => task.status !== 'completed').length,
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

  const openTaskEditor = (task?: Task, scheduledDate = selectedDate) => {
    setDraftScheduledDate(task?.scheduledDate ?? format(scheduledDate, 'yyyy-MM-dd'));
    if (task) {
      setEditingTaskId(task.id);
      setDraft({
        title: task.title,
        priority: task.priority,
        status: task.status,
        label: task.labels[0] ?? 'Other',
        description: task.description,
      });
    } else {
      setEditingTaskId(null);
      setDraft(defaultDraft());
    }
    setTaskEditorOpen(true);
  };

  const closeTaskEditor = () => {
    setTaskEditorOpen(false);
    setEditingTaskId(null);
    setDraft(defaultDraft());
  };

  const saveTask = () => {
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) {
      return;
    }

    const iso = new Date().toISOString();
    const existingTask = editingTaskId
      ? appData.tasks.find((task) => task.id === editingTaskId)
      : undefined;
    const taskPayload: Task = {
      ...existingTask,
      id: existingTask?.id ?? crypto.randomUUID(),
      title: trimmedTitle,
      priority: draft.priority,
      status: draft.status,
      labels: draft.label ? [draft.label] : [],
      scheduledDate: draftScheduledDate,
      description: draft.description.trim(),
      notes: existingTask?.notes ?? '',
      dueDate: existingTask?.dueDate ?? null,
      startTime: existingTask?.startTime ?? null,
      endTime: existingTask?.endTime ?? null,
      color: appData.settings.subjects.find((subject) => subject.name === draft.label)?.color ?? existingTask?.color,
      checklist: existingTask?.checklist ?? [],
      createdAt: existingTask?.createdAt ?? iso,
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

  const moveTaskToDate = (taskId: string, scheduledDate: string) => {
    setAppData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId
        ? { ...task, scheduledDate, updatedAt: new Date().toISOString() }
        : task),
    }));
  };

  const handleTaskDragStart = (event: React.DragEvent<HTMLElement>, taskId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleTaskDrop = (event: React.DragEvent<HTMLElement>, date: string) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      moveTaskToDate(taskId, date);
    }
    setDraggedTaskId(null);
    setDropTargetDate(null);
  };

  const deleteTask = (taskId: string) => {
    setAppData((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
  };

  const deleteEditingTask = () => {
    if (!editingTaskId || !window.confirm('Delete this task? This cannot be undone.')) {
      return;
    }
    deleteTask(editingTaskId);
    closeTaskEditor();
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setAppData((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }));
  };

  const updateSubject = (index: number, changes: Partial<Subject>) => {
    setAppData((current) => {
      const previous = current.settings.subjects[index];
      if (!previous) {
        return current;
      }
      const updatedSubject = { ...previous, ...changes };
      return {
        ...current,
        settings: {
          ...current.settings,
          subjects: current.settings.subjects.map((subject, subjectIndex) => subjectIndex === index ? updatedSubject : subject),
        },
        tasks: current.tasks.map((task) => task.labels[0] === previous.name
          ? {
            ...task,
            labels: [updatedSubject.name, ...task.labels.slice(1)],
            color: updatedSubject.color,
            updatedAt: new Date().toISOString(),
          }
          : task),
      };
    });
  };

  const addSubject = () => {
    const name = `Subject ${appData.settings.subjects.length + 1}`;
    setAppData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        subjects: [...current.settings.subjects, { name, color: '#8791a3' }],
      },
    }));
  };

  const removeSubject = (index: number) => {
    const subject = appData.settings.subjects[index];
    if (!subject || subject.name === 'Other') {
      return;
    }
    setAppData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        subjects: current.settings.subjects.filter((_, subjectIndex) => subjectIndex !== index),
      },
      tasks: current.tasks.map((task) => task.labels[0] === subject.name
        ? { ...task, labels: ['Other', ...task.labels.slice(1)], color: current.settings.subjects.find((item) => item.name === 'Other')?.color, updatedAt: new Date().toISOString() }
        : task),
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

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppData>;
      const nextData: AppData = {
        tasks: parsed.tasks?.map(normalizeTask) ?? [],
        settings: {
          ...defaultAppData().settings,
          ...(parsed.settings ?? {}),
        },
      };

      setAppData(nextData);
      setPersistenceError('');
      event.target.value = '';
    } catch (error) {
      setPersistenceError(error instanceof Error ? `Could not import planner data: ${error.message}` : 'Could not import planner data.');
    }
  };

  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: addDays(selectedDate, -1),
      end: addDays(selectedDate, 2),
    });
  }, [selectedDate]);

  const monthGrid = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: appData.settings.firstDayOfWeek === 'monday' ? 1 : 0 });
    const monthEnd = endOfMonth(selectedDate);
    return eachDayOfInterval({
      start: gridStart,
      end: endOfWeek(monthEnd, { weekStartsOn: appData.settings.firstDayOfWeek === 'monday' ? 1 : 0 }),
    });
  }, [selectedDate, appData.settings.firstDayOfWeek]);
  const monthWeekdays = appData.settings.firstDayOfWeek === 'monday'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const renderTaskCard = (task: Task, draggable = false) => {
    const isDone = task.status === 'completed';
    const subjectName = task.labels[0] || 'Other';
    const taskColor = appData.settings.subjects.find((subject) => subject.name === subjectName)?.color ?? task.color ?? '#8791a3';

    return (
      <div
        key={task.id}
        className={`task-card ${isDone ? 'task-card--done' : ''} ${draggedTaskId === task.id ? 'task-card--dragging' : ''} ${draggable ? 'task-card--draggable' : ''}`}
        style={{ borderLeftColor: taskColor }}
        draggable={draggable}
        onDragStart={draggable ? (event) => handleTaskDragStart(event, task.id) : undefined}
        onDragEnd={draggable ? () => { setDraggedTaskId(null); setDropTargetDate(null); } : undefined}
      >
        <div className="task-card__main">
          <button type="button" className="task-check" aria-label="Toggle task complete" onClick={() => toggleTaskComplete(task.id)}>
            {isDone ? <Check size={12} /> : null}
          </button>
          <div className="task-card__content">
            <div className="task-card__title-row">
              <button type="button" className="task-title task-title--button" onClick={() => setDetailTaskId(task.id)}>{task.title}</button>
              <span className="priority-pill" style={{ backgroundColor: `${priorityColors[task.priority]}20`, color: priorityColors[task.priority] }}>
                <span className="priority-dot" style={{ backgroundColor: priorityColors[task.priority] }} />
                {task.priority === 'urgent' ? 'high' : task.priority}
              </span>
            </div>
            {task.description ? <p className="task-description">{task.description}</p> : null}
            <div className="task-meta">
              {task.dueDate ? <span className="meta-badge">Due {task.dueDate}</span> : null}
              {task.startTime ? <span className="meta-badge">{task.startTime}</span> : null}
            </div>
            {task.labels.length ? (
              <div className="label-row">
                {task.labels.map((label) => (
                  <span
                    className="label-pill"
                    key={`${task.id}-${label}`}
                    style={{
                      backgroundColor: `${appData.settings.subjects.find((subject) => subject.name === label)?.color ?? task.color ?? '#8791a3'}20`,
                      color: appData.settings.subjects.find((subject) => subject.name === label)?.color ?? task.color ?? '#8791a3',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="task-card__edit-action">
          <button
            type="button"
            className="task-card__edit-button"
            aria-label={`Edit task: ${task.title}`}
            onClick={() => openTaskEditor(task)}
          >
            <MoreHorizontal size={17} />
          </button>
        </div>
      </div>
    );
  };

  const renderCalendarLayout = () => {
    if (calendarView === 'month') {
      return (
        <div className="month-grid">
          {monthWeekdays.map((dayName) => (
            <div key={dayName} className="month-grid__header">{dayName}</div>
          ))}
          {monthGrid.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayTasks = appData.tasks.filter((task) => task.scheduledDate === dateKey && task.status !== 'archived');
            return (
              <button
                type="button"
                key={dateKey}
                className={`month-cell ${isToday(date) ? 'month-cell--today' : ''} ${dateKey === format(selectedDate, 'yyyy-MM-dd') ? 'month-cell--selected' : ''} ${dropTargetDate === dateKey ? 'month-cell--drop-target' : ''}`}
                onClick={() => setSelectedDate(date)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDropTargetDate(dateKey);
                }}
                onDragLeave={() => setDropTargetDate((current) => current === dateKey ? null : current)}
                onDrop={(event) => handleTaskDrop(event, dateKey)}
              >
                <span className="month-cell__day">{format(date, 'd')}</span>
                <div className="month-cell__items">
                  {dayTasks.slice(0, 5).map((task) => (
                    <span
                      key={task.id}
                      className="mini-tag mini-tag--draggable"
                      aria-label={`${task.title}, ${task.labels[0] || 'Other'}`}
                      draggable
                      onDragStart={(event) => handleTaskDragStart(event, task.id)}
                      onDragEnd={() => { setDraggedTaskId(null); setDropTargetDate(null); }}
                    >
                      <span className="month-cell__dot" style={{ backgroundColor: appData.settings.subjects.find((subject) => subject.name === (task.labels[0] || 'Other'))?.color ?? task.color ?? '#8791a3' }} />
                    </span>
                  ))}
                  {dayTasks.length > 5 ? <span className="month-cell__overflow">+{dayTasks.length - 5}</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="week-grid">
        {weekDays.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = visibleTasks.filter((task) => task.scheduledDate === dateKey && task.status !== 'archived');

          return (
            <div
              key={dateKey}
              className={`week-column ${isToday(day) ? 'week-column--today' : ''} ${dropTargetDate === dateKey ? 'week-column--drop-target' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropTargetDate(dateKey);
              }}
              onDragLeave={() => setDropTargetDate((current) => current === dateKey ? null : current)}
              onDrop={(event) => handleTaskDrop(event, dateKey)}
            >
              <div className="week-column__header">
                <div className="week-column__date">
                  <span>{format(day, 'EEE')}</span>
                  <strong>{format(day, 'd')}</strong>
                </div>
                <small className="week-column__relative">
                  {['Yesterday', 'Today', 'Tomorrow', 'In 2 days'][index]}
                </small>
              </div>
              {dayTasks.length ? (
                <div className="week-column__tasks">
                  {dayTasks.map((task) => renderTaskCard(task, true))}
                </div>
              ) : null}
              <button type="button" className="empty-day" onClick={() => openTaskEditor(undefined, day)}>+ Add task</button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`app-shell ${taskEditorOpen ? 'app-shell--editor-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">M</div>
          <div>
            <h1>My School Planner</h1>
            <small>Your schoolwork, in flow</small>
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
              {selectedView === 'today' && 'Today'}
              {selectedView === 'upcoming' && 'Upcoming'}
              {selectedView === 'calendar' && 'Calendar'}
              {selectedView === 'settings' && 'Settings'}
            </h2>
            <p>
              {selectedView === 'today' && `Focus on ${format(new Date(), 'EEEE, MMM d')}.`}
              {selectedView === 'upcoming' && 'Plan ahead and keep the week in motion.'}
              {selectedView === 'calendar' && 'Plan today and the next few days. Drag tasks to reschedule.'}
              {selectedView === 'settings' && 'Adjust the planner to match your rhythm.'}
            </p>
          </div>
          {selectedView === 'calendar' ? (
            <div className="date-controls">
              <button type="button" className="nav-button" aria-label={calendarView === 'month' ? 'Previous month' : 'Previous day'} onClick={() => setSelectedDate((value) => calendarView === 'month' ? addMonths(value, -1) : addDays(value, -1))}><ChevronLeft size={16} /></button>
              <button type="button" className="ghost-button" onClick={() => setSelectedDate(new Date())}>Today</button>
              <span className="date-controls__selected">{calendarView === 'month' ? format(selectedDate, 'MMMM yyyy') : `${format(weekDays[0], 'MMM d')} – ${format(weekDays[3], 'MMM d, yyyy')}`}</span>
              <button type="button" className="nav-button" aria-label={calendarView === 'month' ? 'Next month' : 'Next day'} onClick={() => setSelectedDate((value) => calendarView === 'month' ? addMonths(value, 1) : addDays(value, 1))}><ChevronRight size={16} /></button>
              <div className="segmented-control">
                <button type="button" className={calendarView === 'week' ? 'active' : ''} onClick={() => setCalendarView('week')}>4 days</button>
                <button type="button" className={calendarView === 'month' ? 'active' : ''} onClick={() => setCalendarView('month')}>Month</button>
              </div>
            </div>
          ) : null}
        </section>

        {persistenceError ? <p className="storage-message" role="alert">{persistenceError} Your changes may not be saved.</p> : null}

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
          <>
            <div className="calendar-summary" aria-label="Task overview">
              <span><strong>{tasksByStatus.complete}</strong> completed</span>
              <span><strong>{tasksByStatus.active}</strong> remaining</span>
            </div>
          <div className="panel panel--padded">
            {renderCalendarLayout()}
            {calendarView === 'month' ? (
              <section className="selected-day">
                <div className="selected-day__header">
                  <div>
                    <h3>{format(selectedDate, 'EEEE, MMMM d')}</h3>
                    <p>{appData.tasks.filter((task) => task.scheduledDate === format(selectedDate, 'yyyy-MM-dd') && task.status !== 'archived').length} tasks scheduled</p>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => openTaskEditor(undefined, selectedDate)}><Plus size={15} /> Add task</button>
                </div>
                <div className="task-list compact-list">
                  {visibleTasks.filter((task) => task.scheduledDate === format(selectedDate, 'yyyy-MM-dd') && task.status !== 'archived').map((task) => renderTaskCard(task))}
                  {!visibleTasks.some((task) => task.scheduledDate === format(selectedDate, 'yyyy-MM-dd') && task.status !== 'archived') ? <p className="empty-state">No tasks scheduled for this day yet.</p> : null}
                </div>
              </section>
            ) : null}
          </div>
          </>
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
                  <option value="week">4 days</option>
                  <option value="month">Month</option>
                </select>
              </div>
              <div className="settings-row">
                <label>Default task duration (min)</label>
                <input type="number" value={appData.settings.defaultTaskDuration} onChange={(event) => updateSetting('defaultTaskDuration', Number(event.target.value))} />
              </div>
            </div>

            <div className="panel panel--padded subjects-panel">
              <div className="subjects-panel__header">
                <div>
                  <h3>Subjects</h3>
                  <p className="empty-state">Choose a color and name for each school subject.</p>
                </div>
                <button type="button" className="ghost-button" onClick={addSubject}><Plus size={15} /> Add subject</button>
              </div>
              <div className="subject-settings-list">
                {appData.settings.subjects.map((subject, index) => (
                  <div className="subject-settings-row" key={index}>
                    <input
                      aria-label="Subject name"
                      value={subject.name}
                      onChange={(event) => updateSubject(index, { name: event.target.value })}
                    />
                    <input
                      aria-label={`${subject.name} color`}
                      type="color"
                      value={subject.color}
                      onChange={(event) => updateSubject(index, { color: event.target.value })}
                    />
                    {subject.name !== 'Other' ? <button type="button" className="icon-button" aria-label={`Remove ${subject.name}`} onClick={() => removeSubject(index)}><X size={14} /></button> : <span />}
                  </div>
                ))}
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
              <label className="full-width">
                <span>Task name</span>
                <input autoFocus required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Finish mathematics exercises" />
              </label>
              <label>
                <span>Priority</span>
                <select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as Priority }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  {draft.priority === 'urgent' ? <option value="urgent">Urgent (legacy)</option> : null}
                </select>
              </label>
              <label>
                <span>Subject</span>
                <select value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}>
                  {draft.label && !appData.settings.subjects.some((subject) => subject.name === draft.label) ? <option value={draft.label}>{draft.label}</option> : null}
                  {appData.settings.subjects.map((subject) => <option key={subject.name} value={subject.name}>{subject.name}</option>)}
                </select>
              </label>
              <label>
                <span>Date</span>
                <input type="date" required value={draftScheduledDate} onChange={(event) => setDraftScheduledDate(event.target.value)} />
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
                <span>Description / notes</span>
                <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Add any useful details..." />
              </label>
            </div>

            <div className="modal__footer">
              {editingTaskId ? (
                <button type="button" className="ghost-button ghost-button--danger" onClick={deleteEditingTask}>Delete task</button>
              ) : <span />}
              <div className="modal__footer-actions">
                <button type="button" className="ghost-button" onClick={closeTaskEditor}>Cancel</button>
                <button type="button" className="primary-button" onClick={saveTask} disabled={!draft.title.trim() || !draftScheduledDate}>Save task</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {detailTaskId ? (() => {
        const task = appData.tasks.find((item) => item.id === detailTaskId);
        if (!task) {
          return null;
        }
        const subjectName = task.labels[0] || 'Other';
        const subjectColor = appData.settings.subjects.find((subject) => subject.name === subjectName)?.color ?? task.color ?? '#8791a3';
        return (
          <div className="modal-backdrop" onClick={() => setDetailTaskId(null)}>
            <section className="modal task-details" aria-label="Task details" onClick={(event) => event.stopPropagation()}>
              <div className="modal__header">
                <h3>Task details</h3>
                <button type="button" className="icon-button" aria-label="Close task details" onClick={() => setDetailTaskId(null)}><X size={16} /></button>
              </div>
              <h2>{task.title}</h2>
              <div className="task-details__meta">
                <span className="label-pill" style={{ backgroundColor: `${subjectColor}20`, color: subjectColor }}>{subjectName}</span>
                <span className="priority-pill" style={{ backgroundColor: `${priorityColors[task.priority]}20`, color: priorityColors[task.priority] }}>
                  <span className="priority-dot" style={{ backgroundColor: priorityColors[task.priority] }} />
                  {task.priority === 'urgent' ? 'high' : task.priority}
                </span>
                <span className="meta-badge">{task.scheduledDate ? format(new Date(`${task.scheduledDate}T12:00:00`), 'EEEE, MMMM d, yyyy') : 'No date'}</span>
                <span className="meta-badge">{task.status === 'completed' ? 'Completed' : task.status === 'in-progress' ? 'In progress' : 'Not completed'}</span>
              </div>
              <p className="task-details__description">{task.description || 'No description added.'}</p>
              <div className="modal__footer">
                <button
                  type="button"
                  className="ghost-button ghost-button--danger"
                  onClick={() => {
                    if (window.confirm('Delete this task? This cannot be undone.')) {
                      deleteTask(task.id);
                      setDetailTaskId(null);
                    }
                  }}
                >
                  Delete task
                </button>
                <div className="modal__footer-actions">
                  <button type="button" className="ghost-button" onClick={() => toggleTaskComplete(task.id)}>
                    {task.status === 'completed' ? 'Mark unfinished' : 'Mark completed'}
                  </button>
                  <button type="button" className="primary-button" onClick={() => { setDetailTaskId(null); openTaskEditor(task); }}>Edit task</button>
                </div>
              </div>
            </section>
          </div>
        );
      })() : null}
    </div>
  );
}

export default App;

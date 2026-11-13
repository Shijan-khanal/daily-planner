import type { AppData } from './types';

const DB_NAME = 'planner-db';
const STORE_NAME = 'planner-store';
const KEY = 'planner-state';

const defaultDate = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

export const defaultAppData = (): AppData => ({
  tasks: [
    {
      id: 'task-1',
      title: 'Design weekly plan',
      description: 'Map out key priorities and anchor tasks for the week.',
      notes: 'Focus on the most important outcomes first.',
      dueDate: defaultDate(1),
      scheduledDate: defaultDate(0),
      startTime: '09:00',
      endTime: '10:00',
      priority: 'high',
      status: 'in-progress',
      listId: 'list-work',
      labels: ['planning'],
      checklist: [
        { id: 'c1', text: 'Review unfinished projects', checked: true },
        { id: 'c2', text: 'Create focus blocks', checked: false },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-2',
      title: 'Submit C# assignment',
      description: 'Complete the final exercise and submit before Friday.',
      notes: 'Use the university checklist and verify the build before sending.',
      dueDate: defaultDate(2),
      scheduledDate: defaultDate(1),
      startTime: '18:00',
      endTime: '19:30',
      priority: 'urgent',
      status: 'not-started',
      listId: 'list-university',
      labels: ['homework'],
      checklist: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-3',
      title: 'Gym session',
      description: 'Strength workout and mobility routine.',
      notes: 'Bring water bottle and focus on recovery.',
      dueDate: null,
      scheduledDate: defaultDate(0),
      startTime: '18:00',
      endTime: '19:00',
      priority: 'medium',
      status: 'completed',
      listId: 'list-fitness',
      labels: ['health'],
      checklist: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  lists: [
    { id: 'list-work', name: 'Work', color: '#7c3aed', icon: 'briefcase', description: 'Professional and project work' },
    { id: 'list-university', name: 'University', color: '#0ea5e9', icon: 'book-open', description: 'Studies and assignments' },
    { id: 'list-fitness', name: 'Fitness', color: '#22c55e', icon: 'dumbbell', description: 'Exercise and health goals' },
    { id: 'list-personal', name: 'Personal', color: '#f59e0b', icon: 'home', description: 'Life admin and personal tasks' },
  ],
  calendarEvents: [
    {
      id: 'event-1',
      title: 'Team sync',
      date: defaultDate(0),
      start: '10:00',
      end: '10:45',
      color: '#8b5cf6',
      allDay: false,
    },
    {
      id: 'event-2',
      title: 'Deep work block',
      date: defaultDate(2),
      start: '09:00',
      end: '11:00',
      color: '#10b981',
      allDay: false,
    },
  ],
  settings: {
    theme: 'dark',
    defaultCalendarView: 'week',
    firstDayOfWeek: 'monday',
    timeFormat: '24h',
    defaultTaskDuration: 60,
  },
});

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function loadAppData(): Promise<AppData> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return await new Promise<AppData>((resolve) => {
      const request = store.get(KEY);
      request.onsuccess = () => {
        const result = request.result as AppData | undefined;
        resolve(result ?? defaultAppData());
      };
      request.onerror = () => resolve(defaultAppData());
    });
  } catch {
    return defaultAppData();
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(data, KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to save data'));
    });
  } catch {
    // Ignore storage failure in restricted contexts.
  }
}

import type { AppData, Task } from './types';

const DB_NAME = 'planner-db';
const STORE_NAME = 'planner-store';
const KEY = 'planner-state';

export function normalizeTask(task: Task): Task {
  const { listId: legacyListId, ...normalizedTask } = task as Task & { listId?: string };
  void legacyListId;
  return normalizedTask;
}

export const defaultAppData = (): AppData => ({
  tasks: [],
  settings: {
    theme: 'light',
    defaultCalendarView: 'week',
    firstDayOfWeek: 'monday',
    timeFormat: '24h',
    defaultTaskDuration: 60,
    subjects: [
      { name: 'Mathematics', color: '#5285e8' },
      { name: 'English', color: '#9b72cf' },
      { name: 'Biology', color: '#55a879' },
      { name: 'Chemistry', color: '#36a6a0' },
      { name: 'Physics', color: '#d3a735' },
      { name: 'History', color: '#df7c9f' },
      { name: 'Geography', color: '#42a9c5' },
      { name: 'Other', color: '#8791a3' },
    ],
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
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise<AppData>((resolve, reject) => {
    const request = store.get(KEY);
    request.onsuccess = () => {
      const result = request.result as Partial<AppData> | undefined;
      const defaults = defaultAppData();
      resolve(result ? {
        tasks: result.tasks?.map(normalizeTask) ?? defaults.tasks,
        settings: { ...defaults.settings, ...result.settings },
      } : defaults);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to load planner data'));
  });
}

export async function saveAppData(data: AppData): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const request = transaction.objectStore(STORE_NAME).put(data, KEY);

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Failed to save planner data'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Failed to save planner data'));
    request.onerror = () => reject(request.error ?? new Error('Failed to save planner data'));
  });
}

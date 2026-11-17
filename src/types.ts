export type ThemeMode = 'light' | 'dark' | 'system';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'archived';

export type Task = {
  id: string;
  title: string;
  description: string;
  notes: string;
  dueDate: string | null;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  priority: Priority;
  color?: string;
  status: TaskStatus;
  labels: string[];
  checklist: { id: string; text: string; checked: boolean }[];
  createdAt: string;
  updatedAt: string;
};

export type AppSettings = {
  theme: ThemeMode;
  defaultCalendarView: 'week' | 'month';
  firstDayOfWeek: 'monday' | 'sunday';
  timeFormat: '12h' | '24h';
  defaultTaskDuration: number;
  subjects: Subject[];
};

export type Subject = {
  name: string;
  color: string;
};

export type AppData = {
  tasks: Task[];
  settings: AppSettings;
};

export type NavKey = 'today' | 'upcoming' | 'calendar' | 'settings';

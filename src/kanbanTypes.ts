export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'backlog' | 'in-progress' | 'review' | 'done';
export type TaskSourceProvider = 'github' | 'local';

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgentId?: number;
  createdAt: number;
  updatedAt: number;
  sourceUrl?: string;
  sourceProvider?: TaskSourceProvider;
}

export interface KanbanColumn {
  id: string;
  label: string;
  status: TaskStatus;
}

export interface KanbanBoard {
  columns: KanbanColumn[];
  tasks: KanbanTask[];
}

export const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'col-backlog', label: 'Backlog', status: 'backlog' },
  { id: 'col-in-progress', label: 'In Progress', status: 'in-progress' },
  { id: 'col-review', label: 'In Review', status: 'review' },
  { id: 'col-done', label: 'Done', status: 'done' },
];

export const IDLE_TIMEOUT_MS = 30000;
export const AUTO_ASSIGN_NOTIFICATION_MS = 30000;
export const SPEECH_BUBBLE_DURATION_MS = 3000;
export const TASK_COMPLETION_KEYWORDS = ['done', 'complete', 'finished'];

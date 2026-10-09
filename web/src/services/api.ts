import { demoRequest, localImage } from './demoStorage';
import { newOperationID } from './identity';
import type { TaskStatus } from './taskContract';
type UpdateFields<T, Nullable extends keyof T> = Omit<Partial<T>, Nullable> & { [Key in Nullable]?: T[Key] | null } & { expected_updated_at?: string };

// =========================================================
// ORCA Frontend API Client Service
// Demo-only: all workspace data stays in this browser.
// =========================================================


export interface Space {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  space_id: string;
  name: string;
  description?: string;
  status: string;
  target_date?: string;
  kanban_columns: string[];
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  space_id: string;
  project_id?: string;
  parent_task_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  planned_date?: string;
  estimated_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  space_id: string;
  project_id?: string;
  title: string;
  doc_type: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface InboxNote {
  id: string;
  workspace_id: string;
  content: string;
  color?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  workspace_id: string;
  space_id?: string;
  linked_task_id?: string;
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  external_provider?: string;
  external_event_id?: string;
  created_at: string;
  updated_at: string;
}

export interface NoteBoard {
  id: string;
  workspace_id: string;
  space_id: string;
  project_id?: string;
  title: string;
  viewport_state: { x: number; y: number; zoom: number };
  block_count?: number;
  created_at: string;
  updated_at: string;
}

export interface BoardConnection {
  id?: string;
  updated_at?: string;
  fromId: string; toId: string;
  fromSide?: 'top' | 'right' | 'bottom' | 'left';
  toSide?: 'top' | 'right' | 'bottom' | 'left';
}
export interface BoardOperation {
  id: string; mode: 'apply' | 'undo' | 'redo';
  blocks?: { id?: string; action: 'create' | 'update' | 'delete' | 'restore'; patch?: Partial<NoteBlock> & { expected_updated_at?: string }; create?: Partial<NoteBlock> }[];
  connections?: { action: 'create' | 'update' | 'delete'; connection: BoardConnection }[];
}
export interface BoardGraph { id: string; blocks: NoteBlock[]; connections: BoardConnection[]; }

export interface NoteBlock {
  operation_id?: string;
  id: string;
  board_id: string;
  workspace_id: string;
  type: 'sticky' | 'text' | 'card' | 'image' | 'task_embed' | 'shape';
  pos_x: number;
  pos_y: number;
  width?: number;
  height?: number;
  content: any;
  created_at: string;
  updated_at: string;
}

export interface AuthUserData {
  id: string;
  workspace_id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  role: string;
}

export interface UploadResponseData {
  url: string;
  object_key: string;
  filename: string;
  size: number;
  content_type: string;
  driver: string;
}

export { DemoError as ApiError } from './demoStorage';
const request = demoRequest;

export const api = {
  getProfile: async (): Promise<AuthUserData> => {
    const res = await request<{ data: AuthUserData }>('/profile');
    return res.data;
  },

  getPreferences: async (): Promise<{ calendar_timezone: string | null }> => {
    const res = await request<{ data: { calendar_timezone: string | null } }>('/preferences'); return res.data;
  },
  updatePreferences: async (calendar_timezone: string): Promise<void> => {
    await request('/preferences', { method: 'PUT', body: JSON.stringify({ calendar_timezone }) });
  },
  uploadImage: async (file: File): Promise<UploadResponseData> => localImage(file),

  // Spaces
  getSpaces: async (): Promise<Space[]> => {
    const res = await request<{ data: Space[] }>('/spaces');
    return res.data;
  },
  createSpace: async (data: Partial<Space>): Promise<Space> => {
    const res = await request<{ data: Space }>('/spaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateSpace: async (id: string, data: Partial<Space> & { expected_updated_at?: string }): Promise<Space> => {
    const res = await request<{ data: Space }>(`/spaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  deleteSpace: async (id: string): Promise<void> => {
    await request(`/spaces/${id}`, {
      method: 'DELETE',
    });
  },

  // Projects
  getProjects: async (spaceId?: string): Promise<Project[]> => {
    const query = spaceId ? `?space_id=${spaceId}` : '';
    const res = await request<{ data: Project[] }>(`/projects${query}`);
    return res.data;
  },
  createProject: async (data: UpdateFields<Project, 'description' | 'target_date'>): Promise<Project> => {
    const res = await request<{ data: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateProject: async (id: string, data: UpdateFields<Project, 'description' | 'target_date'>): Promise<Project> => {
    const res = await request<{ data: Project }>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  deleteProject: async (id: string): Promise<void> => {
    await request(`/projects/${id}`, {
      method: 'DELETE',
    });
  },

  // Tasks
  getTasks: async (filters: { space_id?: string; project_id?: string; inbox?: boolean; planned_date?: string; status?: string } = {}): Promise<Task[]> => {
    const params = new URLSearchParams();
    if (filters.space_id) params.set('space_id', filters.space_id);
    if (filters.project_id) params.set('project_id', filters.project_id);
    if (filters.inbox) params.set('inbox', 'true');
    if (filters.planned_date) params.set('planned_date', filters.planned_date);
    if (filters.status) params.set('status', filters.status);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request<{ data: Task[] }>(`/tasks${qs}`);
    return res.data;
  },
  createTask: async (data: UpdateFields<Task, 'project_id' | 'parent_task_id' | 'description' | 'due_date' | 'planned_date' | 'estimated_minutes'>): Promise<Task> => {
    const res = await request<{ data: Task }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateTaskStatus: async (id: string, status: TaskStatus, expected_updated_at?: string): Promise<Task> => {
    return api.updateTask(id, { status, expected_updated_at });
  },
  updateTask: async (id: string, data: UpdateFields<Task, 'project_id' | 'parent_task_id' | 'description' | 'due_date' | 'planned_date' | 'estimated_minutes'>): Promise<Task> => {
    const res = await request<{ data: Task }>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  deleteTask: async (id: string): Promise<void> => {
    await request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  // Documents
  getDocuments: async (filters: { space_id?: string; project_id?: string } = {}): Promise<Document[]> => {
    const params = new URLSearchParams();
    if (filters.space_id) params.set('space_id', filters.space_id);
    if (filters.project_id) params.set('project_id', filters.project_id);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request<{ data: Document[] }>(`/documents${qs}`);
    return res.data;
  },
  createDocument: async (data: Partial<Document>): Promise<Document> => {
    const res = await request<{ data: Document }>('/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateDocument: async (id: string, data: UpdateFields<Document, 'project_id'> & { expected_updated_at?: string }): Promise<Document> => {
    const res = await request<{ data: Document }>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  deleteDocument: async (id: string): Promise<void> => {
    await request(`/documents/${id}`, {
      method: 'DELETE',
    });
  },

  // Events (Calendar)
  getEvents: async (filters: { start?: string; end?: string; space_id?: string } = {}): Promise<CalendarEvent[]> => {
    const params = new URLSearchParams();
    if (filters.start) params.set('start', filters.start);
    if (filters.end) params.set('end', filters.end);
    if (filters.space_id) params.set('space_id', filters.space_id);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request<{ data: CalendarEvent[] }>(`/events${qs}`);
    return res.data;
  },
  createEvent: async (data: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const res = await request<{ data: CalendarEvent }>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  updateEvent: async (id: string, data: UpdateFields<CalendarEvent, 'space_id' | 'linked_task_id' | 'description'>): Promise<CalendarEvent> => {
    const res = await request<{ data: CalendarEvent }>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return res.data;
  },
  deleteEvent: async (id: string): Promise<void> => { await request(`/events/${id}`, { method: 'DELETE' }); },

  createBoard: async (data: UpdateFields<NoteBoard, 'project_id'>): Promise<NoteBoard> => {
    const res = await request<{ data: NoteBoard }>('/boards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateBoard: async (id: string, data: UpdateFields<NoteBoard, 'project_id'>): Promise<NoteBoard> => {
    const res = await request<{ data: NoteBoard }>(`/boards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  deleteBoard: async (id: string): Promise<void> => {
    await request(`/boards/${id}`, {
      method: 'DELETE',
    });
  },
  getBoards: async (filters: { space_id?: string; project_id?: string } = {}): Promise<NoteBoard[]> => {
    const params = new URLSearchParams();
    if (filters.space_id) params.set('space_id', filters.space_id);
    if (filters.project_id) params.set('project_id', filters.project_id);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request<{ data: NoteBoard[] }>(`/boards${qs}`);
    return res.data;
  },
  getBoardBlocks: async (boardId: string): Promise<NoteBlock[]> => {
    const res = await request<{ data: NoteBlock[] }>(`/boards/${boardId}/blocks`);
    return res.data;
  },
  applyBoardOperation: async (boardId: string, operation: BoardOperation): Promise<BoardGraph> => {
    const res = await request<{ data: BoardGraph }>(`/boards/${boardId}/operations`, { method: 'POST', body: JSON.stringify(operation) });
    return res.data;
  },
  getBoardConnections: async (boardId: string): Promise<BoardConnection[]> => {
    const res = await request<{ data: BoardConnection[] }>(`/boards/${boardId}/connections`);
    return res.data;
  },
  saveBoardViewport: async (boardId: string, viewport: NoteBoard['viewport_state']): Promise<void> => {
    await request(`/boards/${boardId}/viewport`, { method: 'PUT', body: JSON.stringify(viewport) });
  },
  createNoteBlock: async (boardId: string, data: Partial<NoteBlock>): Promise<NoteBlock> => {
    const id = newOperationID();
    const operationID = newOperationID();
    const content = typeof data.content === 'object' && data.content !== null ? { ...data.content, schema_version: 1 } : data.content;
    const res = await request<{ data: BoardGraph }>(`/boards/${boardId}/operations`, {
      method: 'POST', body: JSON.stringify({ id: operationID, mode: 'apply', blocks: [{ id, action: 'create', create: { ...data, id, content } }] }),
    });
    const created = res.data.blocks.find(block => block.id === id);
    if (!created) throw new Error('Created block was missing from the confirmed board');
    return { ...created, operation_id: operationID };
  },
  updateNoteBlock: async (id: string, data: Partial<NoteBlock>): Promise<NoteBlock> => {
    const res = await request<{ data: NoteBlock }>(`/blocks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  restoreNoteBlock: async (id: string): Promise<NoteBlock> => {
    const res = await request<{ data: NoteBlock }>(`/blocks/${id}/restore`, { method: 'POST' });
    return res.data;
  },
  deleteNoteBlock: async (id: string): Promise<void> => {
    await request(`/blocks/${id}`, {
      method: 'DELETE',
    });
  },

  // Inbox Notes (Quick Thoughts, Memos, Scratchpad)
  getInboxNotes: async (includeArchived = false): Promise<InboxNote[]> => {
    const res = await request<{ data: InboxNote[] }>(`/inbox${includeArchived ? '?archived=true' : ''}`);
    return res.data;
  },
  createInboxNote: async (data: { content: string; color?: string }): Promise<InboxNote> => {
    const res = await request<{ data: InboxNote }>('/inbox', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateInboxNote: async (id: string, data: Partial<InboxNote> & { expected_updated_at?: string }): Promise<InboxNote> => {
    const res = await request<{ data: InboxNote }>(`/inbox/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  deleteInboxNote: async (id: string): Promise<void> => {
    await request(`/inbox/${id}`, {
      method: 'DELETE',
    });
  },
  convertInboxNoteToTask: async (id: string, data: { space_id: string; project_id?: string; title?: string; priority?: string; due_date?: string }): Promise<{ task_id: string }> => {
    const res = await request<{ data: { task_id: string } }>(`/inbox/${id}/convert-task`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  convertInboxNoteToDoc: async (id: string, data: { space_id: string; project_id?: string; title?: string }): Promise<{ document_id: string }> => {
    const res = await request<{ data: { document_id: string } }>(`/inbox/${id}/convert-doc`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
};

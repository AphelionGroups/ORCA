// =========================================================
// ORCA Frontend API Client Service
// Connects to Go Modular Monolith Backend
// =========================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
const DEFAULT_WORKSPACE_ID = '018f0000-0000-7000-8000-000000000001';

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
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
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
  created_at: string;
  updated_at: string;
}

export interface NoteBlock {
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('X-Workspace-ID')) {
    headers.set('X-Workspace-ID', DEFAULT_WORKSPACE_ID);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = `API Error ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return res.json();
}

// ----------------- SPACES -----------------
export const api = {
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

  // Projects
  getProjects: async (spaceId?: string): Promise<Project[]> => {
    const query = spaceId ? `?space_id=${spaceId}` : '';
    const res = await request<{ data: Project[] }>(`/projects${query}`);
    return res.data;
  },
  createProject: async (data: Partial<Project>): Promise<Project> => {
    const res = await request<{ data: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
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
  createTask: async (data: Partial<Task>): Promise<Task> => {
    const res = await request<{ data: Task }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateTaskStatus: async (id: string, status: string): Promise<void> => {
    await request(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  updateTask: async (id: string, data: Partial<Task>): Promise<Task> => {
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

  createBoard: async (data: Partial<NoteBoard>): Promise<NoteBoard> => {
    const res = await request<{ data: NoteBoard }>('/boards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateBoard: async (id: string, data: Partial<NoteBoard>): Promise<NoteBoard> => {
    const res = await request<{ data: NoteBoard }>(`/boards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
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
  createNoteBlock: async (boardId: string, data: Partial<NoteBlock>): Promise<NoteBlock> => {
    const res = await request<{ data: NoteBlock }>(`/boards/${boardId}/blocks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateNoteBlock: async (id: string, data: Partial<NoteBlock>): Promise<NoteBlock> => {
    const res = await request<{ data: NoteBlock }>(`/blocks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  },
  deleteNoteBlock: async (id: string): Promise<void> => {
    await request(`/blocks/${id}`, {
      method: 'DELETE',
    });
  },
};

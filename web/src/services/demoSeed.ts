import { newOperationID } from './identity.ts';

export const DEMO_STORAGE_KEY = 'orca_demo_workspace_v1';
export type Row = Record<string, any>;
export const tableNames = ['spaces', 'projects', 'documents', 'tasks', 'events', 'boards', 'blocks', 'connections', 'inbox'] as const;
export type Table = typeof tableNames[number];
export interface DemoState {
  version: 1;
  profile: Row;
  preferences: { calendar_timezone: string | null };
  tables: Record<Table, Row[]>;
  operations: Record<string, { board_id: string; state: 'applied' | 'undone'; before: Snapshot; after: Snapshot }>;
}
export interface Snapshot { blocks: Row[]; connections: Row[] }

export function createDemoSeed(): DemoState {
  const now = new Date().toISOString();
  const workspace = newOperationID();
  const base = (data: Row): Row => ({ id: newOperationID(), workspace_id: workspace, created_at: now, updated_at: now, ...data });
  const space = base({ name: 'Demo Studio', slug: 'demo-studio', icon: 'work', color: '#B2FFA9', sort_order: 0 });
  const personal = base({ name: 'Personal', slug: 'personal', icon: 'home', color: '#DBD5F8', sort_order: 1 });
  const project = base({ space_id: space.id, name: 'Sunset Coffee Launch', description: 'From a brand idea to a welcoming neighborhood coffee shop.', status: 'active', kanban_columns: ['Backlog', 'Todo', 'In Progress', 'Done'] });
  const board = base({ space_id: space.id, project_id: project.id, title: 'From Idea to Launch', viewport_state: { x: 0, y: 0, zoom: 0.8 } });
  const blocks = ['Brand idea\nA welcoming shop serving local coffee.', 'Experience\nA focused menu and a comfortable space.', 'Launch\nInvite the community to a soft opening.'].map((text, i) => base({ board_id: board.id, type: 'card', pos_x: 80 + i * 300, pos_y: 120, width: 240, height: 180, content: { schema_version: 1, text, color: ['#E0F5DD', '#FFFFFF', '#FFF2D7'][i] } }));
  const tasks = ['Write the brand brief', 'Explore the visual identity', 'Review the tasting menu', 'Prepare soft opening invitations', 'Summarize visitor feedback'].map((title, i) => base({ space_id: space.id, project_id: project.id, title, description: 'Sample work for the Sunset Coffee launch.', status: ['done', 'in_progress', 'in_review', 'todo', 'todo'][i], priority: i % 2 ? 'high' : 'medium', estimated_minutes: 60 }));
  const events = ['Visual exploration session', 'Team menu review', 'Soft opening preparation'].map((title, i) => {
    const start = new Date(); start.setDate(start.getDate() + i); start.setHours(9, 0, 0, 0);
    return base({ space_id: space.id, linked_task_id: tasks[i + 1].id, title, description: 'A focused session for the coffee shop launch.', start_at: start.toISOString(), end_at: new Date(start.getTime() + 3600000).toISOString(), is_all_day: false });
  });
  return {
    version: 1,
    profile: { id: newOperationID(), workspace_id: workspace, full_name: 'Demo User', email: 'demo@user.com', avatar_url: '', role: '' },
    preferences: { calendar_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
    tables: {
      spaces: [space, personal], projects: [project], boards: [board], blocks, tasks, events,
      connections: blocks.slice(0, 2).map((block, i) => base({ board_id: board.id, fromId: block.id, toId: blocks[i + 1].id, fromSide: 'right', toSide: 'left' })),
      documents: [base({ space_id: space.id, project_id: project.id, title: 'Sunset Coffee Brief', doc_type: 'general', is_pinned: true, content: 'Sunset Coffee\n\nGoal\nCreate a welcoming place for meeting and working.\n\nAudience\nCreative professionals and neighbors.\n\nPersonality\nSimple, friendly, and part of everyday life.\n\nLaunch plan\nFinish the visual identity, test the menu, and host a soft opening.\n\nSuccess measure\nGather feedback from the first 20 visitors.' })],
      inbox: ['Idea: host a small coffee tasting every Friday.', 'Ask for feedback on dairy-free menu options.', 'Write a short story about local coffee farmers.'].map(content => base({ content, color: 'default', is_archived: false })),
    }, operations: {},
  };
}

const ws = '018f0000-0000-7000-8000-000000000001';
const space = '018f0000-0000-7000-8000-000000000010';
const project = '018f0000-0000-7000-8000-000000000020';
const board = '018f0000-0000-7000-8000-000000000030';
function createFixture() {
  const now = new Date().toISOString();
  const base = data => ({ workspace_id: ws, created_at: now, updated_at: now, ...data });
  return {
    profile: { id: '018f0000-0000-7000-8000-000000000002', workspace_id: ws, email: 'qa@example.invalid', full_name: 'Example Visitor', avatar_url: '', role: 'Owner' },
    spaces: [base({ id: space, name: 'Studio', slug: 'studio', icon: 'briefcase', color: '#B2FFA9', sort_order: 0 })],
    projects: [base({ id: project, space_id: space, name: 'Sunset Coffee Launch', description: 'A welcoming neighborhood coffee shop, from idea to opening day.', status: 'active', kanban_columns: ['Backlog', 'Todo', 'In Progress', 'Done'] })],
    documents: [base({ id: '018f0000-0000-7000-8000-000000000040', space_id: space, project_id: project, title: 'Brand brief', doc_type: 'general', is_pinned: true, content: 'Sunset Coffee\n\nA welcoming place to meet and work.\n\nAudience\nCreative professionals and neighbors.\n\nNext steps\nExplore the visual identity, test the menu, and invite the community.' })],
    boards: [base({ id: board, space_id: space, project_id: project, title: 'Launch ideas', block_count: 2, viewport_state: { x: 0, y: 0, zoom: 1 } })],
    blocks: [base({ id: '018f0000-0000-7000-8000-000000000050', board_id: board, type: 'card', pos_x: 80, pos_y: 90, width: 240, height: 160, content: { text: 'Brand idea', color: '#E0F5DD' } }), base({ id: '018f0000-0000-7000-8000-000000000051', board_id: board, type: 'sticky', pos_x: 400, pos_y: 180, width: 200, height: 160, content: { text: 'Invite the community', color: '#FFF2D7' } })],
    tasks: ['Explore the visual identity', 'Review the tasting menu', 'Prepare opening invitations', 'Write the brand brief'].map((title, i) => base({ id: `018f0000-0000-7000-8000-00000000006${i}`, space_id: space, project_id: project, title, description: 'A focused step toward opening day.', status: ['todo', 'in_progress', 'in_review', 'done'][i], priority: i === 0 ? 'high' : 'medium', estimated_minutes: 60 })),
    events: [], inbox: [base({ id: '018f0000-0000-7000-8000-000000000070', content: 'Host a coffee tasting every Friday.', color: 'default', is_archived: false })], links: [], writes: [],
  };
}
async function connect(page, state) {
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const endpoint = url.pathname.replace('/api/v1/', ''); const [table, id, action] = endpoint.split('/');
    const method = request.method(); const payload = request.postDataJSON() || {};
    if (table === 'documents' && method === 'PUT') {
      if (state.documentSaveDelay) await new Promise(resolve => setTimeout(resolve, state.documentSaveDelay));
      if (state.documentSaveFailure) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Unable to save this document' }) }); return; }
    }
    if (state.unauthorized && table !== 'auth') {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Session expired' }) }); return;
    }
    if (table === 'auth' && (id === 'login' || id === 'register')) {
      if (state.authError) { await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Incorrect credentials' }) }); return; }
      if (state.authDelay) await new Promise(resolve => setTimeout(resolve, state.authDelay));
    }
    let data;
    if (table === 'auth') {
      data = id === 'login' || id === 'register' ? { token: 'qa-fixture-token', user: state.profile, workspace_id: ws } : state.profile;
      if (id === 'profile' && method === 'PUT') Object.assign(state.profile, payload);
    } else if (table === 'boards' && action === 'blocks') {
      if (method === 'POST') { data = { ...payload, board_id: id, id: crypto.randomUUID(), workspace_id: ws }; state.blocks.push(data); }
      else data = state.blocks.filter(row => row.board_id === id);
    }
    else if (table === 'inbox' && action?.startsWith('convert-')) {
      const note = state.inbox.find(row => row.id === id), createdId = crypto.randomUUID();
      const common = { ...payload, id: createdId, workspace_id: ws, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (action === 'convert-task') { state.tasks.push({ ...common, description: note.content, status: 'todo', priority: payload.priority || 'medium' }); data = { task_id: createdId }; }
      else { state.documents.push({ ...common, content: note.content, doc_type: 'general', is_pinned: false }); data = { document_id: createdId }; }
      state.inbox = state.inbox.filter(row => row.id !== id);
    }
    else if (table === 'blocks') {
      data = state.blocks.find(row => row.id === id);
      if (method === 'PUT') Object.assign(data, payload);
      if (method === 'DELETE') state.blocks = state.blocks.filter(row => row.id !== id);
    } else if (Array.isArray(state[table])) {
      let rows = state[table];
      if (method === 'GET') { data = rows.filter(row => !['space_id', 'project_id'].some(key => url.searchParams.has(key) && row[key] !== url.searchParams.get(key))); }
      else if (method === 'POST') { data = { ...payload, id: crypto.randomUUID(), workspace_id: ws, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; rows.push(data); }
      else { data = rows.find(row => row.id === id); if (method === 'PUT' || method === 'PATCH') Object.assign(data, payload); if (method === 'DELETE') state[table] = rows.filter(row => row.id !== id); }
    } else data = [];
    if (method !== 'GET') state.writes.push({ endpoint, method, payload });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
  });
}
module.exports = { createFixture, connect };

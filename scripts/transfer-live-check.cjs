// Real HTTP + browser verification: no API response fixtures or request mocking.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.ORCA_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve('bin/live-transfer');
const setup = JSON.parse(fs.readFileSync(path.join(root, 'setup.json'), 'utf8'));
const helper = path.join(root, 'tools/live-transfer-helper.exe');
const report = { startedAt: new Date().toISOString(), profiles: [], crossStorage: [] };
const tools = (...args) => execFileSync(helper, args, { encoding: 'utf8', windowsHide: true });
const inspect = file => JSON.parse(tools('inspect', file));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
const pngFile = path.join(root, 'noise.png'); tools('noise-png', pngFile);
const png = fs.readFileSync(pngFile);

async function response(client, endpoint, options = {}) {
  const headers = { ...(client.token ? { Authorization: `Bearer ${client.token}` } : {}) };
  if (options.json !== undefined) { headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(options.json); }
  return fetch(`${client.base}/${endpoint}`, { method: options.method || 'GET', headers, body: options.body, signal: AbortSignal.timeout(130000) });
}
async function call(client, endpoint, method = 'GET', json) {
  const res = await response(client, endpoint, { method, json }); const data = await res.json();
  assert.ok(res.ok, `${method} ${endpoint}: ${res.status} ${JSON.stringify(data)}`); return data.data;
}
async function account(profile, name) {
  const base = `http://127.0.0.1:${profile.apiPort}/api/v1`;
  const password = crypto.randomBytes(16).toString('hex');
  const email = `${profile.kind}-${name}-${crypto.randomUUID()}@live.example.invalid`;
  const auth = await call({ base }, 'auth/register', 'POST', { email, password, full_name: `Live ${name}` });
  return { base, token: auth.token, workspace: auth.workspace_id, email, password };
}
async function upload(client, bytes, name, contentType) {
  const body = new FormData(); body.append('file', new Blob([bytes], { type: contentType }), name);
  const res = await response(client, 'upload', { method: 'POST', body }); const payload = await res.json();
  assert.equal(res.status, 200, JSON.stringify(payload)); return payload.data;
}
function form(file, requestId, space, project) {
  const body = new FormData(); body.append('file', new Blob([fs.readFileSync(file)], { type: 'application/zip' }), path.basename(file));
  if (requestId) body.append('request_id', requestId); if (space) body.append('space_id', space); if (project) body.append('project_id', project); return body;
}
async function preview(client, file, expected = 200) {
  const res = await response(client, 'transfer/preview', { method: 'POST', body: form(file) }); const payload = await res.json();
  assert.equal(res.status, expected, JSON.stringify(payload)); return payload.data || payload.error;
}
async function importCopy(client, file, requestId, space, project, expected = 200) {
  const res = await response(client, 'transfer/import', { method: 'POST', body: form(file, requestId, space, project) }); const payload = await res.json();
  assert.equal(res.status, expected, JSON.stringify(payload)); return payload.data || payload.error;
}
async function exportFile(client, kind, id, name) {
  const res = await response(client, `transfer/export?kind=${kind}${id ? `&id=${id}` : ''}`);
  assert.equal(res.status, 200, await (res.ok ? Promise.resolve('') : res.text()));
  assert.match(res.headers.get('content-type'), /application\/zip/);
  const file = path.join(root, `${name}.orca.zip`); fs.writeFileSync(file, Buffer.from(await res.arrayBuffer())); return file;
}
async function snapshot(client) {
  const endpoints = ['spaces', 'projects', 'documents', 'tasks', 'boards', 'events', 'inbox'];
  const result = {};
  for (const endpoint of endpoints) result[endpoint] = await call(client, endpoint);
  result.blocks = []; for (const board of result.boards) result.blocks.push(...await call(client, `boards/${board.id}/blocks`));
  return result;
}
function assetCount(profile, workspace) {
  if (profile.kind === 's3') return JSON.parse(tools('objects', workspace + '/')).length;
  const dir = path.join(root, 'local-uploads', workspace); let count = 0;
  const walk = folder => { if (!fs.existsSync(folder)) return; for (const item of fs.readdirSync(folder, { withFileTypes: true })) { if (item.isDirectory()) walk(path.join(folder, item.name)); else count++; } }; walk(dir); return count;
}
async function validateCopy(client, result, source, manifest, profile) {
  const copy = await snapshot(client), ids = result.ids;
  for (const [old, next] of Object.entries(ids)) { assert.notEqual(old, next); assert.match(next, /^[a-f0-9-]{36}$/); }
  if (ids[source.parent.id]) {
    const parent = await call(client, `tasks/${ids[source.parent.id]}`); assert.equal(parent.status, 'in_progress'); assert.equal(parent.auto_complete_subtasks, true);
  }
  if (ids[source.child.id]) {
    const child = await call(client, `tasks/${ids[source.child.id]}`); assert.equal(child.planned_date.slice(0, 10), '2026-11-16'); assert.equal(child.due_date.slice(0, 10), '2026-11-20');
    assert.equal(child.parent_task_id || null, ids[source.parent.id] || null);
  }
  if (ids[source.event.id]) assert.equal(copy.events.find(event => event.id === ids[source.event.id]).linked_task_id, ids[source.child.id]);
  if (ids[source.board.id]) {
    const nextBoard = await call(client, `boards/${ids[source.board.id]}`); assert.deepEqual(nextBoard.viewport_state, source.board.viewport_state);
    const blocks = await call(client, `boards/${nextBoard.id}/blocks`), nextImage = blocks.find(block => block.id === ids[source.image.id]);
    assert.deepEqual([nextImage.pos_x, nextImage.pos_y, nextImage.width, nextImage.height], [80, 120, 240, 160]);
    const assetURL = new URL(nextImage.content.url, client.base).href;
    assert.equal(hash(Buffer.from(await (await fetch(assetURL)).arrayBuffer())), hash(png));
    if (profile.kind === 's3') assert.ok(assetURL.startsWith('http://127.0.0.1:9000/orca-live/'));
    assert.notEqual(nextImage.content.url, source.png.url);
    const connectors = await call(client, `boards/${nextBoard.id}/connections`); assert.equal(connectors.length, 1);
    assert.equal(connectors[0].fromId, ids[source.image.id]); assert.equal(connectors[0].toId, ids[source.sticky.id]);
    const embed = blocks.find(block => block.id === ids[source.embed.id]);
    if (ids[source.child.id]) assert.equal(embed.content.task_id, ids[source.child.id]);
    else { assert.equal(embed.type, 'text'); assert.ok(embed.content.text.includes(source.child.title), 'external task title must survive as plain text'); }
  }
  const previewCounts = manifest.entities;
  assert.equal(Object.keys(ids).length, Object.values(previewCounts).reduce((sum, rows) => sum + rows.length, 0));
}
async function seed(profile) {
  const source = await account(profile, 'source'), dest = await account(profile, 'destination');
  const space = await call(source, 'spaces', 'POST', { name: 'Live source Space', slug: 'live-source', icon: 'briefcase', color: '#3b82f6' });
  const other = await call(source, 'spaces', 'POST', { name: 'External Space', slug: 'external', icon: 'briefcase', color: '#3b82f6' });
  const project = await call(source, 'projects', 'POST', { name: 'Live project', space_id: space.id, description: 'Synthetic live test project' });
  const external = await call(source, 'projects', 'POST', { name: 'External project', space_id: other.id });
  const uploadedPNG = await upload(source, png, 'live-noise.png', 'image/png'), uploadedGIF = await upload(source, gif, 'live-pixel.gif', 'image/gif');
  const parent = await call(source, 'tasks', 'POST', { title: 'Live parent', space_id: space.id, project_id: project.id, auto_complete_subtasks: true, planned_date: '2026-11-15', description: `Reference ![pixel](${uploadedGIF.url})` });
  let child = await call(source, 'tasks', 'POST', { title: 'Live child', space_id: space.id, project_id: project.id, parent_task_id: parent.id, planned_date: '2026-11-16', due_date: '2026-11-20T00:00:00Z' });
  child = await call(source, `tasks/${child.id}`, 'PUT', { status: 'done', expected_updated_at: child.updated_at }); assert.equal((await call(source, `tasks/${parent.id}`)).status, 'done');
  child = await call(source, `tasks/${child.id}`, 'PUT', { status: 'todo', expected_updated_at: child.updated_at }); assert.equal((await call(source, `tasks/${parent.id}`)).status, 'in_progress');
  const board = await call(source, 'boards', 'POST', { title: 'Live board', space_id: space.id, project_id: project.id, viewport_state: { x: 12, y: 24, zoom: 1.5 } });
  const imageID = crypto.randomUUID(), stickyID = crypto.randomUUID(), embedID = crypto.randomUUID();
  const graph = await call(source, `boards/${board.id}/operations`, 'POST', { id: crypto.randomUUID(), mode: 'apply', blocks: [
    { id: imageID, action: 'create', create: { type: 'image', pos_x: 80, pos_y: 120, width: 240, height: 160, content: { schema_version: 1, url: uploadedPNG.url, caption: 'Live PNG' } } },
    { id: stickyID, action: 'create', create: { type: 'sticky', pos_x: 400, pos_y: 120, width: 240, height: 160, content: { schema_version: 1, text: 'Live sticky reference', reference_image: uploadedGIF.url } } },
    { id: embedID, action: 'create', create: { type: 'task_embed', pos_x: 80, pos_y: 340, width: 240, height: 160, content: { schema_version: 1, task_id: child.id, text: child.title } } }
  ], connections: [{ action: 'create', connection: { id: crypto.randomUUID(), fromId: imageID, toId: stickyID, fromSide: 'right', toSide: 'left' } }] });
  const document = await call(source, 'documents', 'POST', { title: 'Live brief', space_id: space.id, project_id: project.id, content: `# Live brief\n\n![PNG](${uploadedPNG.url})\n\n![GIF](${uploadedGIF.url})` });
  const event = await call(source, 'events', 'POST', { title: 'Live session', space_id: space.id, linked_task_id: child.id, start_at: '2026-11-16T09:00:00Z', end_at: '2026-11-16T10:00:00Z', is_all_day: false });
  await call(source, 'inbox', 'POST', { content: 'Live Inbox note', color: 'default' });
  await call(source, 'links', 'POST', { from_type: 'document', from_id: document.id, to_type: 'task', to_id: child.id, relation_type: 'relates_to' });
  await call(source, 'links', 'POST', { from_type: 'task', from_id: parent.id, to_type: 'project', to_id: external.id, relation_type: 'relates_to' });
  const targetSpace = await call(dest, 'spaces', 'POST', { name: 'Live destination', slug: 'live-destination' });
  const targetProject = await call(dest, 'projects', 'POST', { name: 'Destination project', space_id: targetSpace.id });
  return { source, dest, space, project, parent, child, board, image: graph.blocks.find(b => b.id === imageID), sticky: graph.blocks.find(b => b.id === stickyID), embed: graph.blocks.find(b => b.id === embedID), document, event, png: uploadedPNG, gif: uploadedGIF, targetSpace, targetProject, files: {} };
}
async function browserFlow(browser, profile, context) {
  const user = await account(profile, 'browser'); const space = await call(user, 'spaces', 'POST', { name: 'Browser destination', slug: 'browser' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(token => localStorage.setItem('orca_auth_token', token), user.token);
  await page.goto(`http://127.0.0.1:${profile.uiPort}`); await page.getByRole('button', { name: 'Page options', exact: true }).click(); await page.getByRole('button', { name: 'Import paket', exact: true }).click();
  const network = await page.context().newCDPSession(page); await network.send('Network.enable'); await network.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: 5 * 1024 * 1024, uploadThroughput: 256 * 1024 });
  const waitForProgress = () => page.waitForFunction(() => { const match = document.querySelector('.transfer-status')?.textContent?.match(/(\d+)%/); return match && Number(match[1]) > 0 && Number(match[1]) < 100; });
  const modal = page.locator('.transfer-modal'); await modal.getByLabel('Pilih paket ORCA', { exact: true }).setInputFiles(context.files.project);
  await waitForProgress();
  await page.screenshot({ path: path.join(root, profile.kind+'-upload-progress.png'), fullPage: true });
  await modal.getByRole('heading', { name: 'Live project', exact: true }).waitFor();
  assert.equal(await modal.getByLabel('Space tujuan', { exact: true }).inputValue(), space.id);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1050 }); await modal.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))));
    assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1)); await page.screenshot({ path: path.join(root, `${profile.kind}-preview-${width}.png`), fullPage: true });
  }
  await modal.getByRole('button', { name: 'Impor sebagai salinan', exact: true }).click(); await waitForProgress(); await modal.getByText('Impor selesai', { exact: true }).waitFor({ timeout: 120000 });
  await modal.getByRole('button', { name: 'Buka hasil impor', exact: true }).click();
  await page.getByRole('tab', { name: /Board/ }).click(); await page.getByText('Live board', { exact: true }).first().dblclick();
  await page.locator('.canvas-block img').first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.canvas-block img')].some(img => img.complete && img.naturalWidth === 512));
  assert.ok(await page.locator('.canvas-block img').first().evaluate(image => { const card=image.closest('.canvas-block').getBoundingClientRect(), box=image.getBoundingClientRect(); return box.bottom <= card.bottom + 1 && box.top >= card.top - 1; }), 'imported image must fit its saved block geometry');
  await page.screenshot({ path: path.join(root, `${profile.kind}-imported-board.png`), fullPage: true });
  // Export the active canvas using its real menu and inspect the downloaded ZIP.
  await page.getByRole('button', { name: 'Page options', exact: true }).click(); await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloadPromise = page.waitForEvent('download'); await modal.getByRole('button', { name: 'Unduh paket', exact: true }).click(); const download = await downloadPromise;
  const downloaded = path.join(root, `${profile.kind}-browser-board.orca.zip`); await download.saveAs(downloaded); assert.equal(inspect(downloaded).scope.kind, 'board');
  await modal.getByText('Paket siap', { exact: true }).waitFor(); await page.keyboard.press('Escape');
  const menuExport = async (kind, key) => {
    const [download]=await Promise.all([page.waitForEvent('download'),modal.getByRole('button',{name:'Unduh paket',exact:true}).click()]);
    const saved=path.join(root,profile.kind+'-ui-'+key+'.orca.zip');await download.saveAs(saved);assert.equal(inspect(saved).scope.kind,kind);
    await modal.getByText('Paket siap',{exact:true}).waitFor();await page.keyboard.press('Escape');
  };
  await page.getByRole('button',{name:'Semua Board',exact:true}).click();
  await page.getByRole('button',{name:'Export board Live board',exact:true}).click();await menuExport('board','gallery');
  await page.getByRole('button',{name:'Page options',exact:true}).click();await page.getByRole('button',{name:'Export',exact:true}).click();await menuExport('project','header');
  await page.getByTitle('Edit Space',{exact:true}).first().click();await page.getByRole('dialog').last().getByRole('button',{name:'Export',exact:true}).click();await menuExport('space','details');await page.keyboard.press('Escape');
  await page.getByTitle('Edit Project',{exact:true}).first().click();await page.getByRole('dialog').last().getByRole('button',{name:'Export',exact:true}).click();await menuExport('project','details');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Home',exact:true}).first().click();await page.getByRole('button',{name:'Open task: Live parent',exact:true}).first().click();await page.getByRole('dialog').last().getByRole('button',{name:'Export',exact:true}).click();await menuExport('task','details');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Edit Profil',exact:true}).click();await page.getByRole('button',{name:'Export workspace',exact:true}).click();await menuExport('workspace','settings');
  await page.getByRole('button',{name:'Import paket',exact:true}).click();await modal.getByLabel('Pilih paket ORCA',{exact:true}).waitFor();await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  assert.deepEqual(errors, []); await page.close(); return { workspace: user.workspace, preview: true, import: true, imageRendered: true, boardExport: true, allExportEntryPoints: true, uploadProgressObserved: true, widths: [320, 390, 768, 1440] };
}
(async () => {
  const browser = await chromium.launch(); const contexts = [];
  try {
    for (const profile of setup.profiles) {
      console.log(`Running live ${profile.kind} API checks...`);
      const context = await seed(profile); const sourceBaseline = await snapshot(context.source); contexts.push({ profile, ...context }); const entry = { kind: profile.kind, scopes: [], failures: [], browser: null }; report.profiles.push(entry);
      for (const [kind, id, key] of [['workspace', null, 'workspace'], ['space', context.space.id, 'space'], ['project', context.project.id, 'project'], ['board', context.board.id, 'board'], ['task', context.parent.id, 'task'], ['task', context.child.id, 'child']]) {
        const file = await exportFile(context.source, kind, id, `${profile.kind}-${key}`); context.files[key] = file; const manifest = inspect(file); const info = await preview(context.dest, file);
        const space = kind === 'workspace' || kind === 'space' ? undefined : context.targetSpace.id;
        const project = kind === 'board' || kind === 'task' ? context.targetProject.id : undefined;
        const requestId = crypto.randomUUID(); const imported = await importCopy(context.dest, file, requestId, space, project); await validateCopy(context.dest, imported, context, manifest, profile);
        const before = await snapshot(context.dest), objects = assetCount(profile, context.dest.workspace);
        assert.deepEqual(await importCopy(context.dest, file, requestId, space, project), imported); assert.deepEqual(await snapshot(context.dest), before); assert.equal(assetCount(profile, context.dest.workspace), objects);
        entry.scopes.push({ scope: key, bytes: fs.statSync(file).size, counts: info.counts, import: true, retry: true });
      }
      for (const mode of ['version', 'hash', 'missing-asset', 'traversal', 'reference', 'cycle', 'expanded']) {
        const bad = path.join(root, `${profile.kind}-bad-${mode}.orca.zip`); tools('mutate', context.files.project, bad, mode);
        const before = await snapshot(context.dest), objects = assetCount(profile, context.dest.workspace);
        await preview(context.dest, bad, 400); await importCopy(context.dest, bad, crypto.randomUUID(), context.targetSpace.id, undefined, 400);
        assert.deepEqual(await snapshot(context.dest), before); assert.equal(assetCount(profile, context.dest.workspace), objects); entry.failures.push(mode);
      }
      const legacy = path.join(root, profile.kind+'-legacy.orca.zip'); tools('mutate',context.files.project,legacy,'legacy');
      await preview(context.dest,legacy); const legacyCopy=await importCopy(context.dest,legacy,crypto.randomUUID(),context.targetSpace.id);
      const legacyManifest=inspect(legacy); const legacyBlock=legacyManifest.entities.note_blocks.find(block=>typeof block.content==='string');
      const restoredLegacy=await call(context.dest,'blocks/'+legacyCopy.ids[legacyBlock.id]); assert.equal(restoredLegacy.content,'Legacy board text'); entry.legacyText=true;
      const forbidden = await response(context.dest, `transfer/export?kind=project&id=${context.project.id}`); assert.equal(forbidden.status, 404);
      await importCopy(context.dest, context.files.project, crypto.randomUUID(), context.space.id, undefined, 400);
      const sameId = crypto.randomUUID(); const concurrent = await Promise.all([importCopy(context.dest, context.files.project, sameId, context.targetSpace.id), importCopy(context.dest, context.files.project, sameId, context.targetSpace.id)]); assert.deepEqual(concurrent[0], concurrent[1]);
      await importCopy(context.dest, context.files.board, sameId, context.targetSpace.id, context.targetProject.id, 409);
      const beforeFailure = await snapshot(context.dest), beforeFiles = assetCount(profile, context.dest.workspace);
      tools('fault-on', profile.schema); try { await importCopy(context.dest, context.files.project, crypto.randomUUID(), context.targetSpace.id, undefined, 500); } finally { tools('fault-off', profile.schema); }
      assert.deepEqual(await snapshot(context.dest), beforeFailure); assert.equal(assetCount(profile, context.dest.workspace), beforeFiles); entry.rollback = { records: true, stagedFiles: true };
      entry.browser = await browserFlow(browser, profile, context);
      assert.deepEqual(await snapshot(context.source),sourceBaseline); entry.sourceUnchanged=true;
      if(profile.kind==='s3')tools('delete-object',context.png.object_key);else {const imagePath=path.resolve(root,'local-uploads',context.png.object_key);assert.ok(imagePath.startsWith(path.join(root,'local-uploads')+path.sep));fs.unlinkSync(imagePath)}
      const missing=await response(context.source,'transfer/export?kind=board&id='+context.board.id);assert.equal(missing.status,400);entry.missingSourceAttachmentRejected=true;
      console.log(`PASS live ${profile.kind}: all scopes, attachments, references, validation failures, concurrent retry, rollback, and browser flow.`);
    }
    for (const source of contexts) {
      const target = contexts.find(context => context.profile.kind !== source.profile.kind); const result = await importCopy(target.dest, source.files.project, crypto.randomUUID(), target.targetSpace.id);
      await validateCopy(target.dest, result, source, inspect(source.files.project), target.profile); report.crossStorage.push({ from: source.profile.kind, to: target.profile.kind, passed: true });
    }
    report.finishedAt = new Date().toISOString(); report.passed = true;
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2)); console.log('PASS: cross-storage Local -> MinIO S3 and MinIO S3 -> Local.');
  } catch (error) { report.error = error.message; fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2)); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

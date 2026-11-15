// Uses real API, PostgreSQL, browser and local storage; no response fixtures.
// Start an isolated instance at ORCA_LIVE_API/ORCA_LIVE_UI before running.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.ORCA_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ORCA_LIVE_API || 'http://127.0.0.1:8081/api/v1';
const ui = process.env.ORCA_LIVE_UI || 'http://127.0.0.1:3001';
const output = path.resolve('bin/delegation'); fs.mkdirSync(output, { recursive: true });
const packageHelper = path.resolve('bin/live-transfer/tools/live-transfer-helper.exe'); fs.mkdirSync(path.dirname(packageHelper), { recursive: true });
execFileSync('go', ['build', '-o', packageHelper, './scripts/live-transfer-helper'], { windowsHide: true });
async function call(token, endpoint, method = 'GET', body) {
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const res = await fetch(`${base}/${endpoint}`, { method, headers, body }); const payload = await res.json(); assert.ok(res.ok, `${method} ${endpoint}: ${res.status} ${JSON.stringify(payload)}`); return payload.data;
}
async function account(name) { return call(null, 'auth/register', 'POST', { email: crypto.randomUUID() + '@delegation.example.invalid', full_name: name, password: crypto.randomUUID() }); }
(async () => {
  const source = await account('Delegation source'), target = await account('Delegation destination');
  await call(source.token, 'preferences', 'PUT', { calendar_timezone: 'Asia/Jakarta' });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const day = offset => new Date(Date.parse(today) + offset * 86400000).toISOString().slice(0, 10);
  const space = await call(source.token, 'spaces', 'POST', { name: 'Delegation live Space', slug: 'delegation-live' });
  const project = await call(source.token, 'projects', 'POST', { name: 'Delegation live project', space_id: space.id });
  const task = await call(source.token, 'tasks', 'POST', { title: 'Live delegated task', space_id: space.id, project_id: project.id, delegated_to: 'Dimas', follow_up_date: today, due_date: day(5) + 'T00:00:00Z' });
  const child = await call(source.token, 'tasks', 'POST', { title: 'Independent live child', space_id: space.id, parent_task_id: task.id }); assert.equal(child.delegated_to, undefined);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, timezoneId: 'Asia/Jakarta' }); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(token => localStorage.setItem('orca_auth_token', token), source.token); await page.goto(ui);
    const daily = () => page.getByRole('region', { name: 'Daily tasks', exact: true }); const waiting = () => page.getByRole('region', { name: 'Didelegasikan ke orang lain', exact: true }); const dialog = () => page.getByRole('dialog').last();
    await daily().getByText('Follow-up: Live delegated task', { exact: true }).waitFor(); assert.equal(await page.locator('[data-widget="delegated"]').count(), 0);
    await page.getByRole('button', { name: 'Customize', exact: true }).click(); await page.getByRole('button', { name: 'Didelegasikan ke orang lain', exact: true }).click(); await page.getByRole('button', { name: 'Done customizing', exact: true }).click();
    await waiting().getByRole('button', { name: 'Open task: ' + task.title, exact: true }).click();
    await dialog().getByLabel('Tanggal follow-up (opsional)', { exact: true }).fill(day(1)); await dialog().getByLabel('Catatan delegasi (opsional)', { exact: true }).fill('Waiting for final review');
    await dialog().getByRole('button', { name: 'Save Changes', exact: true }).click(); await dialog().waitFor({ state: 'hidden' });
    const tomorrow = await call(source.token, `tasks/${task.id}`); assert.equal(tomorrow.follow_up_date.slice(0, 10), day(1)); assert.equal(tomorrow.due_date, task.due_date);
    assert.equal(await daily().getByRole('button', { name: 'Open task: ' + task.title, exact: true }).count(), 0);
    await waiting().getByRole('button', { name: 'Open task: ' + task.title, exact: true }).click(); await dialog().getByRole('button', { name: 'Cabut delegasi', exact: true }).click(); await dialog().getByRole('button', { name: 'Save Changes', exact: true }).click(); await dialog().waitFor({ state: 'hidden' });
    const cleared = await call(source.token, `tasks/${task.id}`); assert.equal(cleared.delegated_to, undefined); assert.equal(cleared.follow_up_date, undefined); assert.equal(cleared.delegation_note, undefined); assert.equal(cleared.due_date, task.due_date);
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'); const upload = new FormData(); upload.append('file', new Blob([gif], { type: 'image/gif' }), 'delegation-note.gif');
    const asset = await call(source.token, 'upload', 'POST', upload);
    await call(source.token, `tasks/${task.id}`, 'PUT', { delegated_to: 'Rani', follow_up_date: today, delegation_note: `Review reference ![image](${asset.url})`, expected_updated_at: cleared.updated_at });
    await page.reload(); await daily().getByText('Follow-up: Live delegated task', { exact: true }).waitFor();
    await waiting().getByRole('button', { name: 'Open task: ' + task.title, exact: true }).click(); assert.equal(await dialog().getByLabel('Penanggung jawab', { exact: true }).inputValue(), 'Rani');
    await dialog().getByRole('button', { name: 'Export', exact: true }).click(); const transfer = page.locator('.transfer-modal');
    const [download] = await Promise.all([page.waitForEvent('download'), transfer.getByRole('button', { name: 'Unduh paket', exact: true }).click()]);
    const archive = path.join(output, 'live-delegated-task.orca.zip'); await download.saveAs(archive);
    const inspect = JSON.parse(execFileSync(packageHelper, ['inspect', archive], { encoding: 'utf8', windowsHide: true }));
    assert.equal(inspect.entities.tasks.find(row => row.id === task.id).delegated_to, 'Rani'); assert.equal(inspect.assets.length, 1);
    const importData = new FormData(); importData.append('file', new Blob([fs.readFileSync(archive)]), 'delegated-task.orca.zip'); importData.append('request_id', crypto.randomUUID());
    const destination = await call(target.token, 'spaces', 'POST', { name: 'Destination Space', slug: 'destination' }); importData.append('space_id', destination.id);
    const copied = await call(target.token, 'transfer/import', 'POST', importData); const imported = await call(target.token, `tasks/${copied.ids[task.id]}`);
    assert.equal(imported.delegated_to, 'Rani'); assert.equal(imported.follow_up_date.slice(0, 10), today); assert.equal(imported.due_date, task.due_date); assert.notEqual(imported.delegation_note, `Review reference ![image](${asset.url})`);
    const copiedImage = imported.delegation_note.match(/\(([^)]+)\)/)?.[1]; assert.ok(copiedImage); assert.deepEqual(Buffer.from(await (await fetch(new URL(copiedImage,base))).arrayBuffer()),gif);
    const copiedChild = await call(target.token, `tasks/${copied.ids[child.id]}`); assert.equal(copiedChild.delegated_to, undefined);
    await transfer.getByText('Paket siap', { exact: true }).waitFor(); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await waiting().getByText('Didelegasikan ke Rani', { exact: true }).waitFor(); await page.screenshot({ path: path.join(output, 'live-dashboard.png'), fullPage: true });
    assert.deepEqual(errors, []);
    const result = { passed: true, checkedAt: new Date().toISOString(), provider: 'local', actualHTTPAndBrowser: true, followUpOnlyDaily: true, widgetOptIn: true, independentDeadline: true, revokeClearsMetadata: true, childIndependent: true, portableCopy: true, noteAttachmentCopied: true };
    fs.writeFileSync(path.join(output, 'live-report.json'), JSON.stringify(result, null, 2)); console.log('PASS live delegation: real API/browser create-edit-revoke, Daily/widget, independent deadline/subtask, and cross-workspace package with note attachment.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

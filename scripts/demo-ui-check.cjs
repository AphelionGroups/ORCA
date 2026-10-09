const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.ORCA_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ORCA_DEMO_URL || 'http://127.0.0.1:3012';
const key = 'orca_demo_workspace_v1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); const errors = []; const apiRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/api\/|\/auth\/|localhost:8080/.test(request.url())) apiRequests.push(request.url()); });
  const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const project = () => page.locator('.sidebar-project-item').filter({ hasText: 'Sunset Coffee Launch' }).click();
  const nav = text => page.locator('.sidebar-nav-item').filter({ hasText: text }).click();
  let parentServer;
  try {
    await page.goto(base); await page.locator('.brand-logo').waitFor();
    assert.equal(await page.locator('#auth-email').count(), 0);
    assert.equal((await state()).tables.tasks.length, 5);
    await project(); await page.getByRole('tab', { name: /Docs & Plans/ }).click();
    await page.getByLabel('Document content').fill('A browser-only document edit.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).tables.documents[0].content === 'A browser-only document edit.', key);
    await page.reload(); await project(); await page.getByRole('tab', { name: /Docs & Plans/ }).click();
    assert.equal(await page.getByLabel('Document content').inputValue(), 'A browser-only document edit.');
    await page.getByRole('tab', { name: /Tasks/ }).click(); await page.getByRole('button', { name: 'List', exact: true }).click();
    await page.getByTitle('Mark incomplete').first().click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).tables.tasks.every(row => row.status !== 'done'), key);
    await page.getByRole('tab', { name: /Board/ }).click(); await page.getByText('From Idea to Launch', { exact: true }).click();
    await page.getByText('Brand idea', { exact: false }).click(); await page.keyboard.press('Delete');
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).tables.blocks.filter(row => !row.deleted_at).length === 2, key);
    await page.keyboard.press('Control+z'); await page.getByText('Brand idea', { exact: false }).waitFor();
    assert.equal((await state()).tables.connections.filter(row => !row.deleted_at).length, 2);
    await page.keyboard.press('Control+y'); await page.getByText('Brand idea', { exact: false }).waitFor({ state: 'hidden' });
    await page.keyboard.press('Control+z'); await page.getByText('Brand idea', { exact: false }).waitFor();
    await nav('Calendar'); await page.getByRole('button', { name: 'Timeline', exact: true }).click();
    await page.locator('.calendar-event-card').filter({ hasText: 'Visual exploration session' }).click();
    await page.getByLabel('Event title', { exact: true }).fill('Updated local session');
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal((await state()).tables.events[0].title, 'Updated local session');
    await nav('Inbox'); await page.keyboard.press('Control+k');
    await page.getByPlaceholder('Tulis ide, catatan, atau pemikiran yang baru terpikirkan... (Ctrl+Enter untuk simpan)').fill('A new local idea');
    await page.getByRole('button', { name: /Simpan|Save|Capture/ }).last().click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).tables.inbox.some(row => row.content === 'A new local idea'), key);
    await page.getByRole('button', { name: 'Edit Profil', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Local Demo Visitor');
    assert.equal(await page.locator('input[type=password]').count(), 0);
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByText('Local Demo Visitor', { exact: true }).waitFor();
    fs.mkdirSync(path.join(__dirname, '../bin/demo-screenshots'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, '../bin/demo-screenshots/desktop.png') });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
    await page.getByText('Demo User', { exact: true }).waitFor();
    assert.equal((await state()).tables.tasks.length, 5);
    assert.ok(!(await state()).tables.inbox.some(row => row.content === 'A new local idea'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.orca-sidebar.collapsed').waitFor({ state: 'attached' });
    await page.getByRole('button', { name: 'Buka Sidebar', exact: true }).click();
    await page.locator('.sidebar-drawer-backdrop').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.sidebar-drawer-backdrop').waitFor({ state: 'hidden' });
    await page.screenshot({ path: path.join(__dirname, '../bin/demo-screenshots/mobile.png'), animations: 'disabled' });
    // A real iframe renders the same static build on a different origin.
    const framePage = await context.newPage();
    parentServer = http.createServer((_request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end(`<iframe title="ORCA demo" sandbox="allow-scripts allow-same-origin allow-modals" src="${base}" style="width:100%;height:900px;border:0"></iframe>`);
    });
    await new Promise((resolve, reject) => { parentServer.once('error', reject); parentServer.listen(3013, '127.0.0.1', resolve); });
    await framePage.goto('http://127.0.0.1:3013/iframe-preview');
    await framePage.frameLocator('iframe').locator('.orca-app').waitFor();
    assert.equal(await framePage.frameLocator('iframe').locator('#auth-email').count(), 0);
    const isolated = await browser.newContext();
    await isolated.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }); });
    const blocked = await isolated.newPage(); blocked.on('pageerror', error => errors.push(error.message));
    await blocked.goto(base); await blocked.locator('.brand-logo').waitFor();
    await blocked.getByRole('status').filter({ hasText: 'Your browser blocks saved data' }).waitFor();
    await isolated.close();
    assert.deepEqual(apiRequests, []); assert.deepEqual(errors, []);
    console.log('PASS: no login/API requests; documents/tasks/calendar/Inbox/profile persist; board undo/redo; reset; mobile; iframe; blocked-storage fallback.');
  } finally { await browser.close(); if (parentServer) await new Promise(resolve => parentServer.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });



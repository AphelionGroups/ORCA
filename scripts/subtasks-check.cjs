const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ORCA_PLAYWRIGHT_MODULE || 'playwright');
const { createFixture, connect } = require('./redesign-fixture.cjs');
const dist = path.resolve('web/dist');
const server = http.createServer((req, res) => {
  let file = path.resolve(dist, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('orca_auth_token', 'subtask-fixture'));
    const fixture = createFixture(), parent = fixture.tasks[0];
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    Object.assign(parent, { planned_date: today, auto_complete_subtasks: false, subtask_count: 1, subtask_done: 0, descendant_count: 1 });
    const child = { ...parent, id: crypto.randomUUID(), title: 'Periksa tampilan mobile', parent_task_id: parent.id, parent_title: parent.title, subtask_count: 0, descendant_count: 0 };
    fixture.tasks.push(child);
    await connect(page, fixture);
    let failAdd = true;
    await page.route('**/api/v1/tasks', async route => {
      if (route.request().method() === 'POST' && failAdd) {
        failAdd = false;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Subtask gagal disimpan. Coba lagi.' }) });
      } else await route.fallback();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const openParent = () => page.getByRole('button', { name: `Open task: ${parent.title}`, exact: true }).first().click();
    await page.getByRole('region', { name: 'Daily tasks', exact: true }).waitFor();
    assert.ok(await page.getByRole('region', { name: 'Daily tasks', exact: true }).getByText(`Subtask · ${parent.title}`, { exact: true }).count());
    await openParent();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('0 dari 1 selesai', { exact: true }).waitFor();
    assert.equal(await dialog.locator('details,summary').count(), 0);
    await dialog.getByLabel('Judul subtask', { exact: true }).fill('Hubungkan domain');
    await page.keyboard.press('Enter');
    await dialog.getByRole('alert').filter({ hasText: 'Subtask gagal disimpan' }).waitFor();
    assert.equal(await dialog.getByLabel('Judul subtask', { exact: true }).inputValue(), 'Hubungkan domain');
    await page.keyboard.press('Enter');
    await dialog.getByRole('button', { name: 'Hubungkan domain', exact: true }).waitFor();
    await dialog.getByText('0 dari 2 selesai', { exact: true }).waitFor();
    assert.equal(fixture.tasks.filter(t => t.title === 'Hubungkan domain').length, 1);
    assert.equal(await dialog.getByLabel('Judul subtask', { exact: true }).evaluate(el => el === document.activeElement), true);
    await dialog.getByRole('button', { name: 'Selesaikan Hubungkan domain', exact: true }).click();
    await dialog.getByText('1 dari 2 selesai', { exact: true }).waitFor();
    // Navigating to a child must save that child's identity, not the original parent.
    await dialog.getByRole('button', { name: child.title, exact: true }).click();
    await dialog.getByRole('button', { name: `Kembali ke ${parent.title}`, exact: true }).waitFor();
    assert.equal(await dialog.getByLabel('Judul subtask', { exact: true }).count(), 0);
    await dialog.getByRole('textbox').first().fill('Periksa mobile dan tablet');
    await dialog.getByLabel('Planned date (Optional)', { exact: true }).fill(today);
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const lastWrite = fixture.writes.at(-1);
    assert.equal(lastWrite.endpoint, `tasks/${child.id}`);
    assert.equal(fixture.tasks.find(t => t.id === parent.id).title, parent.title);
    assert.equal(lastWrite.payload.planned_date, today);
    await openParent();
    await dialog.getByText('1 dari 2 selesai', { exact: true }).waitFor();
    await dialog.getByRole('checkbox', { name: /Selesaikan task ini/ }).check();
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(fixture.writes.at(-1).payload.auto_complete_subtasks, true);
    await openParent();
    await dialog.getByText('1 dari 2 selesai', { exact: true }).waitFor();
    fs.mkdirSync('bin/subtasks', { recursive: true });
    await dialog.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))));
    await page.screenshot({ path: 'bin/subtasks/desktop.png', fullPage: true });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await dialog.getByLabel('Judul subtask', { exact: true }).scrollIntoViewIfNeeded();
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `dialog overflows at ${width}`);
      await page.screenshot({ path: `bin/subtasks/mobile-${width}.png`, fullPage: true });
    }
    await dialog.getByRole('button', { name: 'Periksa mobile dan tablet', exact: true }).click();
    await dialog.getByRole('button', { name: 'Jadikan task mandiri', exact: true }).click();
    await dialog.getByLabel('Judul subtask', { exact: true }).waitFor();
    assert.equal(fixture.writes.at(-1).payload.parent_task_id, null);
    assert.equal(fixture.tasks.find(t => t.id === child.id).id, child.id);
    await page.keyboard.press('Escape');
    await openParent();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await dialog.getByText(/beserta 1 subtask/).waitFor();
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    console.log('PASS: subtask add/retry/focus, completion, child navigation/save, planned date, automation preference, detach, delete warning, and 320/390/768/1440 layouts.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

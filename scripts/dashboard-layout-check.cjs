const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ORCA_PLAYWRIGHT_MODULE || 'playwright');
const { createFixture, connect } = require('./redesign-fixture.cjs');
const dist = path.resolve('web/dist');
const server = http.createServer((req, res) => {
  let file = path.resolve(dist, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(dist + path.sep)) file = path.join(dist, 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('orca_auth_token', 'dashboard-fixture'));
    const fixture = createFixture();
    fixture.tasks[0].planned_date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    await connect(page, fixture);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('region', { name: 'Daily tasks', exact: true }).waitFor();
    const openTask = page.getByRole('button', { name: 'Open task: Explore the visual identity', exact: true });
    await openTask.click(); await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    await openTask.focus(); await page.keyboard.press('Enter'); await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    await page.screenshot({ path: 'bin/dashboard-task-items-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    const order = () => page.locator('[data-widget]').evaluateAll(items => items.map(item => item.dataset.widget));
    assert.equal(await page.locator('.dashboard-size-controls, .dashboard-widget-controls button[aria-label^="Move"]').count(), 0);
    const source = await page.locator('[data-widget="daily"] .dashboard-widget-body').boundingBox();
    const target = await page.getByRole('region', { name: 'Unscheduled tasks', exact: true }).boundingBox();
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down(); await page.mouse.move(target.x + 60, target.y + 40, { steps: 12 }); await page.mouse.up();
    assert.deepEqual(await order(), ['unscheduled', 'daily']);
    const resize = await page.locator('[data-widget="unscheduled"] [data-resize="corner"]').boundingBox();
    await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
    await page.mouse.down(); await page.mouse.move(resize.x - 300, resize.y - 300, { steps: 12 }); await page.mouse.up();
    assert.equal(await page.locator('[data-widget="unscheduled"]').getAttribute('data-columns'), '4');
    assert.equal(await page.locator('[data-widget="unscheduled"]').evaluate(el=>Math.round(el.getBoundingClientRect().height)), 240);
    const before = await order();
    const handle = await page.locator('[data-widget="daily"] .dashboard-widget-body').boundingBox();
    await page.mouse.move(handle.x + 12, handle.y + 12); await page.mouse.down();
    await page.mouse.move(400, handle.y + 20, { steps: 5 }); await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await order(), before);
    await page.locator('[data-widget="daily"]').focus();
    await page.keyboard.press('ArrowUp'); assert.equal((await order())[0], 'daily');
    await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await page.reload(); await page.getByRole('button', { name: 'Customize', exact: true }).click();
    assert.equal(await page.locator('[data-widget="daily"]').getAttribute('data-columns'), '12');
    assert.equal(await page.locator('[data-widget="daily"]').evaluate(el=>Math.round(el.getBoundingClientRect().height)), 480);
    // Card content belongs to layout editing, so a click cannot open a task.
    await page.locator('[data-widget="unscheduled"] .dashboard-task').first().click({ force: true });
    assert.equal(await page.getByRole('dialog').count(), 0);
    const edge = await page.locator('[data-widget="daily"] [data-resize="bottom"]').boundingBox();
    await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2); await page.mouse.down(); await page.mouse.move(edge.x + edge.width / 2, edge.y - 250, { steps: 10 }); await page.mouse.up();
    assert.equal(await page.locator('[data-widget="daily"]').evaluate(el=>Math.round(el.getBoundingClientRect().height)), 240);
    await page.screenshot({ path: 'bin/dashboard-layout-desktop.png', fullPage: true });
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(650);
      const cards = await page.locator('[data-widget]').evaluateAll(items => items.map(item => { const rect = item.getBoundingClientRect(); return { left: rect.left, right: rect.right, height: rect.height }; }));
      for (const card of cards) { assert.ok(card.left >= 0 && card.right <= width + 1, `Widget outside viewport at ${width}`); assert.ok(card.height >= 240 && card.height <= 480); if (width < 600) assert.ok(card.right - card.left >= width - 40, 'Mobile widgets use the available width'); }
    }
    await page.setViewportSize({ width: 390, height: 1000 }); await page.waitForTimeout(650);
    await page.screenshot({ path: 'bin/dashboard-layout-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Done customizing', exact: true }).click();
    await page.screenshot({ path: 'bin/dashboard-task-items-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Main app dashboard passed: pointer reorder/resize, min/max size, Escape cancellation, keyboard reorder, reload persistence, responsive bounds. API data was isolated fixture data.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

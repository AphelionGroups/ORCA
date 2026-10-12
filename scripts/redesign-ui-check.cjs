// Synthetic API fixture for frontend QA only; never imported by the application.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ORCA_PLAYWRIGHT_MODULE || 'playwright');
const phase = process.env.ORCA_QA_PHASE || 'after';
const directory = path.resolve(`docs/screenshots/redesign-2026-10-10/${phase}`);
const dist = path.resolve(process.env.ORCA_QA_DIST || 'web/dist');
const fixture = require('./redesign-fixture.cjs');
const server = http.createServer((request, response) => {
  let file = path.resolve(dist, '.' + new URL(request.url, 'http://localhost').pathname);
  if (!file.startsWith(dist + path.sep) && file !== dist) { response.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch(); const errors = []; const checks = []; const behavior = [];
  const base = `http://127.0.0.1:${server.address().port}`;
  fs.mkdirSync(directory, { recursive: true });
  try {
    for (const width of [1440, 360, 768, 1024]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: 'light', ...(width === 360 ? { hasTouch: true, isMobile: true } : {}) });
      await context.addInitScript(() => {
        const active = new Set(), add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
        window.orcaQaDialogListeners = active;
        EventTarget.prototype.addEventListener = function(type, listener, options) {
          if (this === document && type === 'keydown' && (options === true || options?.capture)) active.add(listener);
          return add.call(this, type, listener, options);
        };
        EventTarget.prototype.removeEventListener = function(type, listener, options) {
          if (this === document && type === 'keydown' && (options === true || options?.capture)) active.delete(listener);
          return remove.call(this, type, listener, options);
        };
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      const state = fixture.createFixture(); await fixture.connect(page, state);
      await page.goto(base); await page.locator('#auth-email').waitFor();
      await page.screenshot({ path: path.join(directory, `login-${width}.png`), animations: 'disabled' });
      await page.locator('#auth-email').fill('qa@example.invalid'); await page.locator('#auth-password').fill('qa-only-password');
      await page.locator('form button[type=submit]').click(); await page.locator('.orca-app').waitFor();
      const openSidebar = async () => { const button = page.getByRole('button', { name: 'Buka Sidebar', exact: true }); if (await button.isVisible()) await button.click(); };
      const project = async () => { await openSidebar(); await page.locator('.sidebar-project-item').filter({ hasText: 'Sunset Coffee Launch' }).click(); };
      const nav = async text => { await openSidebar(); await page.locator('.sidebar-nav-item').filter({ hasText: text }).click(); };
      const tab = name => page.locator('.seg-btn').filter({ hasText: name }).first().click();
      await page.screenshot({ path: path.join(directory, `projects-${width}.png`), animations: 'disabled' });
      if (phase === 'after' && width === 1440) {
        await page.locator('.project-card').first().focus(); await page.keyboard.press('Enter');
        await page.getByRole('button', { name: /Open board Launch ideas/ }).waitFor();
        assert.equal(await page.locator('.sidebar-project-item-left').filter({ hasText: 'Sunset Coffee Launch' }).getAttribute('aria-current'), 'page');
      }
      await project(); await tab('Docs & Plans'); await page.getByPlaceholder('Document Title...').waitFor();
      await page.screenshot({ path: path.join(directory, `documents-${width}.png`), animations: 'disabled' });
      if (phase === 'after') {
        const save = await page.getByRole('button', { name: 'Save', exact: true }).boundingBox();
        assert.ok(save.x >= 0 && save.x + save.width <= width + 1, `Document Save clipped at ${width}`);
      }
      await tab('Tasks'); await page.getByText('Explore the visual identity', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(directory, `tasks-${width}.png`), animations: 'disabled' });
      await tab('Board'); await page.getByText('Launch ideas', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(directory, `board-gallery-${width}.png`), animations: 'disabled' });
      await page.getByText('Launch ideas', { exact: true }).click();
      await page.getByText('Brand idea', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(directory, `board-${width}.png`), animations: 'disabled' });
      await nav('Calendar'); await page.screenshot({ path: path.join(directory, `calendar-${width}.png`), animations: 'disabled' });
      await nav('Inbox'); await page.getByText('Host a coffee tasting every Friday.', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(directory, `inbox-${width}.png`), animations: 'disabled' });
      if (phase === 'after') {
        await page.keyboard.press('Control+k'); await page.getByRole('dialog').waitFor();
        await page.screenshot({ path: path.join(directory, `capture-${width}.png`), animations: 'disabled' });
        await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await project();
        const tabs = page.getByRole('tablist', { name: 'Project views' });
        await tabs.getByRole('tab').first().focus(); await page.keyboard.press('End');
        assert.equal(await tabs.getByRole('tab', { selected: true }).textContent().then(text => text.trim().startsWith('Tasks')), true);
        await page.keyboard.press('Home'); assert.ok((await tabs.getByRole('tab', { selected: true }).textContent()).includes('Docs'));
        if (width === 1440) {
          const button = page.getByRole('button', { name: 'New Item', exact: true });
          const before = await button.boundingBox(); await button.hover();
          await page.waitForFunction(() => document.querySelector('.btn-pill-white').style.getPropertyValue('--hover-x') !== '');
          assert.deepEqual(await button.boundingBox(), before);
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.waitForFunction(() => document.querySelector('.btn-pill-white').style.getPropertyValue('--hover-x') === '');
          await page.screenshot({ path: path.join(directory, 'reduced-motion-1440.png'), animations: 'disabled' });
          await openSidebar(); await page.getByRole('button', { name: 'Dark Theme' }).click();
          await page.screenshot({ path: path.join(directory, 'dark-1440.png'), animations: 'disabled' });
          await page.reload(); assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
          await page.getByRole('button', { name: 'Light Theme' }).click();
          await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
          await page.screenshot({ path: path.join(directory, 'zoom-200.png'), animations: 'disabled' });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Overflow at 200% zoom');
          const action = await page.getByRole('button', { name: 'New Item', exact: true }).boundingBox();
          assert.ok(action.x + action.width <= width + 1, 'Header action clipped at 200% zoom');
          await project(); await tab('Board'); await page.getByRole('button', { name: /Open board Launch ideas/ }).click();
          await page.getByRole('button', { name: 'Choose shape', exact: true }).click();
          const zoomMenu = page.getByRole('menu', { name: 'Shapes' }); await zoomMenu.waitFor();
          const zoomBounds = await zoomMenu.boundingBox(); assert.ok(zoomBounds.x >= 0 && zoomBounds.x + zoomBounds.width <= width, 'Shape menu clipped at 200% zoom');
          await page.screenshot({ path: path.join(directory, 'zoom-board-menu-200.png'), animations: 'disabled' });
          await page.keyboard.press('Escape');
          await page.evaluate(() => { document.documentElement.style.zoom = ''; });
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          behavior.push(...await require('./redesign-behavior.cjs')(page, state, { project, tab, nav, openSidebar, screenshot: name => page.screenshot({ path: path.join(directory, `${name}.png`), animations: 'disabled' }) }));
          checks.push('Stable control bounds, pointer/reduced-motion runtime reset, theme reload and 200% zoom');
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert.equal(overflow, false, `Page overflow at ${width}`);
        if (width === 360) {
          await openSidebar();
          assert.equal(await page.locator('.orca-main-viewport').getAttribute('inert'), '');
          await page.screenshot({ path: path.join(directory, 'drawer-360.png'), animations: 'disabled' });
          await page.keyboard.press('Escape');
          await page.getByRole('button', { name: 'Buka Sidebar', exact: true }).waitFor();
          await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Buka Sidebar');
          checks.push('Touch drawer opens/closes, background inert and focus returns');
          await tab('Board'); await page.getByText('Launch ideas', { exact: true }).click();
          await page.getByRole('button', { name: 'Choose shape', exact: true }).click();
          const menu = page.getByRole('menu', { name: 'Shapes' }); await menu.waitFor();
          const bounds = await menu.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
          await page.screenshot({ path: path.join(directory, 'board-menu-360.png'), animations: 'disabled' });
          await menu.getByRole('menuitem').first().click(); await menu.waitFor({ state: 'hidden' });
          checks.push('Touch canvas toolbar scroll and shape popover remain usable');
          await openSidebar(); await page.getByRole('button', { name: 'Dark Theme', exact: true }).click();
          await page.keyboard.press('Escape');
          await page.screenshot({ path: path.join(directory, 'dark-360.png'), animations: 'disabled' });
        }
      }
      checks.push(`Auth, projects/docs/tasks/board/calendar/Inbox at ${width}`);
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ phase, fixture: true, baseline: phase === 'before' ? 'd3ad92d' : undefined, browser: await browser.version(), checks, behavior, errors }, null, 2));
    console.log(`PASS ${phase}: ${checks.join('; ')}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

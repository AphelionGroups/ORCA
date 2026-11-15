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
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const state = createFixture(), space = state.spaces[0], project = state.projects[0];
    state.spaces.push({ ...space, id: crypto.randomUUID(), name: 'Personal' });
    await page.addInitScript(() => localStorage.setItem('orca_auth_token', 'transfer-fixture'));
    await connect(page, state);
    let previewKind = 'project', previewFailure = false, importCount = 0, exportScopes = [];
    const importIDs = [];
    const counts = { projects: 1, tasks: 3, note_boards: 1, documents: 1, note_blocks: 2, events: 2, entity_links: 2, assets: 1 };
    await page.route('**/api/v1/transfer/**', async route => {
      const request = route.request(), url = new URL(request.url());
      assert.equal(request.headers().authorization, 'Bearer transfer-fixture');
      if (url.pathname.endsWith('/export')) {
        exportScopes.push(Object.fromEntries(url.searchParams));
        await route.fulfill({ contentType: 'application/zip', body: Buffer.from('PK synthetic download fixture') }); return;
      }
      assert.ok(request.headers()['content-type'].startsWith('multipart/form-data; boundary='));
      if (url.pathname.endsWith('/preview')) {
        await route.fulfill({ status: previewFailure ? 400 : 200, contentType: 'application/json', body: JSON.stringify(previewFailure ? { error: 'Format paket tidak didukung. Pilih paket ORCA versi 1.' } : { data: { name: 'Coffee Launch', scope: { kind: previewKind }, counts: previewKind === 'workspace' ? { ...counts, spaces: 1 } : counts, warnings: ['Referensi di luar paket: Brief project lain tetap sebagai teks.'], requires_destination: previewKind !== 'workspace', bytes: 128 } }) }); return;
      }
      importCount++; const body = request.postDataBuffer().toString();
      importIDs.push(body.match(/name="request_id"\r\n\r\n([^\r]+)/)?.[1]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await route.fulfill({ status: importCount === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(importCount === 1 ? { error: 'Koneksi terputus. Coba lagi.' } : { data: { name: 'Coffee Launch', counts, ids: {}, warnings: [], space_id: space.id, project_id: project.id } }) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const openMenu = () => page.getByRole('button', { name: 'Page options', exact: true }).click();
    await openMenu(); await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = () => page.locator('.transfer-modal');
    await dialog().getByRole('button', { name: 'Unduh paket', exact: true }).waitFor();
    const downloading = page.waitForEvent('download'); await dialog().getByRole('button', { name: 'Unduh paket', exact: true }).click();
    const download = await downloading; assert.ok(download.suggestedFilename().endsWith('.orca.zip')); assert.equal(exportScopes.at(-1).kind, 'workspace');
    await dialog().getByText('Paket siap', { exact: true }).waitFor(); await page.keyboard.press('Escape');
    await openMenu(); await page.getByRole('button', { name: 'Import paket', exact: true }).click();
    const input = () => dialog().getByLabel('Pilih paket ORCA', { exact: true });
    const selectPackage = () => input().setInputFiles({ name: 'coffee-launch.orca.zip', mimeType: 'application/zip', buffer: Buffer.from('PK synthetic upload fixture') });
    previewFailure = true; await selectPackage(); await dialog().getByRole('alert').filter({ hasText: 'Format paket' }).waitFor();
    assert.equal(await dialog().getByRole('button', { name: 'Impor sebagai salinan', exact: true }).isDisabled(), true); assert.equal(importCount, 0);
    previewFailure = false; await selectPackage(); await dialog().getByRole('heading', { name: 'Coffee Launch', exact: true }).waitFor();
    assert.equal(await dialog().locator('details,summary').count(), 0);
    assert.equal(await dialog().getByRole('button', { name: 'Impor sebagai salinan', exact: true }).isDisabled(), true);
    await dialog().getByLabel('Space tujuan', { exact: true }).selectOption(space.id);
    fs.mkdirSync('bin/transfer', { recursive: true });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      await dialog().evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))));
      assert.ok(await dialog().evaluate(el => el.scrollWidth <= el.clientWidth + 1), `import overflow at ${width}`);
      await page.screenshot({ path: `bin/transfer/preview-${width}.png`, fullPage: true });
    }
    const submit = () => dialog().getByRole('button', { name: 'Impor sebagai salinan', exact: true });
    await submit().click(); assert.equal(await submit().isDisabled(), true);
    await dialog().getByRole('alert').filter({ hasText: 'Koneksi terputus' }).waitFor();
    await submit().click(); await dialog().getByText('Impor selesai', { exact: true }).waitFor();
    assert.equal(importCount, 2); assert.ok(importIDs[0]); assert.equal(importIDs[0], importIDs[1]);
    await dialog().getByRole('button', { name: 'Buka hasil impor', exact: true }).click();
    await page.getByRole('tab', { name: /Board/ }).waitFor();
    // Project header export has the selected project ID, without changing content.
    await openMenu(); await page.getByRole('button', { name: 'Export', exact: true }).click();
    const nextDownload = page.waitForEvent('download'); await dialog().getByRole('button', { name: 'Unduh paket', exact: true }).click(); await nextDownload;
    await dialog().getByText('Paket siap', { exact: true }).waitFor(); assert.deepEqual(exportScopes.at(-1), { kind: 'project', id: project.id }); await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: /Board/ }).click();
    await page.getByRole('button', { name: 'Export board Launch ideas', exact: true }).click();
    await dialog().getByText('Launch ideas', { exact: true }).waitFor(); await page.keyboard.press('Escape');
    // Board packages require a usable project destination. Workspace packages create their own spaces.
    previewKind = 'board'; await openMenu(); await page.getByRole('button', { name: 'Import paket', exact: true }).click(); await selectPackage();
    await dialog().getByLabel('Space tujuan', { exact: true }).selectOption(space.id);
    await dialog().getByLabel('Project tujuan', { exact: true }).selectOption(project.id);
    assert.equal(await submit().isDisabled(), false); await page.keyboard.press('Escape');
    previewKind = 'workspace'; await openMenu(); await page.getByRole('button', { name: 'Import paket', exact: true }).click(); await selectPackage();
    await dialog().getByRole('heading', { name: 'Coffee Launch', exact: true }).waitFor();
    assert.equal(await dialog().getByLabel('Space tujuan', { exact: true }).count(), 0); assert.equal(await submit().isDisabled(), false); await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    console.log('PASS: package download, multipart preview, invalid format, destination selection, retry identity, double-submit protection, navigation, board/project exports, workspace copy, and responsive 320/390/768/1440 layouts.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

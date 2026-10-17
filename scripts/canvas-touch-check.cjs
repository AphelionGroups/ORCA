const assert = require('node:assert/strict');

// Run against the same persisted-operation fixture as the desktop smoke test.
module.exports = async function checkCanvasTouch(page, graph, operationResponse) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350); // Let the sidebar layout transition finish.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const canvas = page.locator('.board-canvas');
  const block = page.locator(`.canvas-block[data-block-id="${graph().blocks[0].id}"]`);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y, radiusX: 4, radiusY: 4 })) });
  const drag = async (x, y, dx, dy, end = 'touchEnd') => {
    await touch('touchStart', [[1, x, y]]);
    for (let step = 1; step <= 5; step++) await touch('touchMove', [[1, x + dx * step / 5, y + dy * step / 5]]);
    await touch(end, []);
  };
  let box = await block.boundingBox();
  const initial = { ...graph().blocks[0] };
  let saved = operationResponse('apply');
  await drag(box.x + 50, box.y + 50, 48, 48); await saved;
  assert.notEqual(graph().blocks[0].pos_x, initial.pos_x, 'finger drag must persist');
  assert.ok(Math.abs(graph().blocks[0].pos_x - initial.pos_x - 48) <= 12, 'drag respects grid snapping');
  const toolbar = await page.locator('.canvas-context-toolbar').boundingBox();
  assert.ok(toolbar.x >= 0 && toolbar.x + toolbar.width <= 391, `mobile toolbar must fit viewport: ${JSON.stringify(toolbar)}`);
  require('node:fs').mkdirSync('bin', { recursive: true });
  await page.screenshot({ path: 'bin/canvas-touch-mobile.png' });
  const handle = page.getByLabel('Resize se', { exact: true });
  box = await handle.boundingBox(); const width = graph().blocks[0].width;
  saved = operationResponse('apply'); await drag(box.x + box.width / 2, box.y + box.height / 2, 36, 30); await saved;
  assert.ok(graph().blocks[0].width > width, 'finger resize must persist');
  const resizedWidth = graph().blocks[0].width;
  saved = operationResponse('undo'); await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved;
  assert.equal(graph().blocks[0].width, width);
  saved = operationResponse('redo'); await page.getByRole('button', { name: 'Redo', exact: true }).click(); await saved;
  assert.equal(graph().blocks[0].width, resizedWidth);
  const confirmed = { ...graph().blocks[0] };
  box = await block.boundingBox();
  await drag(box.x + 30, box.y + 50, -32, 24, 'touchCancel');
  await page.waitForTimeout(100);
  assert.equal(graph().blocks[0].pos_x, confirmed.pos_x, 'cancel must not persist');
  assert.equal(Math.round((await block.boundingBox()).x), Math.round(box.x), 'cancel must restore the displayed position');
  // A small finger jitter is a tap, with no history entry.
  const beforeReceipts = graph().blocks[0].updated_at;
  await drag(box.x + 30, box.y + 50, 3, 2);
  assert.equal(graph().blocks[0].updated_at, beforeReceipts);
  saved = operationResponse('apply'); await page.getByTitle('Lock object', { exact: true }).click(); await saved;
  await drag(box.x + 30, box.y + 50, -24, 24);
  assert.equal(graph().blocks[0].pos_x, confirmed.pos_x, 'locked objects must not move');
  assert.equal(await page.locator('.canvas-resize-handle').count(), 0, 'locked objects have no resize handles');
  saved = operationResponse('apply'); await page.getByTitle('Unlock object', { exact: true }).click(); await saved;
  const area = await canvas.boundingBox();
  await drag(area.x + 20, area.y + Math.min(280, area.height / 2), 24, 24);
  const afterPan = await block.boundingBox();
  assert.ok(Math.abs(afterPan.x - box.x - 24) < 2, 'one finger on empty canvas must pan');
  assert.equal(graph().blocks[0].pos_x, confirmed.pos_x, 'pan must not move objects in storage');
  box = afterPan;
  await drag(box.x + 30, box.y + 50, 0, 0);
  // A second finger cancels the object draft and zooms around the midpoint.
  await touch('touchStart', [[1, box.x + 30, box.y + 50]]);
  await touch('touchMove', [[1, box.x + 50, box.y + 65]]);
  await touch('touchStart', [[1, area.x + 80, area.y + 240], [2, area.x + 220, area.y + 240]]);
  await touch('touchMove', [[1, area.x + 60, area.y + 260], [2, area.x + 260, area.y + 260]]);
  await touch('touchEnd', []);
  assert.equal(graph().blocks[0].pos_x, confirmed.pos_x, 'pinch must not save a partial drag');
  assert.ok((await block.boundingBox()).width > confirmed.width, 'pinch must zoom');
  // Editing uses an explicit button; touch input must not drag the object.
  await page.locator('.canvas-context-toolbar').getByRole('button', { name: 'Edit', exact: true }).click();
  assert.ok(await block.locator('textarea, input, [contenteditable=true]').count() > 0);
  const doneBounds = await page.getByRole('button', { name: 'Done editing', exact: true }).boundingBox();
  assert.ok(doneBounds.x >= 0 && doneBounds.x + doneBounds.width <= 390, 'finish editing must stay inside the screen');
  await page.screenshot({ path: 'bin/canvas-touch-editor.png' });
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(350);
  box = await block.boundingBox();
  await page.mouse.dblclick(box.x + 40, box.y + 45);
  assert.ok(await block.locator('textarea, input, [contenteditable=true]').count() > 0, 'desktop double click must still edit');
  await block.locator('textarea').press('Escape');
  await page.waitForTimeout(50);
  // A failed operation must show the error and reload the confirmed geometry.
  const stable = { ...graph().blocks[0] };
  await page.route('**/operations', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Unable to save test move' }) }));
  box = await block.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 45); await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 75, { steps: 5 }); await page.mouse.up();
  await page.getByRole('alert').filter({ hasText: 'Unable to save test move' }).waitFor();
  await page.unroute('**/operations');
  assert.equal(graph().blocks[0].pos_x, stable.pos_x);
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  console.log('Canvas touch passed: persisted drag/resize, cancellation, tap tolerance, pinch transition, toolbar bounds and editing.');
};

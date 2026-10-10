// Interaction regression checks against the real frontend with intercepted API responses.
const assert = require('node:assert/strict');
module.exports = async function checkBehavior(page, state, helpers) {
  const { project, tab, nav, openSidebar, screenshot } = helpers;
  const observations = [];
  await project(); await tab('Docs & Plans');
  state.documentSaveDelay = 150;
  const title = page.getByRole('textbox', { name: 'Document title', exact: true });
  await title.fill('Brand brief — updated');
  const editor = page.getByRole('textbox', { name: 'Document content', exact: true });
  await editor.fill('A welcoming place.\n\nUpdated through the real document editor.');
  const saved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/documents/') && response.request().postDataJSON()?.content?.includes('real document editor'));
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await saved;
  assert.equal(state.documents[0].title, 'Brand brief — updated');
  assert.ok(state.documents[0].content.includes('real document editor'));
  assert.ok((await editor.inputValue()).includes('real document editor'));
  state.documentSaveDelay = 0;
  state.documentSaveFailure = true;
  await editor.fill('Updated through the real document editor. Retry this saved draft.');
  await page.keyboard.press('Tab'); await page.getByRole('alert').waitFor();
  await screenshot('document-save-error-1440');
  assert.ok((await editor.inputValue()).includes('Retry this saved draft'));
  state.documentSaveFailure = false;
  const retried = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/documents/') && response.status() === 200);
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await retried;
  await page.getByRole('alert').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByText('Updated through the real document editor.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.reload(); await project(); await tab('Docs & Plans');
  assert.equal(await title.inputValue(), 'Brand brief — updated');
  observations.push('Document title/content saved through API adapter, preview and reload');

  await tab('Tasks');
  const task = page.getByRole('button', { name: /Explore the visual identity/ });
  await task.focus(); await page.keyboard.press('Enter');
  let dialog = page.getByRole('dialog'); await dialog.waitFor();
  await screenshot('task-dialog-1440');
  await dialog.getByLabel('Status', { exact: true }).selectOption('done');
  await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(state.tasks[0].status, 'done');
  await page.getByRole('button', { name: 'New Task', exact: true }).click();
  await dialog.getByLabel('Task Title').fill('Verify opening checklist');
  await dialog.getByRole('button', { name: 'Create Task', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.ok(state.tasks.some(task => task.title === 'Verify opening checklist'));
  observations.push('Keyboard opens task, status update and creation retain API writes');

  await tab('Board'); await page.getByRole('button', { name: /Open board Launch ideas/ }).click();
  const block = page.locator('.canvas-block').filter({ hasText: 'Brand idea' }).first();
  const bounds = await block.boundingBox(), originalX = state.blocks[0].pos_x;
  const moved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes(`/blocks/${state.blocks[0].id}`));
  await page.mouse.move(bounds.x + 30, bounds.y + 45); await page.mouse.down();
  await page.mouse.move(bounds.x + 90, bounds.y + 85, { steps: 8 }); await page.mouse.up(); await moved;
  assert.notEqual(state.blocks[0].pos_x, originalX);
  const undone = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes(`/blocks/${state.blocks[0].id}`));
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await undone;
  assert.equal(state.blocks[0].pos_x, originalX);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  assert.ok((await page.getByRole('button', { name: 'Reset canvas zoom', exact: true }).textContent()).includes('110%'));
  await page.getByRole('button', { name: 'Reset canvas view', exact: true }).click();
  const shape = page.getByRole('button', { name: 'Choose shape', exact: true });
  await shape.click(); await page.getByRole('menu', { name: 'Shapes' }).waitFor();
  await page.keyboard.press('End'); assert.equal(await page.getByRole('menuitem').last().evaluate(el => el === document.activeElement), true);
  await screenshot('board-menu-1440'); await page.keyboard.press('Escape');
  assert.equal(await shape.evaluate(el => el === document.activeElement), true);
  observations.push('Canvas drag persistence, undo, zoom/reset, shape menu keyboard and focus return');

  // Stable focus after closing, and no accumulating document-level dialog handlers.
  await page.getByRole('button', { name: 'New Item', exact: true }).focus();
  const dialogListeners = await page.evaluate(() => window.orcaQaDialogListeners.size);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Control+k'); await dialog.waitFor();
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    const controls = dialog.locator('button:visible:not(:disabled), input:visible:not(:disabled), textarea:visible:not(:disabled), select:visible:not(:disabled)');
    await controls.last().focus(); await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.orcaQaDialogListeners.size), dialogListeners);
    assert.equal(await page.getByRole('button', { name: 'New Item', exact: true }).evaluate(el => el === document.activeElement), true);
  }
  await page.keyboard.press('Control+k'); await dialog.waitFor();
  await dialog.locator('textarea').fill('Keep the launch welcoming.');
  await page.keyboard.press('Control+Enter'); await dialog.waitFor({ state: 'hidden' });
  assert.ok(state.inbox.some(note => note.content === 'Keep the launch welcoming.'));
  observations.push('Five dialog mount/unmount cycles, Tab trap, Escape/focus return and capture shortcut');

  await openSidebar(); await page.getByRole('button', { name: 'Edit Profil', exact: true }).click();
  await dialog.waitFor(); await screenshot('settings-1440');
  const settings = dialog.getByRole('tablist', { name: 'Account settings' });
  await settings.getByRole('tab').first().focus(); await page.keyboard.press('End');
  assert.equal((await settings.getByRole('tab', { selected: true }).textContent()).trim(), 'Keamanan');
  await page.keyboard.press('Home');
  const name = dialog.locator('input[type=text]').first(); await name.fill('Example Visitor Updated');
  await dialog.getByRole('button', { name: 'Simpan Perubahan' }).click();
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  assert.equal(state.profile.full_name, 'Example Visitor Updated');
  observations.push('Account keyboard tabs and profile update');

  await nav('Calendar'); await page.getByRole('button', { name: 'Add Event', exact: true }).click();
  await dialog.waitFor(); await screenshot('event-dialog-1440');
  await dialog.getByLabel('EVENT TITLE').fill('Opening day review');
  await dialog.getByRole('button', { name: 'Book Event' }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.ok(state.events.some(event => event.title === 'Opening day review'));
  observations.push('Calendar event form keeps API payload');

  await nav('Inbox');
  await page.getByRole('button', { name: 'Jadikan Task', exact: true }).first().click();
  await dialog.waitFor(); await screenshot('convert-dialog-1440');
  await dialog.getByLabel('Project Tujuan').selectOption(state.projects[0].id);
  await dialog.locator('button[type=submit]').click(); await dialog.waitFor({ state: 'hidden' });
  assert.ok(state.writes.some(write => write.endpoint.endsWith('convert-task')));
  observations.push('Inbox conversion destination and API call');

  await openSidebar(); await page.getByTitle('Tambah Space Baru', { exact: true }).click();
  await dialog.waitFor(); await screenshot('space-dialog-1440');
  await dialog.getByLabel('Space Name', { exact: true }).fill('Community initiatives');
  await dialog.getByRole('button', { name: 'Buat Space', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.ok(state.spaces.some(space => space.name === 'Community initiatives'));
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await dialog.waitFor(); await screenshot('project-dialog-1440');
  await dialog.getByLabel('Project Name', { exact: true }).fill('Neighborhood opening gathering');
  await dialog.getByRole('button', { name: 'Buat Project', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.ok(state.projects.some(project => project.name === 'Neighborhood opening gathering'));
  observations.push('Space/project creation dialogs retain API and selection flow');

  // Check a realistically populated workspace without adding fixture logic to app code.
  const baseTask = state.tasks[0], baseProject = state.projects[0];
  state.projects.push(...Array.from({ length: 24 }, (_, i) => ({ ...baseProject, id: `qa-dense-project-${i}`, name: `A longer project title for the community opening initiative ${i + 1}` })));
  state.tasks.push(...Array.from({ length: 80 }, (_, i) => ({ ...baseTask, id: `qa-dense-task-${i}`, title: `Review community opening task ${i + 1}`, status: ['todo', 'in_progress', 'in_review', 'done'][i % 4] })));
  await page.reload(); await screenshot('projects-dense-1440'); await project(); await tab('Tasks');
  await page.locator('.task-card').filter({ hasText: 'Review community opening task 1' }).first().waitFor();
  await screenshot('tasks-dense-1440'); await tab('Docs & Plans');
  const latency = await editor.evaluate(async el => {
    const values = [];
    for (let i = 0; i < 12; i++) {
      const start = performance.now(); el.value += '.'; el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      values.push(performance.now() - start);
    }
    return { measurement: 'Input dispatch to second animation frame, local synthetic workspace; not INP/Core Web Vitals', samples: values.map(value => +value.toFixed(2)), max: +Math.max(...values).toFixed(2) };
  });
  observations.push(latency);

  // Existing auth boundaries must survive a visual redesign.
  state.unauthorized = true;
  await page.getByTitle('Refresh', { exact: true }).click(); await page.locator('#auth-email').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('orca_auth_token')), null);
  state.unauthorized = false; state.authError = true;
  await page.locator('#auth-email').fill('qa@example.invalid'); await page.locator('#auth-password').fill('wrong-password');
  await page.locator('form button[type=submit]').click(); await page.getByRole('alert').waitFor();
  await screenshot('auth-error-1440'); assert.equal(await page.locator('.orca-app').count(), 0);
  state.authError = false; state.authDelay = 200;
  await page.locator('form button[type=submit]').click(); assert.equal(await page.locator('form button[type=submit]').isDisabled(), true);
  await page.locator('.orca-app').waitFor();
  await page.getByRole('button', { name: 'Keluar dari akun' }).click(); await page.locator('#auth-email').waitFor();
  observations.push('401 clears token, login error, disabled submit during pending request and logout');
  await page.getByRole('tab', { name: 'Daftar Baru', exact: true }).click();
  await page.locator('#reg-fullname').fill('QA Visitor'); await page.locator('#auth-email').fill('qa@example.invalid');
  await page.locator('#auth-password').fill('qa-only-password'); await page.locator('#reg-confirm-password').fill('different-password');
  await page.locator('form button[type=submit]').click();
  await page.getByText('Konfirmasi kata sandi tidak cocok', { exact: true }).waitFor(); await screenshot('registration-error-1440');
  await page.locator('#reg-confirm-password').fill('qa-only-password'); await page.locator('form button[type=submit]').click();
  await page.locator('.orca-app').waitFor(); assert.ok(state.writes.some(write => write.endpoint === 'auth/register'));
  state.projects = []; state.spaces = []; state.inbox = [];
  await page.reload(); await page.getByText('Belum ada project di space ini', { exact: true }).waitFor(); await screenshot('projects-empty-1440');
  await nav('Inbox'); await page.getByText('Inbox Bersih', { exact: true }).waitFor(); await screenshot('inbox-empty-1440');
  observations.push('Registration validation/API contract and empty Space/project/Inbox states');
  return observations;
};

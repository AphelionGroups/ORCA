const fs=require('fs');const path=require('path');const http=require('http');const assert=require('assert/strict');
const {chromium}=require(process.env.ORCA_PLAYWRIGHT_MODULE||'playwright');
const dist=path.resolve('web/dist');
const output=path.resolve(process.env.ORCA_UI_CHECK_OUTPUT||'docs/screenshots/orca-refresh');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.join(dist,pathname);if(!file.startsWith(dist+path.sep)&&file!==dist){res.writeHead(403).end();return;}if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(dist,'index.html');const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'};res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
const ws='018f0000-0000-7000-8000-000000000001',space='018f0000-0000-7000-8000-000000000010';
const projects=['A','B'].map((name,i)=>({id:`018f0000-0000-7000-8000-00000000002${i}`,workspace_id:ws,space_id:space,name:`Project ${name}`,description:'Smoke fixture',status:'active',kanban_columns:['Todo','Done']}));
const boards=projects.map((p,i)=>({id:`018f0000-0000-7000-8000-00000000003${i}`,project_id:p.id,workspace_id:ws,space_id:space,title:`Board ${i===0?'A':'B'}`,viewport_state:{x:0,y:0,zoom:1},block_count:1}));
let pauseOldDocs=false, releaseOldDocs, oldDocsStarted;
let oldDocsResponse, oldDocsSignal;
const profile={id:'018f0000-0000-7000-8000-000000000002',workspace_id:ws,full_name:'Smoke Owner',email:'smoke@example.test',role:'Owner'};
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];const writes=[];const fixtureNotes=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({profile})=>{localStorage.setItem('orca_auth_token','smoke-token');localStorage.setItem('orca_current_user',JSON.stringify({...profile,name:profile.full_name}));},{profile});
  await page.route('**/api/v1/**',async route=>{
   const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api/v1','');let data=[];const method=route.request().method();if(method!=='GET')writes.push({endpoint,method,body:route.request().postDataJSON()});
   if(endpoint==='/auth/me')data=profile;
   else if(endpoint.startsWith('/documents/') && method==='PUT')data={id:endpoint.split('/').at(-1),...route.request().postDataJSON()};
   else if(endpoint==='/tasks' && method==='POST')data={id:'created-fixture-task',workspace_id:ws,...route.request().postDataJSON()};
   else if(endpoint==='/inbox'){if(method==='POST'){data={id:'fixture-note',content:route.request().postDataJSON().content,created_at:new Date().toISOString()};fixtureNotes.push(data);}else data=fixtureNotes;}
   else if(endpoint==='/spaces')data=[{id:space,workspace_id:ws,name:'Smoke Space',slug:'smoke',icon:'briefcase',color:'#3b82f6',sort_order:0}];
   else if(endpoint==='/projects')data=projects;
   else if(endpoint==='/boards')data=boards.filter(b=>!url.searchParams.get('project_id')||b.project_id===url.searchParams.get('project_id'));
   else if(endpoint==='/documents'){const p=url.searchParams.get('project_id')||projects[0].id;data=[{id:'doc-'+p,project_id:p,space_id:space,workspace_id:ws,title:p===projects[0].id?'Document A':'Document B',content:'**Safe markdown**',doc_type:'general',is_pinned:false}];}
   else if(endpoint==='/tasks'){const p=url.searchParams.get('project_id')||projects[0].id;data=[{id:'task-'+p,project_id:p,space_id:space,workspace_id:ws,title:p===projects[0].id?'Task A':'Task B',status:'todo',priority:'medium'}];}
   else if(endpoint.includes('/blocks')){const boardId=url.searchParams.get('board_id')||endpoint.split('/')[2];data=[{id:'block-'+boardId,board_id:boardId,workspace_id:ws,type:'sticky',pos_x:100,pos_y:100,width:220,height:150,content:{text:'Canvas note'}}];}
   if(endpoint==='/documents' && url.searchParams.get('project_id')===projects[0].id && pauseOldDocs){oldDocsStarted();await oldDocsResponse;}
   await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({data})});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});await page.screenshot({path:path.join(output,'after-projects-desktop.png')});
  await page.locator('.sidebar-project-item').filter({hasText:'Project A'}).click();
  await page.getByText('Board A',{exact:true}).waitFor();
  await page.getByRole('tab',{name:/Docs & Plans/}).click();
  await page.getByPlaceholder('Document Title...').waitFor();assert.equal(await page.getByPlaceholder('Document Title...').inputValue(),'Document A');
  await page.getByRole('tab',{name:/Tasks/}).first().click();await page.getByText('Task A',{exact:true}).first().waitFor();
  await page.getByRole('tab',{name:/Board/}).first().click();await page.getByText('Board A',{exact:true}).click();await page.getByText('Canvas note',{exact:true}).waitFor();
  await page.getByText('Canvas note',{exact:true}).click();await page.locator('.canvas-context-toolbar').waitFor();
  await page.keyboard.press('Delete');await page.getByText('Canvas note',{exact:true}).waitFor({state:'hidden'});
  await page.keyboard.press('Control+z');await page.getByText('Canvas note',{exact:true}).waitFor();
  assert(writes.some(w=>w.method==='POST'&&w.endpoint.endsWith('/restore')));
  await page.keyboard.press('Control+y');await page.getByText('Canvas note',{exact:true}).waitFor({state:'hidden'});
  await page.keyboard.press('Control+z');await page.getByText('Canvas note',{exact:true}).waitFor();
  await page.locator('.sidebar-project-item').filter({hasText:'Project B'}).click();await page.getByText('Board B',{exact:true}).waitFor();
  assert.equal(await page.getByText('Canvas note',{exact:true}).count(),0);
  await page.getByRole('tab',{name:/Docs & Plans/}).click();assert.equal(await page.getByPlaceholder('Document Title...').inputValue(),'Document B');
  pauseOldDocs=true;oldDocsResponse=new Promise(resolve=>{releaseOldDocs=resolve;});oldDocsSignal=new Promise(resolve=>{oldDocsStarted=resolve;});
  await page.locator('.sidebar-project-item').filter({hasText:'Project A'}).click();await oldDocsSignal;
  await page.locator('.sidebar-project-item').filter({hasText:'Project B'}).click();await page.getByText('Board B',{exact:true}).waitFor();
  const oldReturned=page.waitForResponse(response=>response.url().includes('/documents')&&response.url().includes(projects[0].id));releaseOldDocs();await oldReturned;
  await page.getByRole('tab',{name:/Docs & Plans/}).click();assert.equal(await page.getByPlaceholder('Document Title...').inputValue(),'Document B');
  
  // Safe fixture coverage: responsive shell, all existing workspaces, dialog keyboard, theme persistence.
  for (const width of [1440,1024,768,360]) {
    await page.setViewportSize({width,height:900});
    if(width<768) await page.locator('.orca-sidebar.collapsed').waitFor({state:'attached'});
    const nav=async (text)=>{
      if(width<768 && await page.locator('.orca-sidebar.collapsed').count()) await page.getByRole('button',{name:'Buka Sidebar',exact:true}).click();
      await page.locator('.sidebar-nav-item').filter({hasText:text}).click();
    };
    const project=async()=>{
      if(width<768 && await page.locator('.orca-sidebar.collapsed').count()) await page.getByRole('button',{name:'Buka Sidebar',exact:true}).click();
      await page.locator('.sidebar-project-item').filter({hasText:'Project B'}).click();
    };
    await project();await page.getByRole('tab',{name:/Board/}).click();await page.getByText('Board B',{exact:true}).waitFor();
    for(const tab of ['Docs & Plans','Tasks','Board']) {
      await page.getByRole('tab',{name:new RegExp(tab)}).click();
      assert.equal(await page.getByRole('tab',{name:new RegExp(tab)}).getAttribute('aria-selected'),'true');
      await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});await page.screenshot({path:path.join(output,`after-${tab==='Docs & Plans'?'documents':tab.toLowerCase()}-${width}.png`)});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`page overflow ${tab} ${width}`);
    }
    await nav('Inbox');await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});await page.screenshot({path:path.join(output,`after-inbox-${width}.png`)});
    await nav('Calendar');await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});await page.screenshot({path:path.join(output,`after-calendar-${width}.png`)});
    if(width<768){
      const trigger=page.getByRole('button',{name:'Buka Sidebar',exact:true});await trigger.click();
      await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});await page.screenshot({path:path.join(output,'after-drawer-mobile.png')});
      await page.keyboard.press('Escape');assert.equal(await page.locator('.orca-sidebar.collapsed').count(),1);
      await page.waitForFunction(()=>document.activeElement?.classList.contains('sidebar-toggle-floating-btn'));assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
    }
    await page.keyboard.press('Control+k');
    await page.getByRole('dialog').waitFor();
    await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});await page.screenshot({path:path.join(output,`after-capture-${width}.png`)});
    await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')),true);
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  }
  await page.setViewportSize({width:1440,height:1000});await page.locator('.orca-sidebar:not(.collapsed)').waitFor();
  await page.locator('.sidebar-project-item').filter({hasText:'Project B'}).click();
  await page.getByRole('tab',{name:/Docs & Plans/}).click();await page.getByLabel('Document content').fill('Edited safe fixture');
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>document.querySelector('textarea')?.value==='Edited safe fixture');
  assert(writes.some(w=>w.endpoint.startsWith('/documents/')&&w.body.content==='Edited safe fixture'));
  await page.getByRole('tab',{name:/Tasks/}).click();await page.getByRole('button',{name:'New Task',exact:true}).click();
  await page.getByLabel('Task Title',{exact:true}).fill('Verify the refreshed workspace');await page.getByLabel('Due Date (Optional)',{exact:true}).fill('2026-10-10');await page.getByRole('button',{name:'Create Task',exact:true}).click();
  await page.getByText('Verify the refreshed workspace',{exact:true}).first().waitFor();assert(writes.some(w=>w.endpoint==='/tasks'&&w.body.title==='Verify the refreshed workspace'&&w.body.due_date==='2026-10-10T00:00:00Z'));
  await page.getByRole('tab',{name:/Board/}).click();await page.getByText('Board B',{exact:true}).click();await page.getByText('Canvas note',{exact:true}).waitFor();
  await page.getByText('Canvas note',{exact:true}).click();await page.locator('.canvas-context-toolbar').waitFor();
  await page.keyboard.press('Delete');await page.getByText('Canvas note',{exact:true}).waitFor({state:'hidden'});
  await page.keyboard.press('Control+z');await page.getByText('Canvas note',{exact:true}).waitFor();
  assert(writes.some(w=>w.method==='POST'&&w.endpoint.endsWith('/restore')));
  await page.keyboard.press('Control+y');await page.getByText('Canvas note',{exact:true}).waitFor({state:'hidden'});
  await page.keyboard.press('Control+z');await page.getByText('Canvas note',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Zoom Out/}).click();assert.equal(await page.locator('.tool-zoom-badge').textContent().then(t=>t.includes('90%')),true);
  await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});await page.screenshot({path:path.join(output,'after-canvas-desktop.png')});
  await page.setViewportSize({width:360,height:800});await page.locator('.orca-sidebar.collapsed').waitFor({state:'attached'});await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});await page.screenshot({path:path.join(output,'after-canvas-mobile.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:1440,height:1000});await page.locator('.orca-sidebar:not(.collapsed)').waitFor();await page.getByTitle('Kembali ke galeri board',{exact:true}).click();
  await page.keyboard.press('Control+k');await page.getByRole('dialog').locator('textarea').fill('A safe captured idea');await page.getByRole('button',{name:'Simpan ke Inbox',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  assert(writes.some(w=>w.endpoint==='/inbox'&&w.body.content==='A safe captured idea'));
    await page.getByTitle('Dark Theme',{exact:true}).click();
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});await page.screenshot({path:path.join(output,'after-dark-desktop.png')});
  await page.setViewportSize({width:360,height:800});await page.locator('.orca-sidebar.collapsed').waitFor({state:'attached'});await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});await page.screenshot({path:path.join(output,'after-dark-mobile.png')});await page.setViewportSize({width:1440,height:1000});await page.locator('.orca-sidebar:not(.collapsed)').waitFor();await page.getByTitle('Light Theme',{exact:true}).click();
  await page.getByRole('button',{name:'Edit Profil',exact:true}).click();
  await page.getByRole('dialog',{name:'Edit Profil'}).waitFor();
  await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))});await page.screenshot({path:path.join(output,'after-settings-desktop.png')});await page.keyboard.press('Escape');
  const auth=await browser.newPage({viewport:{width:360,height:800},colorScheme:'dark',reducedMotion:'reduce'});
  await auth.goto(`http://127.0.0.1:${server.address().port}`);
  assert.equal(await auth.locator('html').getAttribute('data-theme'),'light','new preferences default to light regardless of OS');
  await auth.screenshot({path:path.join(output,'after-login-mobile.png')});
  await auth.getByRole('tab',{name:'Daftar Baru'}).click();await auth.screenshot({path:path.join(output,'after-register-mobile.png')});
  assert.equal(await auth.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await auth.close();
  console.log('Redesign checks passed: four viewports, all panels, drawer Escape/focus return, dialog focus, theme persistence and auth default.');
  assert.deepEqual(errors,[]);console.log('Frontend smoke passed: authenticated shell, docs, tasks, canvas, project switching, and delayed stale responses.');
 }finally{await browser.close();server.close();}
})().catch(err=>{console.error(err);server.close();process.exitCode=1;});


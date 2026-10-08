const fs=require('fs');const path=require('path');const http=require('http');const assert=require('assert/strict');
const {chromium}=require(process.env.ORCA_PLAYWRIGHT_MODULE||'playwright');
const dist=path.resolve('web/dist');
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
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({profile})=>{localStorage.setItem('orca_auth_token','smoke-token');localStorage.setItem('orca_current_user',JSON.stringify({...profile,name:profile.full_name}));},{profile});
  await page.route('**/api/v1/**',async route=>{
   const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api/v1','');let data=[];
   if(endpoint==='/auth/me')data=profile;
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
  await page.locator('.sidebar-project-item').filter({hasText:'Project A'}).click();
  await page.getByText('Board A',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Docs & Plans/}).click();
  await page.getByPlaceholder('Document Title...').waitFor();assert.equal(await page.getByPlaceholder('Document Title...').inputValue(),'Document A');
  await page.getByRole('button',{name:/Tasks/}).first().click();await page.getByText('Task A',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:/Board/}).first().click();await page.getByText('Board A',{exact:true}).click();await page.getByText('Canvas note',{exact:true}).waitFor();
  await page.locator('.sidebar-project-item').filter({hasText:'Project B'}).click();await page.getByText('Board B',{exact:true}).waitFor();
  assert.equal(await page.getByText('Canvas note',{exact:true}).count(),0);
  await page.getByRole('button',{name:/Docs & Plans/}).click();assert.equal(await page.getByPlaceholder('Document Title...').inputValue(),'Document B');
  pauseOldDocs=true;oldDocsResponse=new Promise(resolve=>{releaseOldDocs=resolve;});oldDocsSignal=new Promise(resolve=>{oldDocsStarted=resolve;});
  await page.locator('.sidebar-project-item').filter({hasText:'Project A'}).click();await oldDocsSignal;
  await page.locator('.sidebar-project-item').filter({hasText:'Project B'}).click();await page.getByText('Board B',{exact:true}).waitFor();
  const oldReturned=page.waitForResponse(response=>response.url().includes('/documents')&&response.url().includes(projects[0].id));releaseOldDocs();await oldReturned;
  await page.getByRole('button',{name:/Docs & Plans/}).click();assert.equal(await page.getByPlaceholder('Document Title...').inputValue(),'Document B');
  assert.deepEqual(errors,[]);console.log('Frontend smoke passed: authenticated shell, docs, tasks, canvas, project switching, and delayed stale responses.');
 }finally{await browser.close();server.close();}
})().catch(err=>{console.error(err);server.close();process.exitCode=1;});


const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const {PGlite}=require(process.cwd()+'/bin/migration-check/node_modules/@electric-sql/pglite');
const files=['migrations/000001_init_schema.up.sql','migrations/000002_tenant_integrity.up.sql'];
(async()=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.transaction(async tx=>{for(const file of files)await tx.exec(fs.readFileSync(file,'utf8'));});
  await db.exec(fs.readFileSync('scripts/seed_demo.sql','utf8'));
  const id=()=>crypto.randomUUID(),a=id(),b=id(),sa=id(),sb=id(),pb=id(),tb=id(),bb=id();
  for(const ws of [a,b])await db.query('INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,$2,$4,$3)',[ws,'test',id(),ws]);
  for(const [ws,space]of [[a,sa],[b,sb]])await db.query('INSERT INTO spaces(id,workspace_id,name,slug)VALUES($1,$2,$3,$3)',[space,ws,'test']);
  await db.query('INSERT INTO projects(id,workspace_id,space_id,name)VALUES($1,$2,$3,$4)',[pb,b,sb,'private']);
  await db.query('INSERT INTO tasks(id,workspace_id,space_id,title)VALUES($1,$2,$3,$4)',[tb,b,sb,'private']);
  await db.query('INSERT INTO note_boards(id,workspace_id,space_id,title)VALUES($1,$2,$3,$4)',[bb,b,sb,'private']);
  const invalid=[
   ['INSERT INTO tasks(id,workspace_id,space_id,title)VALUES($1,$2,$3,$4)',[id(),a,sb,'bad space']],
   ['INSERT INTO tasks(id,workspace_id,space_id,project_id,title)VALUES($1,$2,$3,$4,$5)',[id(),a,sa,pb,'bad project']],
   ['INSERT INTO tasks(id,workspace_id,space_id,parent_task_id,title)VALUES($1,$2,$3,$4,$5)',[id(),a,sa,tb,'bad parent']],
   ['INSERT INTO note_blocks(id,workspace_id,board_id,type)VALUES($1,$2,$3,$4)',[id(),a,bb,'text']],
   ['INSERT INTO events(id,workspace_id,linked_task_id,title,start_at,end_at)VALUES($1,$2,$3,$4,NOW(),NOW())',[id(),a,tb,'bad event']],
   ['INSERT INTO entity_links(id,workspace_id,from_type,from_id,to_type,to_id)VALUES($1,$2,$3,$4,$3,$4)',[id(),a,'task',tb]],
  ];
  for(const [sql,args]of invalid)await assert.rejects(db.query(sql,args),err=>['23503','23514'].includes(err.code));
  const own=id();await db.query('INSERT INTO tasks(id,workspace_id,space_id,title)VALUES($1,$2,$3,$4)',[own,a,sa,'valid']);
  await assert.rejects(db.query('UPDATE tasks SET workspace_id=$1 WHERE id=$2',[b,own]),err=>err.code==='23514');
  // Matching tenant but different space must also be rejected by composite project FK.
  const second=id();await db.query('INSERT INTO spaces(id,workspace_id,name,slug)VALUES($1,$2,$3,$3)',[second,b,'second']);
  await assert.rejects(db.query('INSERT INTO tasks(id,workspace_id,space_id,project_id,title)VALUES($1,$2,$3,$4,$5)',[id(),b,second,pb,'wrong space']),err=>err.code==='23503');
  await db.query('UPDATE tasks SET deleted_at=NOW() WHERE id=$1',[tb]);
  await assert.rejects(db.query('INSERT INTO events(id,workspace_id,linked_task_id,title,start_at,end_at)VALUES($1,$2,$3,$4,NOW(),NOW())',[id(),b,tb,'deleted task']),err=>err.code==='23503');
  const legacy=new PGlite();await legacy.waitReady;
  try{
   await legacy.exec(fs.readFileSync(files[0],'utf8'));
   const lA=id(),lB=id(),lSpace=id(),lProject=id();
   for(const ws of [lA,lB])await legacy.query('INSERT INTO workspaces(id,name,slug,owner_id)VALUES($1,$2,$3,$4)',[ws,'legacy',ws,id()]);
   await legacy.query('INSERT INTO spaces(id,workspace_id,name,slug)VALUES($1,$2,$3,$3)',[lSpace,lB,'legacy']);
   await legacy.query('INSERT INTO projects(id,workspace_id,space_id,name)VALUES($1,$2,$3,$4)',[lProject,lA,lSpace,'invalid legacy']);
   await assert.rejects(legacy.transaction(async tx=>{for(const file of files)await tx.exec(fs.readFileSync(file,'utf8'));}),err=>err.code==='23503');
   const rows=await legacy.query('SELECT id FROM projects WHERE id=$1',[lProject]);assert.equal(rows.rows.length,1);
   const constraints=await legacy.query("SELECT 1 FROM pg_constraint WHERE conname='projects_space_tenant'");assert.equal(constraints.rows.length,0);
  }finally{await legacy.close();}
  console.log('PostgreSQL SQL checks passed: fresh migrations, dev seed, tenant/space boundaries, deleted references, immutable tenant, and atomic rollback of invalid legacy data.');
 }finally{await db.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});


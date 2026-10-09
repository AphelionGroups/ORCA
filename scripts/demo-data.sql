-- PostgreSQL / Neon SQL Editor. Run the complete script in one execution.
-- Creates demo@user.com / demouser in a dedicated workspace.
-- Refuses an existing account with this email unless it belongs to this script.
-- Existing demo rows are preserved on rerun, including edits and soft deletions.
BEGIN;
DO $demo$
DECLARE
  demo_email text := 'demo@user.com';
  demo_user uuid := md5('orca-demo-account-v1:user')::uuid;
  demo_workspace uuid := md5('orca-demo-account-v1:workspace')::uuid;
  demo_password_hash text := '$2a$10$vHp7Gn.Wl4CoPRvvOlVzcu4NZWhTaiyCIKMNZXw/VjvveIxFN4tzq';
  demo_timezone text := 'Asia/Jakarta';
  w uuid;
  s uuid; p uuid; b uuid; t uuid; n uuid; next_n uuid;
  anchor date;
  i integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('orca-demo-account-v1',0));
  IF EXISTS(SELECT 1 FROM users WHERE lower(email)=lower(demo_email)
    AND (id<>demo_user OR workspace_id<>demo_workspace OR deleted_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Email demo@user.com already belongs to another or deleted account; no changes made';
  END IF;
  IF EXISTS(SELECT 1 FROM workspaces WHERE id=demo_workspace
    AND (owner_id<>demo_user OR slug<>'orca-demo-account-v1' OR deleted_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Demo workspace identity mismatch or deleted workspace';
  END IF;
  IF EXISTS(SELECT 1 FROM users WHERE id=demo_user
    AND (lower(email)<>lower(demo_email) OR workspace_id<>demo_workspace OR deleted_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Demo user identity mismatch';
  END IF;
  INSERT INTO workspaces(id,name,slug,owner_id)
    VALUES(demo_workspace,'Demo Workspace','orca-demo-account-v1',demo_user)
    ON CONFLICT(id) DO NOTHING;
  INSERT INTO users(id,workspace_id,email,password_hash,full_name,calendar_timezone)
    VALUES(demo_user,demo_workspace,demo_email,demo_password_hash,'Demo User',demo_timezone)
    ON CONFLICT(id) DO NOTHING;
  w := demo_workspace;
  -- Serializes repeated executions for this workspace.
  PERFORM pg_advisory_xact_lock(hashtextextended('orca-demo-v1:' || w::text,0));
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=demo_timezone) THEN
    RAISE EXCEPTION 'Unknown timezone: %',demo_timezone;
  END IF;
  anchor := (now() AT TIME ZONE demo_timezone)::date;
  s := md5(w::text || ':orca-demo-v1:space')::uuid;
  p := md5(w::text || ':orca-demo-v1:project')::uuid;
  b := md5(w::text || ':orca-demo-v1:board')::uuid;
  IF EXISTS (SELECT 1 FROM spaces WHERE workspace_id=w AND slug='orca-demo-v1' AND id<>s) THEN
    RAISE EXCEPTION 'Space slug orca-demo-v1 is already used; no data inserted';
  END IF;
  IF EXISTS (SELECT 1 FROM spaces WHERE id=s AND deleted_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM projects WHERE id=p AND deleted_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM note_boards WHERE id=b AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Demo parent was deleted. Restore it in ORCA before reseeding';
  END IF;
  INSERT INTO spaces(id,workspace_id,name,slug,icon,color)
    VALUES(s,w,'Demo Studio','orca-demo-v1','work','#B2FFA9') ON CONFLICT(id) DO NOTHING;
  INSERT INTO projects(id,workspace_id,space_id,name,description,status,target_date)
    VALUES(p,w,s,'Sunset Coffee Launch','From a brand idea to the launch of a neighborhood coffee shop.','active',
      (anchor+14+time '17:00') AT TIME ZONE demo_timezone) ON CONFLICT(id) DO NOTHING;
  INSERT INTO documents(id,workspace_id,space_id,project_id,title,content,is_pinned)
    VALUES(md5(w::text || ':orca-demo-v1:document')::uuid,w,s,p,'Sunset Coffee Brief',
      E'Sunset Coffee\n\nGoal\nCreate a welcoming coffee shop for meeting and working.\n\nAudience\nCreative professionals and neighbors.\n\nPersonality\nSimple, friendly, and part of everyday life.\n\nLaunch plan\nFinish the visual identity, test the menu, and host a soft opening.\n\nSuccess measure\nGather feedback from the first 20 visitors.',true) ON CONFLICT(id) DO NOTHING;
  INSERT INTO note_boards(id,workspace_id,space_id,project_id,title,viewport_state)
    VALUES(b,w,s,p,'From Idea to Launch','{"x":0,"y":0,"zoom":0.8}') ON CONFLICT(id) DO NOTHING;
  FOR i IN 1..3 LOOP
    n := md5(w::text || ':orca-demo-v1:block:' || i)::uuid;
    INSERT INTO note_blocks(id,workspace_id,board_id,type,pos_x,pos_y,width,height,content)
      VALUES(n,w,b,'card',80+(i-1)*300,120,240,180,
        jsonb_build_object('schema_version',1,'text',
          (ARRAY[E'Brand idea\nA welcoming shop serving local coffee.',E'Experience\nA focused menu and a comfortable space.',E'Launch\nInvite the community to a soft opening.'])[i],
          'color',(ARRAY['#E0F5DD','#FFFFFF','#FFF2D7'])[i])) ON CONFLICT(id) DO NOTHING;
  END LOOP;
  FOR i IN 1..2 LOOP
    n := md5(w::text || ':orca-demo-v1:block:' || i)::uuid;
    next_n := md5(w::text || ':orca-demo-v1:block:' || (i+1))::uuid;
    IF EXISTS(SELECT 1 FROM note_blocks WHERE id=n AND deleted_at IS NULL)
       AND EXISTS(SELECT 1 FROM note_blocks WHERE id=next_n AND deleted_at IS NULL) THEN
      INSERT INTO entity_links(id,workspace_id,from_type,from_id,to_type,to_id,relation_type,metadata)
        VALUES(md5(w::text || ':orca-demo-v1:link:' || i)::uuid,w,'note_block',n,'note_block',next_n,
          'connects_to','{"schema_version":1,"fromSide":"right","toSide":"left"}')
        ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  FOR i IN 1..5 LOOP
    t := md5(w::text || ':orca-demo-v1:task:' || i)::uuid;
    INSERT INTO tasks(id,workspace_id,space_id,project_id,title,description,status,priority,due_date,estimated_minutes)
      VALUES(t,w,s,p,(ARRAY['Write the brand brief','Explore the visual identity','Review the tasting menu','Prepare soft opening invitations','Summarize visitor feedback'])[i],
        'Sample work for the Sunset Coffee demo.',(ARRAY['done','in_progress','in_review','todo','todo'])[i],
        (ARRAY['medium','high','medium','high','low'])[i],
        (anchor+i+time '17:00') AT TIME ZONE demo_timezone,60) ON CONFLICT(id) DO NOTHING;
  END LOOP;
  FOR i IN 1..3 LOOP
    t := md5(w::text || ':orca-demo-v1:task:' || (i+1))::uuid;
    IF EXISTS(SELECT 1 FROM tasks WHERE id=t AND deleted_at IS NULL) THEN
      INSERT INTO events(id,workspace_id,space_id,linked_task_id,title,description,start_at,end_at)
        VALUES(md5(w::text || ':orca-demo-v1:event:' || i)::uuid,w,s,t,
          (ARRAY['Visual exploration session','Team menu review','Soft opening preparation'])[i],
          'Sample schedule; linked tasks can still be managed separately.',
          (anchor+(i-1)+time '09:00') AT TIME ZONE demo_timezone,
          (anchor+(i-1)+time '10:00') AT TIME ZONE demo_timezone) ON CONFLICT(id) DO NOTHING;
    END IF;
  END LOOP;
  FOR i IN 1..3 LOOP
    INSERT INTO inbox_notes(id,workspace_id,content,color)
      VALUES(md5(w::text || ':orca-demo-v1:inbox:' || i)::uuid,w,
        (ARRAY['Idea: host a small coffee tasting every Friday.','Ask for feedback on dairy-free menu options.','Write a short story about local coffee farmers.'])[i], 'default')
      ON CONFLICT(id) DO NOTHING;
  END LOOP;
  RAISE NOTICE 'Demo ready in workspace %. Calendar anchor: % (%)',w,anchor,demo_timezone;
END $demo$;
COMMIT;

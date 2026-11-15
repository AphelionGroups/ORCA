ALTER TABLE tasks ADD COLUMN auto_complete_subtasks boolean NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN completed_by_subtasks boolean NOT NULL DEFAULT false;

-- Preserve existing hierarchies; new links are deliberately limited to one level.
CREATE FUNCTION orca_validate_subtask() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent tasks;
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 IF NEW.parent_task_id IS NOT NULL THEN
  SELECT * INTO parent FROM tasks WHERE workspace_id=NEW.workspace_id AND id=NEW.parent_task_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parent task is unavailable' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' OR NEW.parent_task_id IS DISTINCT FROM OLD.parent_task_id THEN
   IF parent.parent_task_id IS NOT NULL OR EXISTS(SELECT 1 FROM tasks WHERE workspace_id=NEW.workspace_id AND parent_task_id=NEW.id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Subtasks support one level only' USING ERRCODE='23514';
   END IF;
   NEW.space_id := parent.space_id;
   NEW.project_id := parent.project_id;
  ELSIF NEW.space_id IS DISTINCT FROM OLD.space_id OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
   IF NEW.space_id IS DISTINCT FROM parent.space_id OR NEW.project_id IS DISTINCT FROM parent.project_id THEN
    RAISE EXCEPTION 'Detach this subtask before moving it' USING ERRCODE='23514';
   END IF;
  END IF;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.space_id IS DISTINCT FROM OLD.space_id OR NEW.project_id IS DISTINCT FROM OLD.project_id)
 AND EXISTS(SELECT 1 FROM tasks WHERE workspace_id=NEW.workspace_id AND parent_task_id=NEW.id AND deleted_at IS NULL) THEN
  RAISE EXCEPTION 'Detach subtasks before moving their parent' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND (NOT NEW.auto_complete_subtasks OR (NEW.status IS DISTINCT FROM OLD.status AND pg_trigger_depth()=1)) THEN
  NEW.completed_by_subtasks := false;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tasks_validate_subtask BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION orca_validate_subtask();

CREATE FUNCTION orca_reconcile_subtasks(parent_id uuid, ws_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE active_count integer; done_count integer; parent tasks; next_status text; automatic boolean;
BEGIN
 SELECT * INTO parent FROM tasks WHERE workspace_id=ws_id AND id=parent_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT parent.auto_complete_subtasks OR parent.status='cancelled' THEN RETURN; END IF;
 SELECT count(*) FILTER(WHERE status<>'cancelled'), count(*) FILTER(WHERE status='done') INTO active_count,done_count
 FROM tasks WHERE workspace_id=ws_id AND parent_task_id=parent_id AND deleted_at IS NULL;
 next_status := parent.status; automatic := parent.completed_by_subtasks;
 IF active_count>0 AND active_count=done_count AND parent.status<>'done' THEN
  next_status := 'done'; automatic := true;
 ELSIF (active_count=0 OR active_count<>done_count) AND parent.completed_by_subtasks THEN
  next_status := 'in_progress'; automatic := false;
 END IF;
 IF next_status IS DISTINCT FROM parent.status OR automatic IS DISTINCT FROM parent.completed_by_subtasks THEN
  UPDATE tasks SET status=next_status,completed_by_subtasks=automatic,updated_at=clock_timestamp() WHERE workspace_id=ws_id AND id=parent_id;
 END IF;
END $$;

CREATE FUNCTION orca_subtasks_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.parent_task_id IS DISTINCT FROM NEW.parent_task_id AND OLD.parent_task_id IS NOT NULL THEN
  PERFORM orca_reconcile_subtasks(OLD.parent_task_id,NEW.workspace_id);
 END IF;
 IF NEW.parent_task_id IS NOT NULL THEN PERFORM orca_reconcile_subtasks(NEW.parent_task_id,NEW.workspace_id); END IF;
 IF TG_OP='INSERT' OR NEW.auto_complete_subtasks IS DISTINCT FROM OLD.auto_complete_subtasks THEN
  PERFORM orca_reconcile_subtasks(NEW.id,NEW.workspace_id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tasks_subtasks_changed AFTER INSERT OR UPDATE OF status,parent_task_id,deleted_at,auto_complete_subtasks ON tasks
 FOR EACH ROW EXECUTE FUNCTION orca_subtasks_changed();

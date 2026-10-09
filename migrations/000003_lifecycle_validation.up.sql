-- Additive migration: preserve tombstones and enforce new writes without rewriting legacy values.
ALTER TABLE tasks ADD CONSTRAINT tasks_status_valid CHECK(deleted_at IS NOT NULL OR status IN ('todo','in_progress','in_review','done','cancelled')) NOT VALID;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_valid CHECK(deleted_at IS NOT NULL OR priority IN ('low','medium','high','urgent')) NOT VALID;
ALTER TABLE tasks ADD CONSTRAINT tasks_estimate_valid CHECK(deleted_at IS NOT NULL OR estimated_minutes IS NULL OR estimated_minutes >= 0) NOT VALID;
ALTER TABLE events ADD CONSTRAINT events_interval_valid CHECK(deleted_at IS NOT NULL OR end_at > start_at) NOT VALID;
ALTER TABLE entity_links ADD COLUMN deleted_at TIMESTAMPTZ;

-- Cascades are UPDATEs, not physical deletes. All child operations share the parent transaction.
CREATE FUNCTION orca_soft_delete_children() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind TEXT;
BEGIN
 IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='spaces' THEN
  UPDATE events SET deleted_at=NEW.deleted_at,updated_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND space_id=NEW.id AND deleted_at IS NULL;
  UPDATE projects SET deleted_at=NEW.deleted_at,updated_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND space_id=NEW.id AND deleted_at IS NULL;
  UPDATE documents SET deleted_at=NEW.deleted_at,updated_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND space_id=NEW.id AND deleted_at IS NULL;
  UPDATE note_boards SET deleted_at=NEW.deleted_at,updated_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND space_id=NEW.id AND deleted_at IS NULL;
  UPDATE tasks SET deleted_at=NEW.deleted_at,updated_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND space_id=NEW.id AND deleted_at IS NULL;
 ELSIF TG_TABLE_NAME='projects' THEN
  UPDATE documents SET deleted_at=NEW.deleted_at,updated_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND project_id=NEW.id AND deleted_at IS NULL;
  UPDATE note_boards SET deleted_at=NEW.deleted_at,updated_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND project_id=NEW.id AND deleted_at IS NULL;
  UPDATE tasks SET deleted_at=NEW.deleted_at,updated_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND project_id=NEW.id AND deleted_at IS NULL;
 ELSIF TG_TABLE_NAME='note_boards' THEN
  UPDATE note_blocks SET deleted_at=NEW.deleted_at,updated_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND board_id=NEW.id AND deleted_at IS NULL;
 ELSIF TG_TABLE_NAME='tasks' THEN
  UPDATE tasks SET deleted_at=NEW.deleted_at,updated_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND parent_task_id=NEW.id AND deleted_at IS NULL;
  -- Independent appointments survive deleting their linked task.
  UPDATE events SET linked_task_id=NULL,updated_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND linked_task_id=NEW.id AND deleted_at IS NULL;
 END IF;
 kind:=CASE TG_TABLE_NAME WHEN 'documents' THEN 'document' WHEN 'note_boards' THEN 'note_board' WHEN 'note_blocks' THEN 'note_block' WHEN 'tasks' THEN 'task' WHEN 'events' THEN 'event' END;
 IF kind IS NOT NULL THEN
  UPDATE entity_links SET deleted_at=NEW.deleted_at WHERE workspace_id=NEW.workspace_id AND deleted_at IS NULL AND ((from_type=kind AND from_id=NEW.id) OR (to_type=kind AND to_id=NEW.id));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER spaces_soft_delete_children AFTER UPDATE OF deleted_at ON spaces FOR EACH ROW EXECUTE FUNCTION orca_soft_delete_children();
CREATE TRIGGER projects_soft_delete_children AFTER UPDATE OF deleted_at ON projects FOR EACH ROW EXECUTE FUNCTION orca_soft_delete_children();
CREATE TRIGGER boards_soft_delete_children AFTER UPDATE OF deleted_at ON note_boards FOR EACH ROW EXECUTE FUNCTION orca_soft_delete_children();
CREATE TRIGGER tasks_soft_delete_children AFTER UPDATE OF deleted_at ON tasks FOR EACH ROW EXECUTE FUNCTION orca_soft_delete_children();
CREATE TRIGGER documents_soft_delete_links AFTER UPDATE OF deleted_at ON documents FOR EACH ROW EXECUTE FUNCTION orca_soft_delete_children();
CREATE TRIGGER blocks_soft_delete_links AFTER UPDATE OF deleted_at ON note_blocks FOR EACH ROW EXECUTE FUNCTION orca_soft_delete_children();
CREATE TRIGGER events_soft_delete_links AFTER UPDATE OF deleted_at ON events FOR EACH ROW EXECUTE FUNCTION orca_soft_delete_children();

CREATE FUNCTION orca_check_task_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL OR NEW.parent_task_id IS NULL THEN RETURN NEW; END IF;
 IF EXISTS(WITH RECURSIVE ancestors AS (
  SELECT id,parent_task_id FROM tasks WHERE workspace_id=NEW.workspace_id AND id=NEW.parent_task_id
  UNION SELECT t.id,t.parent_task_id FROM tasks t JOIN ancestors a ON t.id=a.parent_task_id WHERE t.workspace_id=NEW.workspace_id
 ) SELECT 1 FROM ancestors WHERE id=NEW.id) THEN
  RAISE EXCEPTION 'Task hierarchy contains a cycle' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tasks_check_cycle BEFORE INSERT OR UPDATE OF parent_task_id ON tasks FOR EACH ROW EXECUTE FUNCTION orca_check_task_cycle();

-- Lock the parent while validating: parent soft-delete cannot race a new child.
CREATE OR REPLACE FUNCTION orca_check_reference(tenant UUID, entity_type TEXT, entity_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE entity_table TEXT; found BOOLEAN;
BEGIN
 IF entity_id IS NULL THEN RETURN; END IF;
 entity_table := CASE entity_type WHEN 'space' THEN 'spaces' WHEN 'project' THEN 'projects' WHEN 'task' THEN 'tasks' WHEN 'document' THEN 'documents' WHEN 'note_board' THEN 'note_boards' WHEN 'note_block' THEN 'note_blocks' WHEN 'event' THEN 'events' END;
 IF entity_table IS NULL THEN RAISE EXCEPTION 'Unsupported entity type' USING ERRCODE='23514'; END IF;
 EXECUTE format('SELECT true FROM %I WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL FOR SHARE',entity_table) INTO found USING tenant,entity_id;
 IF found IS NOT TRUE THEN RAISE EXCEPTION 'Referenced entity does not belong to active workspace' USING ERRCODE='23503'; END IF;
END $$;

-- Repair active descendants of existing tombstones, retaining every record.
UPDATE events e SET deleted_at=NOW(),updated_at=NOW() WHERE e.deleted_at IS NULL AND EXISTS(SELECT 1 FROM spaces s WHERE s.id=e.space_id AND s.deleted_at IS NOT NULL);
UPDATE projects p SET deleted_at=NOW(),updated_at=NOW() WHERE p.deleted_at IS NULL AND EXISTS(SELECT 1 FROM spaces s WHERE s.id=p.space_id AND s.deleted_at IS NOT NULL);
UPDATE documents d SET deleted_at=NOW(),updated_at=NOW() WHERE d.deleted_at IS NULL AND (EXISTS(SELECT 1 FROM spaces s WHERE s.id=d.space_id AND s.deleted_at IS NOT NULL) OR EXISTS(SELECT 1 FROM projects p WHERE p.id=d.project_id AND p.deleted_at IS NOT NULL));
UPDATE note_boards b SET deleted_at=NOW(),updated_at=NOW() WHERE b.deleted_at IS NULL AND (EXISTS(SELECT 1 FROM spaces s WHERE s.id=b.space_id AND s.deleted_at IS NOT NULL) OR EXISTS(SELECT 1 FROM projects p WHERE p.id=b.project_id AND p.deleted_at IS NOT NULL));
UPDATE note_blocks b SET deleted_at=NOW(),updated_at=NOW() WHERE b.deleted_at IS NULL AND EXISTS(SELECT 1 FROM note_boards p WHERE p.id=b.board_id AND p.deleted_at IS NOT NULL);
UPDATE tasks t SET deleted_at=NOW(),updated_at=NOW() WHERE t.deleted_at IS NULL AND (EXISTS(SELECT 1 FROM spaces s WHERE s.id=t.space_id AND s.deleted_at IS NOT NULL) OR EXISTS(SELECT 1 FROM projects p WHERE p.id=t.project_id AND p.deleted_at IS NOT NULL) OR EXISTS(SELECT 1 FROM tasks p WHERE p.id=t.parent_task_id AND p.deleted_at IS NOT NULL));
UPDATE events e SET linked_task_id=NULL,updated_at=NOW() WHERE e.deleted_at IS NULL AND EXISTS(SELECT 1 FROM tasks t WHERE t.id=e.linked_task_id AND t.deleted_at IS NOT NULL);
UPDATE entity_links l SET deleted_at=NOW() WHERE l.deleted_at IS NULL AND EXISTS(
 SELECT 1 FROM (
  SELECT workspace_id,id,'document' AS kind FROM documents WHERE deleted_at IS NOT NULL
  UNION ALL SELECT workspace_id,id,'note_board' FROM note_boards WHERE deleted_at IS NOT NULL
  UNION ALL SELECT workspace_id,id,'note_block' FROM note_blocks WHERE deleted_at IS NOT NULL
  UNION ALL SELECT workspace_id,id,'task' FROM tasks WHERE deleted_at IS NOT NULL
  UNION ALL SELECT workspace_id,id,'event' FROM events WHERE deleted_at IS NOT NULL
 ) tombstone WHERE tombstone.workspace_id=l.workspace_id AND ((tombstone.id=l.from_id AND tombstone.kind=l.from_type) OR (tombstone.id=l.to_id AND tombstone.kind=l.to_type))
);
CREATE INDEX tasks_active_parent ON tasks(workspace_id,parent_task_id) WHERE deleted_at IS NULL AND parent_task_id IS NOT NULL;
CREATE INDEX events_active_task ON events(workspace_id,linked_task_id) WHERE deleted_at IS NULL AND linked_task_id IS NOT NULL;

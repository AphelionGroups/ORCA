-- Audit legacy records before adding constraints. Migration rolls back on any mismatch.
CREATE UNIQUE INDEX spaces_tenant_id ON spaces(workspace_id,id);
CREATE UNIQUE INDEX projects_tenant_space_id ON projects(workspace_id,space_id,id);
CREATE UNIQUE INDEX tasks_tenant_id ON tasks(workspace_id,id);
CREATE UNIQUE INDEX boards_tenant_id ON note_boards(workspace_id,id);
ALTER TABLE projects ADD CONSTRAINT projects_space_tenant FOREIGN KEY(workspace_id,space_id) REFERENCES spaces(workspace_id,id) ON DELETE CASCADE;
ALTER TABLE documents ADD CONSTRAINT documents_space_tenant FOREIGN KEY(workspace_id,space_id) REFERENCES spaces(workspace_id,id) ON DELETE CASCADE;
ALTER TABLE documents ADD CONSTRAINT documents_project_scope FOREIGN KEY(workspace_id,space_id,project_id) REFERENCES projects(workspace_id,space_id,id) ON DELETE SET NULL (project_id);
ALTER TABLE note_boards ADD CONSTRAINT note_boards_space_tenant FOREIGN KEY(workspace_id,space_id) REFERENCES spaces(workspace_id,id) ON DELETE CASCADE;
ALTER TABLE note_boards ADD CONSTRAINT note_boards_project_scope FOREIGN KEY(workspace_id,space_id,project_id) REFERENCES projects(workspace_id,space_id,id) ON DELETE SET NULL (project_id);
ALTER TABLE tasks ADD CONSTRAINT tasks_space_tenant FOREIGN KEY(workspace_id,space_id) REFERENCES spaces(workspace_id,id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT tasks_project_scope FOREIGN KEY(workspace_id,space_id,project_id) REFERENCES projects(workspace_id,space_id,id) ON DELETE SET NULL (project_id);
ALTER TABLE note_blocks ADD CONSTRAINT blocks_board_tenant FOREIGN KEY(workspace_id,board_id) REFERENCES note_boards(workspace_id,id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT tasks_parent_tenant FOREIGN KEY(workspace_id,parent_task_id) REFERENCES tasks(workspace_id,id) ON DELETE CASCADE;
ALTER TABLE events ADD CONSTRAINT events_space_tenant FOREIGN KEY(workspace_id,space_id) REFERENCES spaces(workspace_id,id) ON DELETE SET NULL (space_id);
ALTER TABLE events ADD CONSTRAINT events_task_tenant FOREIGN KEY(workspace_id,linked_task_id) REFERENCES tasks(workspace_id,id) ON DELETE SET NULL (linked_task_id);
-- Refuse case-insensitive duplicates; operator resolves existing duplicates explicitly.
CREATE UNIQUE INDEX users_email_case_insensitive ON users(lower(email));

-- Reject references to deleted entities and protect polymorphic entity links.
CREATE FUNCTION orca_check_reference(tenant UUID, entity_type TEXT, entity_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE entity_table TEXT; found BOOLEAN;
BEGIN
 IF entity_id IS NULL THEN RETURN; END IF;
 entity_table := CASE entity_type WHEN 'space' THEN 'spaces' WHEN 'project' THEN 'projects' WHEN 'task' THEN 'tasks' WHEN 'document' THEN 'documents' WHEN 'note_board' THEN 'note_boards' WHEN 'note_block' THEN 'note_blocks' WHEN 'event' THEN 'events' END;
 IF entity_table IS NULL THEN RAISE EXCEPTION 'Unsupported entity type' USING ERRCODE='23514'; END IF;
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL)',entity_table) INTO found USING tenant,entity_id;
 IF NOT found THEN RAISE EXCEPTION 'Referenced entity does not belong to active workspace' USING ERRCODE='23503'; END IF;
END $$;
-- Audit existing polymorphic links too; never silently delete or rewrite user data.
DO $$ DECLARE link RECORD; BEGIN
 FOR link IN SELECT * FROM entity_links LOOP
  PERFORM orca_check_reference(link.workspace_id,link.from_type,link.from_id);
  PERFORM orca_check_reference(link.workspace_id,link.to_type,link.to_id);
 END LOOP;
END $$;
CREATE FUNCTION orca_validate_relations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE data JSONB;
BEGIN
 IF TG_OP='UPDATE' AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN RAISE EXCEPTION 'Workspace cannot be changed' USING ERRCODE='23514'; END IF;
 data := to_jsonb(NEW);
 -- Soft deletion itself must remain possible when parent data has been deleted.
 IF TG_OP='UPDATE' AND data->>'deleted_at' IS NOT NULL THEN RETURN NEW; END IF;
 PERFORM orca_check_reference(NEW.workspace_id,'space',(data->>'space_id')::uuid);
 PERFORM orca_check_reference(NEW.workspace_id,'project',(data->>'project_id')::uuid);
 PERFORM orca_check_reference(NEW.workspace_id,'note_board',(data->>'board_id')::uuid);
 PERFORM orca_check_reference(NEW.workspace_id,'task',(data->>'linked_task_id')::uuid);
 PERFORM orca_check_reference(NEW.workspace_id,'task',(data->>'parent_task_id')::uuid);
 IF TG_TABLE_NAME='entity_links' THEN
  PERFORM orca_check_reference(NEW.workspace_id,NEW.from_type,NEW.from_id);
  PERFORM orca_check_reference(NEW.workspace_id,NEW.to_type,NEW.to_id);
 END IF;
 IF TG_TABLE_NAME='tasks' AND (data->>'parent_task_id')::uuid=NEW.id THEN RAISE EXCEPTION 'Task cannot be its own parent' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER spaces_validate_relations BEFORE INSERT OR UPDATE ON spaces FOR EACH ROW EXECUTE FUNCTION orca_validate_relations();
CREATE TRIGGER projects_validate_relations BEFORE INSERT OR UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION orca_validate_relations();
CREATE TRIGGER documents_validate_relations BEFORE INSERT OR UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION orca_validate_relations();
CREATE TRIGGER note_boards_validate_relations BEFORE INSERT OR UPDATE ON note_boards FOR EACH ROW EXECUTE FUNCTION orca_validate_relations();
CREATE TRIGGER note_blocks_validate_relations BEFORE INSERT OR UPDATE ON note_blocks FOR EACH ROW EXECUTE FUNCTION orca_validate_relations();
CREATE TRIGGER tasks_validate_relations BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION orca_validate_relations();
CREATE TRIGGER events_validate_relations BEFORE INSERT OR UPDATE ON events FOR EACH ROW EXECUTE FUNCTION orca_validate_relations();
CREATE TRIGGER entity_links_validate_relations BEFORE INSERT OR UPDATE ON entity_links FOR EACH ROW EXECUTE FUNCTION orca_validate_relations();
CREATE TRIGGER inbox_notes_validate_relations BEFORE INSERT OR UPDATE ON inbox_notes FOR EACH ROW EXECUTE FUNCTION orca_validate_relations();

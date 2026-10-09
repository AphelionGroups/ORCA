-- Validation fails atomically if legacy active values need an explicit repair.
-- Deleted legacy records are exempt by the existing CHECK definitions.
ALTER TABLE tasks VALIDATE CONSTRAINT tasks_status_valid;
ALTER TABLE tasks VALIDATE CONSTRAINT tasks_priority_valid;
ALTER TABLE tasks VALIDATE CONSTRAINT tasks_estimate_valid;
ALTER TABLE events VALIDATE CONSTRAINT events_interval_valid;

DO $$ BEGIN
 IF EXISTS (
  SELECT 1 FROM entity_links l
  LEFT JOIN note_blocks a ON a.workspace_id=l.workspace_id AND a.id=l.from_id AND a.deleted_at IS NULL
  LEFT JOIN note_blocks b ON b.workspace_id=l.workspace_id AND b.id=l.to_id AND b.deleted_at IS NULL
  WHERE l.deleted_at IS NULL AND l.relation_type='connects_to'
   AND (l.from_type<>'note_block' OR l.to_type<>'note_block' OR l.from_id=l.to_id OR a.board_id IS NULL OR b.board_id IS NULL OR a.board_id<>b.board_id)
 ) THEN
  RAISE EXCEPTION 'Legacy active connectors require an explicit scope repair' USING ERRCODE='23514';
 END IF;
END $$;

-- Canvas connectors have a narrower scope than cross-domain references.
CREATE FUNCTION orca_validate_connector_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE from_board UUID; to_board UUID;
BEGIN
 IF NEW.deleted_at IS NOT NULL OR NEW.relation_type <> 'connects_to' THEN RETURN NEW; END IF;
 IF NEW.from_type <> 'note_block' OR NEW.to_type <> 'note_block' OR NEW.from_id = NEW.to_id THEN
  RAISE EXCEPTION 'Connector endpoints must be distinct board blocks' USING ERRCODE='23514';
 END IF;
 SELECT board_id INTO from_board FROM note_blocks WHERE workspace_id=NEW.workspace_id AND id=NEW.from_id AND deleted_at IS NULL FOR SHARE;
 SELECT board_id INTO to_board FROM note_blocks WHERE workspace_id=NEW.workspace_id AND id=NEW.to_id AND deleted_at IS NULL FOR SHARE;
 IF from_board IS NULL OR to_board IS NULL OR from_board <> to_board THEN
  RAISE EXCEPTION 'Connector endpoints must belong to the same active board' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER entity_links_connector_scope BEFORE INSERT OR UPDATE ON entity_links FOR EACH ROW EXECUTE FUNCTION orca_validate_connector_scope();

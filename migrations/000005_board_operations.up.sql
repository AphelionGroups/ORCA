ALTER TABLE entity_links ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE FUNCTION orca_touch_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER entity_links_touch BEFORE UPDATE ON entity_links FOR EACH ROW EXECUTE FUNCTION orca_touch_link();

CREATE TABLE board_operations (
 id UUID PRIMARY KEY,
 workspace_id UUID NOT NULL,
 board_id UUID NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('applied','undone')),
 before_snapshot JSONB NOT NULL,
 after_snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 FOREIGN KEY(workspace_id,board_id) REFERENCES note_boards(workspace_id,id)
);
CREATE INDEX board_operations_scope ON board_operations(workspace_id,board_id,created_at DESC);

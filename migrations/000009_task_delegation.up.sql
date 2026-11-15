ALTER TABLE tasks ADD COLUMN delegated_to varchar(255);
ALTER TABLE tasks ADD COLUMN follow_up_date date;
ALTER TABLE tasks ADD COLUMN delegation_note text;
ALTER TABLE tasks ADD CONSTRAINT tasks_delegation_valid CHECK (
 (delegated_to IS NULL AND follow_up_date IS NULL AND delegation_note IS NULL)
 OR (delegated_to IS NOT NULL AND length(btrim(delegated_to)) > 0
     AND (delegation_note IS NULL OR length(delegation_note) <= 4000))
);
CREATE INDEX tasks_open_follow_up ON tasks(workspace_id,follow_up_date,id)
 WHERE deleted_at IS NULL AND delegated_to IS NOT NULL AND status NOT IN ('done','cancelled');

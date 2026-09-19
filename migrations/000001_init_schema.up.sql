-- =========================================================
-- ORCA: 000001_init_schema.up.sql
-- Initial schema migration for Personal & Business OS
-- =========================================================

-- Enable uuid extensions if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. WORKSPACES (Tenant Boundary)
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. SPACES (Context Isolation: Kantor, Pribadi, Bisnis A, Bisnis B)
CREATE TABLE IF NOT EXISTS spaces (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT 'briefcase',
    color VARCHAR(20) DEFAULT '#3b82f6',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT unique_space_slug_per_workspace UNIQUE(workspace_id, slug)
);

-- 4. PROJECTS (Project Hub Container)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'planning', 'active', 'on_hold', 'completed', 'archived'
    target_date TIMESTAMPTZ,
    kanban_columns JSONB NOT NULL DEFAULT '["Backlog", "Todo", "In Progress", "Done"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 5. DOCUMENTS (Strategy, Brand Guidelines, PRD, Activity Plan, SOP)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    doc_type VARCHAR(50) NOT NULL DEFAULT 'general', -- 'brand_guideline', 'prd', 'activity_plan', 'sop', 'general'
    content TEXT NOT NULL DEFAULT '',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6. NOTE BOARDS (Milanote Spatial Canvas)
CREATE TABLE IF NOT EXISTS note_boards (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    viewport_state JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 7. NOTE BLOCKS (Canvas Nodes: sticky, text, card, image, task_embed)
CREATE TABLE IF NOT EXISTS note_blocks (
    id UUID PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES note_boards(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'sticky', 'text', 'card', 'image', 'task_embed'
    pos_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    width DOUBLE PRECISION,
    height DOUBLE PRECISION,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 8. TASKS (Action Execution & Inbox & Daily Focus)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- NULL = In Space Inbox
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE, -- Subtasks
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'todo', -- 'todo', 'in_progress', 'done', 'cancelled'
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    due_date TIMESTAMPTZ,
    planned_date DATE,
    estimated_minutes INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 9. EVENTS (Calendar & Time-Blocking)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
    linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    external_provider VARCHAR(50), -- 'google_calendar'
    external_event_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 10. ENTITY LINKS (Universal Polymorphic Cross-Link Engine)
CREATE TABLE IF NOT EXISTS entity_links (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    from_type VARCHAR(50) NOT NULL, -- 'document', 'note_block', 'task', 'event', 'note_board'
    from_id UUID NOT NULL,
    to_type VARCHAR(50) NOT NULL,
    to_id UUID NOT NULL,
    relation_type VARCHAR(50) NOT NULL DEFAULT 'relates_to', -- 'converted_to', 'connects_to', 'blocks', 'timeblocks'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_entity_link UNIQUE(workspace_id, from_type, from_id, to_type, to_id, relation_type)
);

-- =========================================================
-- INDEXES FOR FAST RETRIEVAL AND TENANT ISOLATION
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_spaces_workspace_id ON spaces(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_workspace_space ON projects(workspace_id, space_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_workspace_space ON documents(workspace_id, space_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_note_boards_workspace_space ON note_boards(workspace_id, space_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_note_blocks_board_id ON note_blocks(board_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_planned ON tasks(workspace_id, planned_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_space_status ON tasks(workspace_id, space_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_workspace_timerange ON events(workspace_id, start_at, end_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entity_links_from ON entity_links(workspace_id, from_type, from_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_to ON entity_links(workspace_id, to_type, to_id);

-- =========================================================
-- ORCA Seed Script: Spaces, Projects, Docs, Tasks, Boards, Events
-- =========================================================

-- 1. SPACES
INSERT INTO spaces (id, workspace_id, name, slug, icon, color, sort_order, created_at, updated_at)
VALUES 
    ('018f0000-0000-7000-8000-000000000010', '018f0000-0000-7000-8000-000000000001', 'Kantor', 'kantor', 'briefcase', '#8b8df8', 1, NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000020', '018f0000-0000-7000-8000-000000000001', 'Pribadi', 'pribadi', 'user', '#cebdff', 2, NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000030', '018f0000-0000-7000-8000-000000000001', 'Bisnis A', 'bisnis-a', 'rocket', '#44e1de', 3, NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000040', '018f0000-0000-7000-8000-000000000001', 'Bisnis B', 'bisnis-b', 'layers', '#00c5c2', 4, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    slug = EXCLUDED.slug, 
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order;

-- 2. PROJECTS (under Bisnis A)
INSERT INTO projects (id, workspace_id, space_id, name, description, status, target_date, kanban_columns, created_at, updated_at)
VALUES 
    ('018f0000-0000-7000-8000-000000000100', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', 'Rebranding & Launch', 'Luxury hardware & software design ecosystem overhaul and flagship launch readiness.', 'active', '2026-10-31T23:59:59Z', '["backlog", "in_progress", "in_review", "done"]'::jsonb, NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000101', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', 'Packaging CAD & Specs', 'Carton die-cuts, tactile finishing, and factory unboxing experience.', 'planning', '2026-11-15T23:59:59Z', '["backlog", "in_progress", "done"]'::jsonb, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description, 
    status = EXCLUDED.status;

-- 3. DOCUMENTS (under Rebranding & Launch)
INSERT INTO documents (id, workspace_id, space_id, project_id, title, doc_type, content, is_pinned, created_at, updated_at)
VALUES 
    ('018f0000-0000-7000-8000-000000000200', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', '018f0000-0000-7000-8000-000000000100', 'Brand Identity & Strategy', 'strategy', 'The core identity architecture pivots on three structural pillars: Restraint, Material Honesty, and Spatial Cohesion.', true, NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000201', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', '018f0000-0000-7000-8000-000000000100', 'Packaging Visual Hierarchy & Specs', 'specs', 'Spot varnishes, box-die cut margin with luxury tactile feeling. Directly linked to factory sprint.', false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. NOTE BOARD & BLOCKS (Milanote Canvas under Rebranding & Launch)
INSERT INTO note_boards (id, workspace_id, space_id, project_id, title, viewport_state, created_at, updated_at)
VALUES 
    ('018f0000-0000-7000-8000-000000000300', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', '018f0000-0000-7000-8000-000000000100', '01 Brand Strategy & Ideation', '{"x": 0, "y": 0, "zoom": 100}'::jsonb, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO note_blocks (id, board_id, workspace_id, type, pos_x, pos_y, width, height, content, created_at, updated_at)
VALUES 
    ('018f0000-0000-7000-8000-000000000301', '018f0000-0000-7000-8000-000000000300', '018f0000-0000-7000-8000-000000000001', 'card', 60, 150, 310, 230, '{"title": "Brand Identity Core Pillars", "body": "Synthesize architectural brutalism with Nordic luxury restraint. Pure Obsidian base tone with secondary neon accents."}'::jsonb, NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000302', '018f0000-0000-7000-8000-000000000300', '018f0000-0000-7000-8000-000000000001', 'card', 440, 140, 320, 230, '{"title": "CAD Packaging Specifications", "body": "Spot varnishes, box-die cut margin with luxury tactile feeling. Directly linked to factory sprint."}'::jsonb, NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000303', '018f0000-0000-7000-8000-000000000300', '018f0000-0000-7000-8000-000000000001', 'sticky', 840, 140, 320, 230, '{"title": "Packaging Visual Hierarchy & Specs", "body": "Align typographic contrast and box-die cut margin with luxury voice."}'::jsonb, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 5. TASKS (Project Tasks + Inbox Tasks)
INSERT INTO tasks (id, workspace_id, space_id, project_id, title, description, status, priority, due_date, created_at, updated_at)
VALUES 
    -- Project Tasks (project_id IS NOT NULL)
    ('018f0000-0000-7000-8000-000000000401', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', '018f0000-0000-7000-8000-000000000100', 'Competitor Typography Benchmark', 'Catalog variable weights and optical foundry licenses across premier Nordic industrial brands.', 'todo', 'low', NOW() + INTERVAL '5 days', NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000402', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', '018f0000-0000-7000-8000-000000000100', 'Finalize Packaging Print Specs', 'Review pantone spot varnishes, foil clearances, and cardboard tensile metrics.', 'in_progress', 'urgent', NOW() + INTERVAL '1 day', NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000403', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', '018f0000-0000-7000-8000-000000000100', 'Brand Identity Guidelines v1.2', 'Comprehensive token mapping, sub-brand co-existence hierarchy, and editorial layout.', 'in_progress', 'high', NOW() + INTERVAL '3 days', NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000404', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', '018f0000-0000-7000-8000-000000000100', 'Core Value Pillars Definition', 'Consolidate executive feedback into 3 foundational brand attributes: Precision, Clarity, Restraint.', 'done', 'medium', NOW() - INTERVAL '2 days', NOW(), NOW()),
    
    -- Inbox Tasks (project_id IS NULL -> Inbox triage)
    ('018f0000-0000-7000-8000-000000000410', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', NULL, 'Review packaging cardboard tensile test specifications', 'Confirm spot varnishes and embossed foil clearances before sending CAD to factory.', 'todo', 'high', NULL, NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000411', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000010', NULL, 'Idea: Single-stroke Bézier smoothing algorithm for stylus pen', 'Explore Catmull-Rom spline tension parameter vs Chaikin corner rounding.', 'todo', 'medium', NULL, NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000412', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000020', NULL, 'Draft Q3 personal biometric health review notes', 'Sleep latency metrics and VO2 max trend analysis.', 'todo', 'low', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. CALENDAR EVENTS
INSERT INTO events (id, workspace_id, space_id, linked_task_id, title, description, start_at, end_at, is_all_day, created_at, updated_at)
VALUES 
    ('018f0000-0000-7000-8000-000000000501', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', '018f0000-0000-7000-8000-000000000402', 'Rebranding Presentation Deck', 'Review deck with design leads', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour', false, NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000502', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000030', NULL, 'Packaging CAD & Material Signoff', 'Finalize physical sample tolerances', NOW() + INTERVAL '3 hours', NOW() + INTERVAL '5 hours', false, NOW(), NOW()),
    ('018f0000-0000-7000-8000-000000000503', '018f0000-0000-7000-8000-000000000001', '018f0000-0000-7000-8000-000000000010', NULL, 'Sprint Architecture Sync', 'Weekly team architecture alignment', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

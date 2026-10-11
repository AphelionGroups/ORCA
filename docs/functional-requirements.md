# Functional Requirements Specification

This document defines the functional requirements for **ORCA**, encompassing both the **Core MVP (v0.1)** deliverables and the **Extended Roadmap (v0.2+)**.

---

## 1. Core MVP Functional Requirements (v0.1)

### Module 1: Workspace & Authentication (FR-AUTH)
- **FR-AUTH-01 (Self-Serve Authentication):** Users can register (sign up) and authenticate (sign in) using email and password credentials.
- **FR-AUTH-02 (Session / Token):** The system issues secure HTTP-only session cookies or signed JWT tokens.
- **FR-AUTH-03 (Tenant Scoping):** Every data transaction (queries and mutations) must be strictly partitioned by `workspace_id`. Users possess one default personal workspace.

### Module 2: Spaces & Multi-Domain Contexts (FR-SPACE)
- **FR-SPACE-01 (Space Management):** Users can create, update, and manage multiple Spaces representing distinct life roles (default examples: `🏢 Day Job`, `👤 Personal`, `🚀 Venture A`, `📈 Venture B`).
- **FR-SPACE-02 (Context Switcher):** Users can switch focus between Spaces with a single click via sidebar or keyboard shortcuts.
- **FR-SPACE-03 (All-Spaces Unified View):** An aggregated overview mode presenting projects, tasks, and agendas across all Spaces simultaneously.

### Module 3: Quick Capture & Global Inbox (FR-INBOX)
- **FR-INBOX-01 (Global Quick Capture Modal):** A modal triggerable from any screen via global keyboard shortcut (`Ctrl + K` / `Cmd + K`).
- **FR-INBOX-02 (Rapid Thought Ingestion):** Users can capture raw ideas, thoughts, or tasks in seconds without being forced to categorize them immediately.
- **FR-INBOX-03 (Inbox Triage):** A dedicated Inbox triage view to process and assign captured items to appropriate Spaces or Projects at a later time.

### Module 4: Project Hub (FR-HUB)
- **FR-HUB-01 (Unified Initiative Container):** Every Project serves as an integrated workspace container featuring 3 core views/tabs:
  1. **Docs & Plans** Tab (Documentation & Strategy)
  2. **Board** Tab (Visual Canvas & Brainstorming)
  3. **Tasks** Tab (Execution via Kanban & List)
- **FR-HUB-02 (Status & Metadata):** Users can manage project status (`planning`, `active`, `on_hold`, `completed`, `archived`) and bind target milestone deadlines.

### Module 5: Documents & Business Knowledge (FR-DOC)
- **FR-DOC-01 (Long-form Rich Docs):** Users can author and edit long-form documents using Markdown / Rich Text for:
  - *Brand Guidelines* (visual identity, brand tone, target customer personas).
  - *Product / Feature Planning* (PRD, technical specs, user requirements).
  - *Activity Plans* (campaign roadmaps, release timelines, operational SOPs).
- **FR-DOC-02 (Text-to-Task Conversion):** Users can highlight lines of text within a document to convert them directly into active tasks associated with the project.
- **FR-DOC-03 (Embedded Components):** Documents support embedding task widgets, board links, and interactive checklists.

### Module 6: Task & Project Execution (FR-TASK)
- **FR-TASK-01 (Task Attributes & Creation):** Tasks support the following attributes:
  - Title (mandatory)
  - Description (Markdown formatted)
  - Status (`todo`, `in_progress`, `in_review`, `done`, `cancelled`)
  - Priority (`low`, `medium`, `high`, `urgent`)
  - Due date
  - Estimated duration (in minutes, required for calendar time-blocking)
- **FR-TASK-02 (List View):** Users can view tasks grouped by status, priority, project, or space, with sorting and filtering options.
- **FR-TASK-03 (Kanban Board View):** Drag-and-drop state transitions between Kanban columns.
- **FR-TASK-04 (Subtasks):** Nested hierarchical subtasks within a parent task.

### Module 7: Calendar, Time-Blocking & Daily Rituals (FR-CAL)
- **FR-CAL-01 (Unified Calendar View):** Schedule views in Month, Week, and Day modes combining events across all Spaces into one timeline.
- **FR-CAL-02 (External Calendar Sync):** 1-way synchronization engine pulling external calendars (Google Calendar via OAuth2) into ORCA's schedule.
- **FR-CAL-03 (Drag-and-Drop Time-Blocking):** Users can drag tasks from their backlog directly into calendar time slots to reserve focused work periods.
- **FR-CAL-04 (Daily Planning Ritual):**
  - **Morning Planning:** A focused morning drawer interface to select 3–5 top priority tasks across Spaces and schedule them into available calendar slots.
  - **Evening Shutdown:** An end-of-day interface to review completed items and reschedule unfinished work to subsequent days.

### Module 8: Spatial Brainstorming Board & Notes (FR-BOARD)
- **FR-BOARD-01 (Infinite Spatial Canvas):** 2D canvas navigation with smooth pan and zoom controls (scaling from 20% to 200%).
- **FR-BOARD-02 (Draggable Note Cards):** Freeform placement and drag-and-drop repositioning of cards at arbitrary `(x, y)` canvas coordinates.
- **FR-BOARD-03 (Card Content Types):**
  - **Sticky Notes:** Quick notes with custom background colors and author labels.
  - **Text / Rich Note:** Long-form markdown formatted blocks.
  - **Shapes:** Geometric visual blocks with custom styling and text labels.
  - **Task Embed:** Live widgets reflecting active project tasks.
  - **Media / Image Cards:** Visual references and moodboard images via URL or local upload.
- **FR-BOARD-04 (Card-to-Task Conversion):** Instant one-click conversion of brainstorming cards and sticky notes into formal project tasks.
- **FR-BOARD-05 (Connector Lines):** Dynamic SVG relational arrows linking cards to represent user flows, mind maps, and system diagrams.

### Module 9: Cross-Linking & Entity Relations (FR-LINK)
- **FR-LINK-01 (Unified Polymorphic Links):** Bi-directional relational engine linking note cards, documents, tasks, and calendar events.
- **FR-LINK-02 (Backlinks & References Inspector):** Inspect originating documents or board nodes that spawned a given task.

---

## 2. Extended Roadmap Requirements (Post-MVP)

### Module 10: Tablet & Freehand Stylus Input (v0.2)
- **FR-PEN-01 (Stylus Recognition):** Native detection of stylus pointers (`pointerType === 'pen'`) distinct from touch gestures.
- **FR-PEN-02 (Dynamic Pressure Inking):** Smooth digital ink strokes with dynamic pressure response using Bézier curves via `perfect-freehand`.
- **FR-PEN-03 (Natural Palm Rejection):** Automatic rejection of palm contact while writing on tablet displays.
- **FR-PEN-04 (Multi-Touch Gestures):** Seamless 2-finger pan and pinch-to-zoom gestures while dedicating stylus input to freehand sketching.

### Module 11: Local-First & Offline Synchronization (v0.3)
- **FR-SYNC-01 (IndexedDB Local Store):** Instant local persistence of notes, documents, and tasks in client browser storage.
- **FR-SYNC-02 (Offline Capability):** Full read and write capabilities without an active internet connection.
- **FR-SYNC-03 (CRDT / Delta Sync Engine):** Deterministic conflict resolution and automatic background delta synchronization upon reconnection.

### Module 12: AI Intelligence Layer (v0.4)
- **FR-AI-01 (Daily Briefing):** Automated synthesis of calendar events and pending tasks into a prioritized morning briefing.
- **FR-AI-02 (Business Document Synthesis):** Automated extraction of action items and executive summaries from strategic documents and moodboards.
- **FR-AI-03 (Natural Language Task Creation):** Natural language parsing (*"Schedule a 1-hour review of Venture A roadmap tomorrow at 3 PM"*) to create and time-block tasks.

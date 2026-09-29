# Context & Design Philosophy

This document outlines the background, core problems addressed, architectural principles, and long-term vision of the **ORCA** project.

---

## 1. Background & Problem Statement

Founders, makers, engineers, and modern multi-disciplinary professionals confront two overarching challenges every day:

### A. Tool Fragmentation
Work and cognition are scattered across disconnected single-purpose applications:
- **Task & Issue Trackers:** Linear or Todoist for managing execution items.
- **Calendar:** Google Calendar for meetings and time allocation.
- **Brainstorming & Visual Thinking:** Milanote, Miro, or Apple Freeform for arranging visual references, moodboards, and idea graphs.
- **Notes & Documentation:** Notion or Obsidian for long-form documentation, brand guidelines, and SOPs.

### B. The Cognitive Load of Multi-Domain Life
Professionals frequently operate across multiple distinct life roles simultaneously:
- **🏢 Day Job (Employment / Corporate Role)**
- **👤 Personal Life (Health, Finances, Family, Hobbies)**
- **🚀 Venture A (Digital Products / Agency)**
- **📈 Venture B (E-Commerce / Creator Business)**

This creates fundamental friction:
1. **Need for Context Isolation:** During working hours, focus must not be derailed by side-business notifications. On weekends, work backlogs should remain hidden.
2. **Unified Real-World Time:** While contexts are distinct, physical time is singular (24 hours a day). A corporate meeting on Google Calendar physically blocks a time slot that cannot be double-booked by other ventures.
3. **Context Loss Across Mediums:** An idea generated on a visual canvas must be manually transcribed into a strategy document, then re-entered as actionable tasks in a todo list, and finally scheduled into a calendar. Inevitably, critical context evaporates along the way.
4. **SaaS Vendor Lock-in & Privacy Risks:** Strategic business playbooks, internal trade secrets, and personal reflections are fragmented across proprietary cloud vendors without self-hosting guarantees.

---

## 2. ORCA Vision: Personal & Business Operating System

> **"A unified workspace operating system uniting Visual Brainstorming, Business Documentation, Project Management, and Real-Time Scheduling — isolated by domain, unified in time, self-hostable, and AI-ready."**

ORCA bridges the **Three Layers of Human Cognition and Workflow**:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. THINKING LAYER  (Brainstorming & Visual Thinking)        │
│    Spatial Board (Milanote): Raw ideas, moodboards, graphs  │
└──────────────────────────────┬──────────────────────────────┘
                               │ (ideas mature)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. PLANNING LAYER  (Documentation & Strategy)               │
│    Docs & Wikis: Brand specs, PRDs, Activity playbooks      │
└──────────────────────────────┬──────────────────────────────┘
                               │ (broken into actionables)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. DOING LAYER     (Execution & Time Management)            │
│    Tasks + Calendar: Kanban, Lists, Real-time Time-blocking │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Core Design Principles

### A. Spaces Model (Multi-Domain Isolation with Unified Timeline)
- Users partition activities into distinct **Spaces** (`Day Job`, `Personal`, `Venture A`, `Venture B`).
- Each Space maintains isolated documents, spatial boards, projects, and tasks to preserve focus.
- However, all deadlines and time allocations converge into a single **Unified Calendar Timeline**, preventing scheduling conflicts across life domains.

### B. Project Hub Concept (Beyond Simple Todo Lists)
A project in ORCA is a complete initiative container (**Project Hub**) centered around three integrated pillars:
1. **Docs & Plans:** Structured markdown documents (Brand Guidelines, PRDs, Activity playbooks).
2. **Spatial Board:** Freeform visual canvas (Moodboards, architecture schematics, brainstorming cards).
3. **Tasks & Execution:** Kanban boards and checklist items directly linked to document passages and canvas cards.

### C. Rapid Ingestion: Quick Capture & Daily Rituals
- **Quick Capture (`Ctrl+K`):** Instantly captures spontaneous thoughts or tasks into the Inbox within seconds without breaking flow state.
- **Daily Planning Ritual:** A focused 5-minute morning ritual to select cross-domain priority tasks and drag-and-drop them into calendar time-blocks.

### D. Single-Tenant by Default, Multi-Tenant-Ready by Design
- While ORCA is primarily optimized for single-user self-hosting, all database schemas and API middlewares enforce `workspace_id` tenant scoping from day one. This eliminates architectural debt should team collaboration or multi-user hosting be enabled.

### E. Self-Host First-Class Citizen
- Zero reliance on closed proprietary cloud ecosystems.
- Entire stack runs on standard, proven open-source primitives: **Go binary + PostgreSQL + Redis**.
- Packaged with lightweight Docker Compose setups for low-cost VPS and home labs, as well as production **Helm Charts** for Kubernetes (RKE).

### F. Modular Monolith & API-First
- Domain logic is structured cleanly within a modular Go monolith.
- Clients (SolidJS Web, tablets, and future mobile companions) communicate via clean, standard REST APIs.

---

## 4. Product Evolution Roadmap

1. **Phase 1: Personal & Business Dogfooding (MVP v0.1)**  
   Daily-driver readiness: Spaces, Project Hub (Docs + Board + Tasks), Calendar Time-Blocking, and Quick Capture.
2. **Phase 2: Tablet & Freehand Inking (v0.2)**  
   Native stylus and pen support powered by `perfect-freehand` for natural sketching during meetings and brainstorming.
3. **Phase 3: Local-First & Synchronization (v0.3)**  
   Client-side IndexedDB caching and automated CRDT/delta background synchronization for offline resilience.
4. **Phase 4: AI Intelligence Layer (v0.4)**  
   External AI agent worker integration (Letta / Agent Core) for automated daily briefings, document synthesis, and proactive scheduling.
5. **Phase 5: Open Source Release & Helm Chart (v1.0)**  
   Global open-source distribution with comprehensive self-hosting guides, automated backups, and battle-tested Kubernetes Helm Charts.

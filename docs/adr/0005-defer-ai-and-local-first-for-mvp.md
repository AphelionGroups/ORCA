# ADR 0005: Deferring AI Intelligence Layer & Local-First Engine for Core MVP v0.1

## Status
Accepted

## Date
2026-09-16

## Context
ORCA's foundational concept envisions ambitious capabilities:
1. **AI Intelligence Layer (Letta AI / Agent Core):** An agent that ingests notes, tasks, and calendar events to deliver context-aware daily briefings and automated time-blocking.
2. **Local-First & CRDT (Yjs / Automerge):** Full offline-first spatial canvas editing with deterministic multi-device conflict resolution.

Attempting to build CRDT synchronization engines and an AI agent runtime in initial sprints introduces extreme risk of over-engineering and architectural fatigue. The greatest danger is failing to reach a reliable daily-driver state for core workflows (Spaces, Tasks, Calendar, and Project Hub).

## Decision
We decide to **defer the AI Layer and full Local-First CRDT engine outside the scope of Core MVP v0.1**:
1. **MVP (v0.1)** focuses strictly on:
   - Spaces & Context isolation.
   - Project Hub (Docs & Plans, Milanote Spatial Board v1, Linear-style Kanban & Lists).
   - Unified Calendar & task time-blocking.
   - Standard REST API communication with optimistic client state.
2. The AI Intelligence Layer is scheduled for **v0.4** as an external worker service, decoupling AI experimentation from the core operational database.
3. The Local-First engine is scheduled for **v0.3**, with database foundations (UUIDv7, soft-deletes, timestamps) prepared upfront in the schema.

## Consequences
- **Positive:**
  - Keeps the MVP tightly scoped, robust, and rapidly usable for daily dogfooding.
  - Ensures initial debugging remains straightforward without distributed state synchronization complexity.
- **Negative:**
  - Early v0.1 builds require an active network connection to the backend to persist modifications.

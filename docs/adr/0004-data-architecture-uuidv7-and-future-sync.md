# ADR 0004: Data Architecture: Standardizing on UUIDv7 & Local-First Readiness

## Status
Accepted

## Date
2026-09-16

## Context
ORCA begins as a web application communicating via standard REST APIs for its MVP. However, the future roadmap explicitly targets **Local-First & Offline Synchronization** capabilities (similar to Obsidian and Milanote).
Using legacy auto-incrementing integers (`SERIAL` / `BIGSERIAL`) creates major migration hurdles because IDs generated client-side during offline sessions collide upon server synchronization.
Conversely, standard UUIDv4 identifiers are entirely random, causing severe B-Tree index fragmentation and cache misses in PostgreSQL at scale.

## Decision
We standardize the data architecture on the following conventions:
1. **Primary Keys Use UUIDv7:** UUIDv7 combines a Unix timestamp (time-ordered) with cryptographically secure random bits. This enables both client and server to generate conflict-free identifiers independently while preserving optimal B-Tree index locality in PostgreSQL.
2. **Mandatory Synchronization Fields:** Every core table includes:
   - `workspace_id`: Enforcing multi-tenant boundary isolation.
   - `created_at` and `updated_at` (`TIMESTAMPTZ`): Serving as synchronization cursors to detect deltas.
   - `deleted_at` (`TIMESTAMPTZ` for Soft Deletes): Enabling offline clients to detect deleted records during sync.
3. **Dynamic Content Storage via JSONB:** Canvas card blocks store their properties in `JSONB` columns, allowing flexible addition of new card block types without repetitive schema migrations.

## Consequences
- **Positive:**
  - Future transitions to Local-First and CRDT delta synchronization require zero primary key refactoring.
  - IDs can be generated directly in the frontend for instantaneous optimistic UI updates.
  - Maintains optimal B-Tree index performance.
- **Negative:**
  - UUIDs consume slightly more storage than 32-bit integers (16 bytes vs 4 bytes), an acceptable trade-off for modern database workloads.

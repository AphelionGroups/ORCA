# ADR 0003: Selection of Go Backend with Modular Monolith Pattern

## Status
Accepted

## Date
2026-09-16

## Context
ORCA's backend must handle fast CRUD requests, maintain relational database connections, and run lightweight background workers for external calendar synchronization (Google Calendar).
Two primary backend ecosystems were evaluated:
1. **Node.js (NestJS / Hono):** Offers unified language ergonomics (TypeScript) between frontend and backend. However, NestJS runtime memory consumption is relatively high ($150\text{--}300\text{ MB}$ idle), and large `node_modules` dependency graphs create long-term maintenance overhead.
2. **Go (Golang):** Offers outstanding performance, minimal memory footprint ($<30\text{ MB}$ RAM idle), single static binary compilation, and native goroutine concurrency ideal for background workers.

For a software platform designed specifically for self-hosters and home labs, low resource usage and long-term deployment stability outweigh the convenience of shared TypeScript types.

## Decision
We select **Go** as the backend language structured as a **Modular Monolith**:
1. All domain modules (Auth, Spaces, Tasks, Calendar, Board, Links, Sync Worker) reside in a single Go repository with clean domain package boundaries.
2. Deployed as a single static binary container ($<25\text{ MB}$ image size).
3. Built on lightweight standard HTTP routing (Chi) and robust PostgreSQL connection pooling via `pgx`.

## Consequences
- **Positive:**
  - Extremely resource-efficient for low-cost VPS setups, home labs, and Kubernetes/RKE clusters.
  - Near-instant container boot times and minimal dependency surface.
  - Native goroutine concurrency eliminates the need for separate worker daemons.
- **Negative:**
  - Frontend TypeScript DTO interfaces must be maintained independently or synced via API specs.

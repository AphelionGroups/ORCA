# Development & Contribution Guide

This document establishes the engineering standards, directory organization, Git workflows, and local environment setup for **ORCA**.

---

## 1. Prerequisites

To run and develop ORCA locally, ensure the following tooling is installed:
- **Go:** Version 1.22 or newer.
- **Node.js:** Version 20 LTS or newer.
- **Package Manager:** `npm` or `pnpm`.
- **Docker & Docker Compose:** For running isolated PostgreSQL and Redis instances.
- **Git:** For version control.

---

## 2. Repository Structure

The project employs a structured monorepo separating the Go backend and SolidJS frontend:

```
ORCA/
├── cmd/
│   ├── migrate/            # Database schema migration CLI
│   └── server/             # Primary Go HTTP API entrypoint
├── internal/               # Internal Go modules (Modular Monolith)
│   ├── board/              # Spatial canvas & note blocks domain
│   ├── calendar/           # Events & calendar sync domain
│   ├── doc/                # Long-form documents & markdown domain
│   ├── link/               # Universal polymorphic cross-link engine
│   ├── platform/           # Config, database pools, logging, middleware
│   ├── project/            # Project Hub orchestration
│   ├── space/              # Multi-domain space context engine
│   └── task/               # Task management & Kanban execution
├── migrations/             # PostgreSQL SQL schema migrations
├── scripts/                # E2E verification & seed scripts
├── web/                    # SolidJS SPA Frontend (TypeScript + Vite)
│   ├── src/
│   │   ├── components/     # UI components (Modals, Sidebar)
│   │   ├── services/       # Typed REST API client
│   │   └── views/          # Core views (ProjectsView, CalendarView, InboxView)
│   ├── Containerfile       # OCI frontend build containerfile
│   ├── nginx.conf          # Production SPA reverse proxy configuration
│   └── package.json
├── Containerfile           # Root OCI backend build containerfile
├── compose.yml             # Production compose specification (API + Web)
├── compose.override.yml    # Development compose override (Local Postgres + Redis)
├── docs/                   # Architectural documentation & ADRs
│   ├── adr/
│   └── self-hosting-guide.md
└── README.md
```

---

## 3. Engineering Guidelines & Coding Standards

### A. Backend Guidelines (Go)
1. **Domain Package Isolation:** Strictly prevent circular dependencies. Packages communicate via defined interfaces or Data Transfer Objects (DTOs) rather than unconstrained cross-imports.
2. **Tenant Scoping & Clean Queries:** Always enforce `workspace_id` tenant scoping and `deleted_at IS NULL` soft-delete checks on all database operations.
3. **Explicit Error Wrapping:** Always inspect and contextually wrap errors:
   ```go
   if err != nil {
       return fmt.Errorf("task.Create: %w", err)
   }
   ```
   Never suppress errors with blank identifiers (`_`).
4. **Context Propagation:** Pass `context.Context` from HTTP handlers down to database queries to ensure request cancellations and timeouts are honored.

### B. Frontend Guidelines (SolidJS)
1. **Never Destructure Props:**
   - In SolidJS, destructuring props (`const { title, status } = props;`) **breaks reactivity**.
   - Always access attributes directly via `props.title` or use `splitProps(props, [...])`.
2. **Fine-Grained Signals:**
   - Keep reactive signals tightly scoped to elements that consume them.
   - Avoid monolithic global stores for canvas state; isolate card coordinates `(x, y)` so that dragging one card only triggers DOM updates for that specific card.
3. **Component Lifecycle Awareness:**
   - SolidJS component functions execute only **once** upon mounting. Side-effects must be encapsulated within `createEffect` or `onMount`.

---

## 4. Git & Contribution Workflow

### A. Commit Message Conventions
Follow the Conventional Commits specification:
```
<type>(<scope>): <concise description>
```
Examples:
- `feat(task): add priority filtering to list view`
- `fix(board): correct coordinate snapping on zoom < 50%`
- `docs(self-host): add automated backup instructions`
- `refactor(auth): isolate workspace context middleware`

### B. Branching Strategy
- `main`: Production-ready, stable branch.
- `feat/<feature-name>`: Dedicated feature development branches.
- `fix/<bug-name>`: Targeted bug fix branches.

### C. Pull Request Checklist
1. Ensure code passes formatting checks (`gofmt` for Go, `npm run build` / typechecks for web).
2. Validate that no secrets, database credentials, or API tokens are checked in.
3. Run automated E2E smoke tests (`verify_e2e.ps1` or `verify_e2e.sh`).
4. Provide a clear summary of changes and validation steps.

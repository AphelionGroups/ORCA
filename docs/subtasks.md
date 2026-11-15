# Subtasks

Task details expose children directly, without a collapsed section. Enter adds a
child and keeps focus in the quick-add field. Children have ordinary task IDs,
statuses, descriptions, priorities and independent planned dates, deadlines and
calendar sessions. Navigation between tasks asks before discarding unsaved edits.

New children inherit the parent's workspace, space and project. New hierarchies
have one child level. Migration 000007 preserves legacy deeper or differently
scoped relationships; their existing children remain accessible. Detaching a
child clears its parent without changing its identity or dates. A task with
children must detach them before moving to another space/project.

Daily eligibility is unchanged: each open task qualifies by its own planned date,
deadline or linked calendar session. A child's date does not schedule its parent.
API task responses include parent title, active child count, completed child count
and total descendant count. Cancelled children are visible but excluded from the
completion denominator. Delete confirmation includes all descendants, including
cancelled children. Existing soft-delete cascading remains in force.

## Optional automatic completion

`auto_complete_subtasks` defaults to false and is saved with task details.
With the option enabled, all non-cancelled children being done completes the
parent. There must be at least one active child. An automatically completed
parent reopens to `in_progress` when unfinished work is added/reopened or when
there are no active children left. A manually completed parent stays done, and a
cancelled parent stays cancelled. Turning off the option clears automation
ownership without changing the parent's current status.

Database triggers apply these rules to every task writer. Task repository
mutations use a workspace-scoped transaction advisory lock before row locking,
so concurrent sibling completions reconcile against committed state. Automatic
parent status changes advance its version and stale detail saves receive 409.

## Validation

- `go test ./...` with `ORCA_TEST_DATABASE_URL` set to a PostgreSQL 16+ test
  database. Integration tests create and clean up unique schemas.
- `npm --prefix web run build`, `npm --prefix web test`,
  `npm --prefix web run check:spacing`.
- `node scripts/subtasks-check.cjs` with Playwright available through
  `ORCA_PLAYWRIGHT_MODULE` if needed. Uses synthetic API fixtures and records
  screenshots under ignored `bin/subtasks/`.

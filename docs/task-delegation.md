# Task delegation

Delegation is additional context on an existing task. It does not create another
task, a new status or a separate project. The receiving person's free-text name
does not require an ORCA account and does not send messages or invitations.

## Task details

Choose **Delegasikan** to show the recipient, optional follow-up date and optional
delegation note. Existing delegation fields stay visible without a collapsed
section. Changes are saved with the normal task form. **Cabut delegasi** clears
the delegation fields when saved; it leaves the task's status, deadline, planned
date and Calendar sessions intact.

- `delegated_to`: nullable recipient name, trimmed, at most 255 characters.
- `follow_up_date`: nullable date-only value, independent of the task deadline.
- `delegation_note`: nullable trimmed text, at most 4000 characters.

Follow-up or notes require a recipient. Clearing the recipient through the update
API clears its follow-up and note atomically. Finishing/cancelling a task retains
its delegation context. Children never inherit delegation automatically.

Migration 000009 adds these fields, a data-integrity check and an index for open
delegated work. Existing tasks remain undelegated. Partial updates and optimistic
version checks follow the existing task API contract. `GET /tasks?delegated=true`
returns delegated tasks; `false` returns undelegated tasks. Both respect the
existing workspace/project/space/parent/status filters.

## Home and project views

**Didelegasikan ke orang lain** is an optional Home widget, added through Customize.
It is not included in the default layout. It displays open delegated tasks in
follow-up order: overdue, today, future, then undated. Done/cancelled tasks are
excluded, and overdue follow-ups remain visible after the day changes. Rows open
the original task and do not add messaging or task execution controls.

Daily retains its existing planned date/deadline/Calendar rules and additionally
includes open delegated tasks whose follow-up is today. Those rows show
**Follow-up: [title]**. A task qualifying through several dates or sessions still
appears once. Other qualifying reasons are shown on the same row. Date-only values
are not shifted by timezone conversion; today's date follows the existing user
Calendar timezone preference.

Unscheduled-task eligibility is unchanged. Delegated tasks appearing there are
identified by their recipient. Project List and Kanban show recipient context and
offer **Semua task / Didelegasikan** filtering using the same task records.

## Portable packages

Export/import preserves delegation fields. Delegation notes participate in the
same reference/attachment collection and remapping as descriptions. Importing an
older package without these optional fields leaves its tasks undelegated.
Names are text, not account IDs, and are not remapped as workspace memberships.

## Verification

- Full Go suite, including isolated PostgreSQL HTTP integration tests: create,
  edit, clear, validation, stale update, filter, tenant isolation, child
  independence and cross-workspace portable copies including older packages.
- Frontend unit tests: Daily deduplication, date-only/overdue labels, waiting order,
  closed-task exclusion and opt-in widget persistence.
- `node scripts/delegation-check.cjs` with Playwright: fixture browser checks for
  all UI flows, child navigation/draft protection, both project views and layouts
  at 320/390/768/1440 px. Optional `ORCA_PLAYWRIGHT_MODULE` supplies Playwright.
- `node scripts/delegation-live-check.cjs` against an isolated actual API/UI:
  registration, delegation edits/removal through the browser, independent
  deadline/subtask and actual cross-workspace export/import with an attached
  image in the delegation note. No API responses are mocked.

The live script defaults to API 8081/UI 3001; `ORCA_LIVE_API`/`ORCA_LIVE_UI` override
them. It requires a separate test environment and builds the current package
inspection helper. This verification used an `orca_live_delegation_*` PostgreSQL
schema and disposable test accounts, not ordinary workspace data. Its report and
screenshots are retained under ignored `bin/delegation/`; test services and schema
are removed afterwards. The main app remains on ports 3000/8080.

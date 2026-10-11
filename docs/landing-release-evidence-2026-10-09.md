# ORCA landing release evidence — 9 October 2026

## Release conclusion

Core personal-workspace workflows are verified on a fresh local runtime built from the redesign branch. This supports bounded feature copy and actual local-product screenshots. It does **not** establish that the same version or workflows are deployed to the public hosted app. Landing publication gates remain open: hosted authenticated walkthrough/version mapping, landing DNS/deployment, approved visual identity/assets, and a corrected production setup guide.

This review made no changes to ORCA-Land, no deployment or publication, and no Git commit/push. Production received anonymous GET requests only; no login, registration, creation, or mutation was attempted there.

## Version and environment

| Evidence | Observed value |
|---|---|
| Checkout | `D:/AphelionLabs/ORCA`, branch `design/orca-app-refresh` |
| Source SHA | `9a658fb11fcac2aa93bd78b5ce7ae8c28dd71202` |
| Remote redesign branch | `git ls-remote` returned the same SHA |
| Remote default HEAD | `ecb989507cfaf8641fb611eb76bc41b33351a7c5`; do not assume cloning the default branch gives this redesign |
| Review date/time basis | 9 October 2026, Asia/Jakarta; hosted browser observation 09:17:32 WIB |
| Existing local service | `localhost:3000` Vite and `localhost:8080` native Go; its binary reports `c7e9ab7e4f03ec12dee7d7d1ad0bf046e3d4c3ab`, modified=true. Not accepted as exact-current-SHA evidence |
| Fresh evidence API | Separate Go binary on `127.0.0.1:8081`, build info SHA `9a658fb…`, modified=false, Go 1.27.0/windows/amd64, ENV=development |
| Binary SHA-256 | `5A62C8096204A4110A8836B0482878ACF5E9C1E4F5898DFAAF0BA5647F13A58E` |
| Fresh evidence frontend | TypeScript strict/Vite production asset build served at `127.0.0.1:3011`, API URL explicitly set to the evidence API; no mocked API responses |
| Database | PostgreSQL 16 Docker; isolated schema `orca_release_evidence_20261009`, migrations 000001–000006 confirmed |
| Dataset | Synthetic Example Workspace account, Personal/Work Spaces, portfolio project, one document, three cards/two connectors, four tasks, two events and inbox notes |
| Browser/viewport | Headless Chromium via Playwright; 1440×1000 desktop and 390×844 mobile; Asia/Jakarta; light theme |
| Privacy | Generated credentials/tokens remained in process/browser memory. Screenshots contain only fictional sample account/content, no real people, credentials, tokens, or production records |

Fresh local build succeeded. The capture walkthrough completed with zero page errors. It is a functional walkthrough, not a load test, security certification, backup drill, or cross-browser audit. Earlier broad tests are documented in `docs/roadmap-implementation-2026-10-09.md`; they are supporting evidence, not a substitute for this fresh walkthrough.

## Claim matrix

All **L** results below are for source SHA `9a658fb…`, dated 9 October 2026, on the fresh local environment above. **H** results are anonymous hosted observations, with deployment SHA unknown. “Verified runtime” applies only to the explicitly tested behavior, not every operation or acceptance criterion of a feature.

| Feature | Local status and demonstrated behavior | Evidence / reproduction steps | Hosted status | Boundaries and safe claim |
|---|---|---|---|---|
| Spaces / Projects | **Verified runtime (L)**: create two Spaces, project under Personal, reload and open project tabs | V01: UI registration → POST `/spaces` twice → POST `/projects` → reload → All Spaces → project → Docs/Board/Tasks. Spaces/projects and Project Hub screenshots | **Unverified after auth (H)** | Personal project organization. No invitations/shared-workspace membership or team-role claim. Archive/delete/move permutations not exhaustively rechecked here |
| Documents | **Verified basic persistence; partial editor (L)**: create document, edit through UI, Save, API reread, Preview; stale save returns 409 | V02: seeded document → edit content → Save → Preview → GET document; PUT with pre-edit expected_updated_at → 409. Documents screenshots | **Unverified after auth (H)** | Plain text with basic inline Markdown formatting. Heading/list Markdown syntax remains literal in Preview. Full Markdown/rich text, automatic text-to-task, revisions, crash draft recovery and backlinks are not verified available |
| Board | **Verified card canvas/persistence; partial block interoperability (L)**: three cards, two visible SVG connectors, reopen/reload; delete/undo restores block and both links | V03: POST board → POST batch operations → reopen → compare GET connections → UI Delete → Ctrl+Z → GET connections count=2. Board screenshots show real card-to-card lines | **Unverified after auth (H)** | Visual card arrangement and saved card connections. Sticky endpoint connections can be stored but renderer suppresses any connection touching sticky. Do not promise all block types can connect, card-to-task, collaborative canvas, unlimited history or offline editing |
| Tasks | **Verified runtime basics; partial planning (L)**: create four statuses with priorities/due dates; Kanban/List; UI completion toggle persisted | V04: POST tasks → Tasks → List → toggle completion → reread API; reset sample status → reload → Kanban/List screenshots | **Unverified after auth (H)** | Task list/board with statuses, priority and due dates. Estimate/planned_date exist in API and estimate appears in Calendar backlog; complete editing UX, subtask UI, custom workflow, daily rituals, advanced filter/group/pagination remain incomplete |
| Calendar | **Verified runtime basics; partial scheduling UX (L)**: real Week/Day dates, timezone preference, task-linked session, UI event edit persisted | V05: seed timed events → Calendar Week/Day → save Asia/Jakarta preference → inspect session → Timeline → edit title → Save → API reread. Calendar screenshots | **Unverified after auth (H)** | Add/edit scheduled events and schedule a task through a form. Several sessions per task are supported by existing model; full multi-session walkthrough not repeated in this review. No task drag/drop, event drag/resize, Google sync, automatic scheduling, ritual/overlap-warning claim |
| Inbox / Quick Capture | **Verified runtime (L)**: Ctrl+K dialog → save note → GET inbox; inbox-to-task conversion creates target ID | V06: Ctrl+K → write synthetic idea → dialog Save to Inbox → API reread; POST second note → `/convert-task` → assert task_id. Inbox screenshots | **Unverified after auth (H)** | Capture thoughts and turn an inbox note into a task. Conversion was exercised through API, not the conversion modal; historical provenance/backlinks/retry after lost response not advertised as complete |
| Login / registration | **Verified runtime (L)**: UI registration creates isolated workspace/signs in; clear session and UI login succeeds | V07: blank login → Register form → generated sample credentials → authenticated shell; later clear browser session → login again. Blank local login screenshot | **Partial hosted (H)**: form and register tab visible; anonymous `/api/v1/auth/me` returns 401 | Registration configurable per installation; not evidence of hosted account creation success, verification email, password reset, SSO, invite or multiuser membership. Never show sample passwords in landing |
| Self-hosting | **Partial (L)**: source and MIT license, Compose/container definitions, build/migration/API/web verified separately | V08: clean Go binary build, production frontend asset build, fresh schema migration 1–6, API/database/browser walkthrough; prior Compose smoke documented separately | Public repository and pinned guides return HTTP 200 | Guide available, not turnkey production certification. No clean production Compose bootstrap or restore drill in this review. Do not repeat RAM/uptime/performance or Helm/RKE support claims without measurements/artifacts |

Roadmap only: AI, full offline/local-first synchronization, stylus/freehand, collaborative workspace/invitations, Google Calendar import, document revision/recovery/structured conversions, advanced daily planning, attachment lifecycle/cleanup and scale pagination. Source/spec/README mention is not a runtime pass.

## Hosted/public checks

Read-only checks used Node HTTPS and a fresh anonymous Chromium context. The web extraction tool could not access these URLs; direct network/browser checks provide the observations below.

| URL / check | Observation | Meaning |
|---|---|---|
| `https://app.orca.ocaty.com/` | HTTP 200, title “ORCA — Spatial Operating System”, login email field and Register tab visible; zero page errors | Hosted sign-in entry point is reachable at observation time |
| `https://app.orca.ocaty.com/api/v1/auth/me` | HTTP 401 without auth | Anonymous auth gate responds. Does not prove database readiness or successful login |
| Hosted frontend assets | `/assets/index-DHM7GijZ.js`, `/assets/index-Btvyy0NY.css`; fonts include Material Symbols/Geist/Inter/JetBrains Mono | Assets differ from the fresh evidence build. Different API base/build options also change hashes, so hash difference alone cannot identify which source SHA is hosted |
| `https://orca.ocaty.com/` | Node HTTPS request failed `ENOTFOUND` | Landing hostname unresolved from this environment at check time. Verify DNS/Cloudflare deployment externally; this is not a global outage conclusion |
| `https://github.com/AphelionGroups/ORCA` | HTTP 200, repository page | Public repository entry point reachable |
| Pinned self-host guide / security guide below | Both HTTP 200 | Stable source/document links available for this exact review version |

No hosted user data was read. No production tokens/passwords were used. Successful hosted registration/login, authenticated core workflows, deployment SHA, production migrations, backups and monitoring still require an authorized hosted walkthrough/deployment record.

## Landing copy review — EN and ID

Reviewed `D:/AphelionLabs/ORCA-Land/main/src/config/content.ts` plus docs 08/09. Existing design-concept labels and roadmap disclaimers are accurate; keep them until the visual actually changes. Current generic document/board/task/calendar/Spaces narrative is supportable for the bounded local capabilities above. Avoid implying automated connections between every entity or verified hosted feature parity.

| Landing field / topic | Recommended EN | Recommended ID | Decision |
|---|---|---|---|
| Description / product summary | “Keep notes, visual boards, tasks, and scheduled events together in Spaces and projects.” | “Simpan catatan, board visual, tugas, dan agenda dalam Spaces dan proyek.” | Safe general capability wording; not a production health guarantee |
| Capture step | “Capture a thought in your inbox, then turn it into a task when you are ready.” | “Simpan ide di inbox, lalu jadikan tugas ketika siap dikerjakan.” | Verified local capture and conversion |
| Board/doc step | “Arrange cards on a visual board and write notes for your project.” | “Susun kartu pada board visual dan tulis catatan untuk proyekmu.” | Do not replace with “connect any note” or automatic card-to-task/text-to-task |
| Task step | “Organize project tasks in a list or a status board.” | “Atur tugas proyek dalam daftar atau board berdasarkan status.” | Supported Kanban/List; no subtasks/custom workflow implication |
| Calendar step | “Create scheduled events and give a task a time slot.” | “Buat agenda dan alokasikan waktu untuk tugas.” | Supported form scheduling; omit drag/drop and automatic daily planning |
| Spaces narrative | Existing Work/Personal/Side-project organization copy can remain | Narasi pemisahan konteks Kerja/Pribadi/Sampingan dapat dipertahankan | Counts remain explicitly illustrative. Do not call Spaces team permissions |
| Hosted/selfCopy | “Visit the hosted sign-in page, or follow the Docker Compose guide to run your own instance.” | “Kunjungi halaman login hosted, atau ikuti panduan Docker Compose untuk menjalankan instance sendiri.” | Entry point reachable; do not call latest hosted workflows verified |
| Access FAQ | “Open ORCA to visit app.orca.ocaty.com. Account creation is available when registration is enabled on that instance.” | “Buka ORCA untuk mengunjungi app.orca.ocaty.com. Akun baru dapat dibuat jika registrasi diaktifkan pada instance tersebut.” | Replace unconditional account-creation promise until hosted registration passes |
| Self-host FAQ | “Self-hosting is optional. A Docker Compose guide is available; running your own instance requires configuring the database, security, and storage.” | “Self-hosting bersifat opsional. Panduan Docker Compose tersedia; instance sendiri memerlukan konfigurasi database, keamanan, dan penyimpanan.” | More accurate than an effortless/one-click production claim |
| Actual screenshot caption, if replacing concept | “ORCA on a local test instance, with sample content. Build 9a658fb, 9 October 2026.” | “ORCA pada instance uji lokal dengan konten contoh. Build 9a658fb, 9 Oktober 2026.” | Real screenshot; not a claim this redesign is deployed hosted |
| Product language | “This website is available in English and Indonesian.” | “Website ini tersedia dalam bahasa Inggris dan Indonesia.” | Landing locales only. App currently mixes EN and ID; do not promise a fully localized EN/ID product |

Hold/remove: full Markdown/rich-text or auto text/card-to-task; task/calendar drag/drop; Google synchronization; automated daily planning; AI/offline/stylus; collaboration/roles/invites; unlimited boards/history; end-to-end encryption/private attachments; public uptime/resource benchmarks; production Kubernetes/Helm deployment. The README’s executive summary contains several aspirational capabilities—do not use it as feature-copy proof.

The FAQ saying the preview is a concept remains correct for the existing illustration. When replacing it with a real asset, update the caption, FAQ and concept badge together. Actual screenshot candidates here do not become owner-approved final marketing art automatically.

## Screenshot package and identity

Directory: **`D:/AphelionLabs/ORCA/docs/screenshots/landing-release-2026-10-09/`**. These are real screenshots of the fresh runtime, with synthetic data and real database responses; no UI mock, image generation or composited overlay. Candidate marketing assets, pending owner approval. Manifest records SHA, environment, successful checks, file hashes and viewport dimensions.

| Asset basename | Desktop 1440×1000 | Mobile 390×844 | What is actually visible |
|---|---|---|---|
| `spaces-projects` | `spaces-projects-desktop.png` | `spaces-projects-mobile.png` | Project overview, Personal/Work contexts |
| `project-hub` | `project-hub-desktop.png` | `project-hub-mobile.png` | Actual project tabs and board overview; card illustration within app is a UI thumbnail, not a second screenshot |
| `documents` | `documents-desktop.png` | `documents-mobile.png` | Saved notes using supported plain text/basic inline formatting |
| `board` | `board-desktop.png` | `board-mobile.png` | Three real cards, two visible persisted card-to-card SVG connections; mobile uses saved 35% zoom |
| `tasks` | `tasks-desktop.png` | `tasks-mobile.png` | Four-column Kanban desktop; List mobile |
| `calendar` | `calendar-desktop.png` | `calendar-mobile.png` | Week desktop; Day controls/backlog mobile |
| Calendar detail | — | `calendar-mobile-session.png` | Scrolled Day grid and 09:00 task-linked session; grid horizontally scrolls and some metadata is clipped at this narrow width |
| `inbox` | `inbox-desktop.png` | `inbox-mobile.png` | Persisted synthetic thought |
| Login | `login-desktop.png` | — | Empty local login form; no credentials |
| Manifest | `manifest.json` | — | 16 image files plus provenance/checks/hashes |

Example full path: `D:/AphelionLabs/ORCA/docs/screenshots/landing-release-2026-10-09/board-desktop.png`. Use this directory plus the exact filenames above for every asset. Desktop board/Project Hub/documents are the strongest landing candidates. Review mobile Calendar crop before placing it in a hero. The sample email uses the reserved `.invalid` domain and is fictional; it is not an actual person’s address.

Palette verified from `web/src/theme.css`: Snow `#F7FAF8`, Polar `#0D1B1E`, Mint `#B2FFA9`. The app uses a CSS ORCA wordmark with geometric bars in `web/src/components/Sidebar.tsx` and `web/src/index.css`; no approved standalone official logo asset was located.

`D:/AphelionLabs/ORCA-Land/main/public/favicon.svg` is a palette-aligned geometric **interim** favicon; docs 08 already labels it interim. `D:/AphelionLabs/ORCA/web/public/favicon.svg` is leftover Vite artwork and should not be presented as ORCA’s official identity. Current `web/index.html` has no favicon link. An owner-approved logo/favicon (including browser wiring) remains a release asset gate. Existing landing OG image remains its own concept asset, not product-runtime evidence.

## Repository and self-hosting handoff

- Public repository: https://github.com/AphelionGroups/ORCA
- Reviewed branch: https://github.com/AphelionGroups/ORCA/tree/design/orca-app-refresh
- Exact version guide: https://github.com/AphelionGroups/ORCA/blob/9a658fb11fcac2aa93bd78b5ce7ae8c28dd71202/docs/self-hosting-guide.md
- Required security/upgrade guide: https://github.com/AphelionGroups/ORCA/blob/9a658fb11fcac2aa93bd78b5ce7ae8c28dd71202/docs/security-upgrade.md
- License: MIT in `D:/AphelionLabs/ORCA/LICENSE`; public source availability does not establish production readiness.

Use the security/upgrade guide as the authoritative correction to older self-host examples. Required: Docker/Compose or build toolchains, PostgreSQL (local override uses version 16), a unique production JWT secret of at least 32 bytes, appropriate CORS and registration policy, storage volume/bucket and backups, HTTPS/reverse proxy, all migrations. Redis is not required.

Development: default `docker compose up -d --build` automatically includes `compose.override.yml`, uses development mode and may seed demo data. Production: explicitly **`docker compose -f compose.yml up -d --build`**, external PostgreSQL URL with suitable TLS, ENV=production, ALLOW_DEV_WORKSPACE_HEADER=false, unique JWT_SECRET and a chosen ALLOW_REGISTRATION value. Do not reuse local demo credentials publicly. Proxy the web service; its Nginx forwards `/api/v1` and uploads. Native build needs explicit VITE_API_URL/CORS rather than assuming production proxy behavior.

Guide gaps to fix before presenting an unqualified production quickstart: production example omits JWT_SECRET and registration policy; generic Compose command can include the development override; minimum RAM and <30/<50 MB claims are unmeasured here; backup examples are not a successful isolated restore drill; Helm/RKE is roadmap, not an available chart. Uploads are public by object URL, not confidential signed attachments. Preserve DB/upload volumes; do not use `down -v` as an upgrade instruction. Legacy invalid values can block migration 000004 and need explicit audit/repair.

## Specific release gates / blockers

1. **G-01 / product evidence: partial close.** Core local walkthrough and 16 real candidates now exist; current hosted SHA and authenticated parity are still missing. Record deployed SHA/migrations and run authorized hosted tests before promising current redesign availability.
2. **G-02 / identity and links: partial close.** Public repository and exact-SHA guide links verified. Official logo/favicon approval and corrected production recipe remain open. Do not inherit Vite favicon.
3. **Landing DNS/deployment: open.** orca.ocaty.com did not resolve here. Verify records, Pages/project mapping, EN/ID URLs, redirects and CTA in the deployed environment. No publication was attempted.
4. **Review-only app findings:** sticky connections suppressed; Markdown Preview lacks heading/list rendering; mobile Day grid retains horizontal overflow/clipped event metadata; registration name placeholder contains a developer’s example name. Record/fix before advertising those respective behaviors; no source fix made by this review.
5. **Localization boundary:** screenshots show mixed EN/ID application language. Landing bilingual support is not full product localization.
6. **Operations boundary:** production boot/upgrade/backup restore, resource limits, load and cross-browser checks remain unverified. No production security/certification or performance claim should be inferred.

G-03 owner visual approval, G-04 hosted environment checks, G-05 preview deployment and G-06/G-07 release/rollback monitoring remain the landing team’s gates; this application evidence does not independently close them.

## Reproduction and cleanup

Capture recipe is retained in `docs/evidence/landing-release-2026-10-09/capture.cjs` (set ORCA_PLAYWRIGHT_MODULE if Playwright is not on module resolution). It requires a fresh isolated API on 8081 with migrations, allow registration, CORS for 3011, and a frontend build in `bin/release-evidence-dist` targeting that API. It serves the compiled app on loopback 3011, registers a randomly credentialed synthetic account, seeds only that account, and runs real UI/API checks. No credentials are written into the manifest or screenshots. Fixed sample schedule dates are 8–9 October 2026; for later reproduction adjust the anchor/sample dates explicitly.

The temporary evidence server and only its explicitly created schema are cleaned up after the review. Existing services on 3000/8080 and their data are left in place. Captures/manifest remain. The review itself performed no push, production write or ORCA-Land edit; these evidence artifacts can be committed separately.

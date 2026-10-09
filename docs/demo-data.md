# ORCA demo data

Run `scripts/demo-data.sql` in your PostgreSQL / Neon SQL Editor after ORCA migrations 1–6 have completed. Run the entire file in one execution, then sign in to ORCA:

- Email: `demo@user.com`
- Password: `demouser`

The script creates a dedicated Demo Workspace and Demo User. The password is stored as a bcrypt hash compatible with ORCA. No PostgreSQL extension, manual registration, or application code change is required. The account calendar timezone defaults to Asia/Jakarta.

All sample content is in English: Demo Studio space, Sunset Coffee Launch project, a brief document, a board with three cards and two connectors, five tasks in different statuses, three linked calendar events, and three Inbox ideas. Calendar events start on the execution date and continue over the following two days.

Reruns preserve existing rows, edits, passwords, timezone preferences, and soft deletions. They do not duplicate data or move old events to today's date. Deleted demo parents cause an atomic failure; restore them before rerunning. Existing unrelated accounts using demo@user.com are refused rather than modified. If this script's account password is later changed, rerunning does not reset it.

If you already ran the previous script against a different account, that workspace remains unchanged. This version creates its own dedicated demo account.

Use the known demo credentials only for sample data. Do not store personal data in this account. The script does not connect to or modify your database until you execute it.

For psql with a securely configured connection: `psql -v ON_ERROR_STOP=1 -f scripts/demo-data.sql`. If a SQL Editor leaves a failed transaction open, run `ROLLBACK;` before retrying.

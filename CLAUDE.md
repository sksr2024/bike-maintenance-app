## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (sksr2024/bike-maintenance-app), using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) are used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Session handoff

Before starting work, read `HANDOFF.md` at the repo root if it exists — it holds the previous session's summary and next steps. Update it at the end of a session that made non-trivial progress (overwrite, don't append — it's a snapshot of the latest state, not a log).

### Explanation folder

This project's purpose is learning software development. Only add a new Markdown file to `Explanation/` at the repo root when the user explicitly asks for one to be written there — do not create one automatically just because the user asked a question about the project. Always still answer the question inline regardless. See `Explanation/README.md` for naming and style conventions.

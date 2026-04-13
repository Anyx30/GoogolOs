# GoogolOS — Session Handoff

## What is this?

GoogolOS is a Google Workspace automation web app. It gives a single user a chat interface to trigger 19 deterministic workflows (Gmail, Calendar, Drive, Docs, Sheets) using natural language, powered by the [GWS CLI](https://github.com/googleworkspace/cli) as the execution engine and Claude as the intent router.

**Current state:** Empty repo. Planning complete. Ready to build.

---

## Project Location

```
/Users/zephyr/Claude-Workspace/projects/GoogolOS/
```

Git is initialized. No code written yet — only the plan and this file exist.

---

## Implementation Plan

Full step-by-step plan is at:

```
/Users/zephyr/Claude-Workspace/projects/GoogolOS/docs/superpowers/plans/2026-04-13-googolos-mvp.md
```

Read this file before doing anything else. It has exact file paths, complete code for every step, and test commands.

---

## Architecture (summary)

```
Next.js Web App (App Router)
  └── Chat UI + Workflow Sidebar
        │
        ▼
Next.js API Routes
  ├── /api/chat     → SSE stream: intent router → workflow engine → formatter
  └── /api/workflow → GET: list workflows | POST: run by name
        │
        ▼
lib/
  ├── gws-runner.ts        → runs `gws` CLI as subprocess, returns parsed JSON
  ├── workflow-engine.ts   → loads YAML configs, chains gws-runner calls
  ├── intent-router.ts     → Claude (haiku) maps user message → workflow name + params
  └── response-formatter.ts → Claude (haiku) formats raw JSON → markdown
        │
        ▼
GWS CLI (authenticated locally via `gws auth login`)
```

**No database.** GWS CLI stores Google credentials locally. Single user only for MVP.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router) |
| Styling | Tailwind CSS v4 |
| Chat/streaming | Custom SSE (text/event-stream) |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| GWS integration | `gws` CLI binary (subprocess via `child_process.exec`) |
| YAML parsing | `js-yaml` |
| Markdown rendering | `react-markdown` |
| Testing | Jest + ts-jest |
| Deployment | Vercel |

---

## The 19 Workflows

### Email
1. `morning-digest` — Summarizes unread emails (last 24h)
2. `follow-up-sweep` — Sent emails with no reply in 3–7 days
3. `smart-archive` — Lists newsletters/receipts/notifications to archive

### Calendar
4. `meeting-prep-brief` — Upcoming meeting details + attendees
5. `daily-agenda` — Today's meetings
6. `meeting-follow-up` — Draft follow-up after a meeting

### Admin / Reporting
7. `weekly-standup-report` — Week's calendar + email summary
8. `time-audit` — Meeting hours vs. focus time breakdown
9. `doc-snapshot` — Drive files modified this week

### Client / Project Tracking
10. `sheet-pipeline-updater` — Flags stale rows in a Sheets tracker
11. `client-status-email` — Drafts status update from Sheet + emails
12. `onboarding-checklist` — Creates Drive folder + Sheet + welcome email

### Google Docs
13. `proposal-generator` — Copies template Doc, renames for client
14. `meeting-notes-action-items` — Extracts action items from a Doc
15. `doc-summarizer` — 5-bullet TL;DR of any Doc
16. `template-cloner` — Duplicates a template Doc to a Drive folder

### Google Sheets
17. `expense-categorizer` — Categorized summary of expense rows
18. `cross-sheet-consolidator` — Consolidates data from a spreadsheet
19. `data-cleanup` — Flags duplicates, empty fields, formatting issues

**Plus:** General Command mode — ad-hoc natural language → arbitrary GWS CLI command.

---

## Key Design Rules

- **Claude only does intent routing** — it maps natural language → workflow name. It does NOT freeform-generate actions. All execution is deterministic.
- **Workflows are YAML configs** — sequences of GWS CLI commands with parameter substitution. No code per workflow.
- **No DB for MVP** — `gws auth login` handles credentials locally.
- **SSE streaming** — chat responses stream via Server-Sent Events so status updates appear in real time.

---

## Scalability Path (not for MVP)

When ready for multi-user: add Google OAuth per user + Supabase for token storage. The workflow engine, YAML configs, and chat UI need **zero changes**.

---

## How to Start Building

**Your first action in the new session:**

```
Use superpowers:subagent-driven-development to implement the plan at:
/Users/zephyr/Claude-Workspace/projects/GoogolOS/docs/superpowers/plans/2026-04-13-googolos-mvp.md

Working directory: /Users/zephyr/Claude-Workspace/projects/GoogolOS/

Start from Task 1 (Project Scaffold).
```

The plan has 16 tasks. Each task has:
- Exact files to create/modify
- Complete code (no placeholders)
- Test commands with expected output
- A git commit at the end

---

## Environment Requirements

Before Task 16 (end-to-end verification), you will need:
1. `ANTHROPIC_API_KEY` in `.env.local`
2. GWS CLI installed: `npm install -g @google/gws` (or per official docs)
3. GWS CLI authenticated: `gws auth login`

---

## Decision Log

- **No DB** — GWS CLI handles auth locally for single-user MVP
- **Subagent-driven over parallel agents** — plan is mostly sequential; parallel agents would waste tokens re-reading the plan with no file-sharing between agents
- **Claude Haiku for intent routing and formatting** — cheaper, fast enough for deterministic routing tasks
- **SSE not Vercel AI SDK streaming** — simpler for this use case; no tool-call overhead
- **YAML not code for workflows** — keeps workflows config-only, no deployment needed when adding new ones

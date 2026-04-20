# GoogolOS — Session Handoff

## What is this?

GoogolOS is a Google Workspace automation web app. Single user, chat interface, triggers workflows via natural language. GWS CLI is the execution engine. Claude Haiku is the intent router and response formatter.

**Current state:** Fully built and working locally. Not yet deployed.

---

## Project Location

```
/Users/zephyr/Claude-Workspace/projects/GoogolOS/
```

---

## Architecture

```
app/page.tsx (chat UI + sidebar)
  └── /api/chat          → SSE stream: intent-router → workflow-engine → response-formatter
  └── /api/workflow      → GET: list workflows | POST: run by name

lib/
  ├── gws-runner.ts        → runs gws CLI via execFile, returns parsed JSON
  ├── workflow-engine.ts   → loads YAML configs, resolves params, chains gws calls
  ├── intent-router.ts     → Claude Haiku: message → {workflowName, params} or general-command intent
  ├── response-formatter.ts → Claude Haiku: raw JSON → markdown
  └── inbox-labeler.ts     → native TS workflow (see Workflows section)

workflows/<category>/<name>.yaml  → one file per workflow, no code changes needed to add new ones
```

---

## Critical: GWS CLI Format

**This differs from training data.** Always use:

```bash
gws <service> <resource> <method> --params '{"key":"value"}'
gws drive files copy --params '{"fileId":"abc"}' --json '{"name":"New Name"}'
```

**Never use** the old flag style: `gws gmail messages list --maxResults 50`

`gws-runner.ts` uses `execFile` (not `exec`) — args passed as array, no shell escaping needed.

---

## Workflows (20 total)

19 standard YAML workflows + 1 native:

| Category | Workflows |
|---|---|
| email | morning-digest, follow-up-sweep, smart-archive, **inbox-labeler** |
| calendar | meeting-prep-brief, daily-agenda, meeting-follow-up |
| admin | weekly-standup-report, time-audit, doc-snapshot |
| client-tracking | sheet-pipeline-updater, client-status-email, onboarding-checklist |
| docs | proposal-generator, meeting-notes-action-items, doc-summarizer, template-cloner |
| sheets | expense-categorizer, cross-sheet-consolidator, data-cleanup |

**inbox-labeler** is a native TypeScript workflow (`lib/inbox-labeler.ts`). It cannot be expressed as a YAML workflow because:
- It requires conditional rule matching (domain → label)
- It needs array extraction from list results (message IDs) that the YAML engine doesn't support
- The YAML engine is designed for simple linear GWS CLI call chains, not branching logic

The `/api/workflow` POST route intercepts `inbox-labeler` before the YAML engine and calls `runInboxLabeler()` directly. Its YAML stub (`workflows/email/inbox-labeler.yaml`) exists only for sidebar display and intent routing.

**To extend the YAML engine** to support array passing between steps (enabling labeler-style workflows in YAML), the engine's `resolveValue` and step execution logic in `lib/workflow-engine.ts` would need to handle array outputs from prior steps as inputs to body fields.

---

## Intent Router (`lib/intent-router.ts`)

Two intent types are returned:

1. **Workflow intent** — `{type: "workflow", workflowName: string, params: Record<string, unknown>}` — matched to a named YAML/native workflow.
2. **General-command intent** — `{type: "general-command", gwsCommand: "gws <service> <resource> <method>", gwsParams?: Record<string, unknown>, gwsBody?: Record<string, unknown>}` — used as a fallback for ad-hoc GWS queries that don't map to a workflow.

**GWS resource path rule**: the Claude prompt explicitly teaches that Gmail always requires `users` between the service and the resource (e.g. `gws gmail users messages list`, not `gws gmail messages list`). Other services follow the standard two-segment path.

**Params are structured, never inlined**: `gwsParams` and `gwsBody` are returned as separate JSON objects, not concatenated into the command string. The chat route builds CLI args from these fields.

---

## Chat Route (`app/api/chat/route.ts`)

When executing a `general-command` intent, the route constructs the CLI argument array from the structured `gwsParams`/`gwsBody` fields on the `IntentMatch` object — it does **not** split `gwsCommand` on whitespace. This avoids corrupting embedded JSON that contains spaces.

Execution flow for general-command:
```
gwsCommand.split(' ')          // ["gws", "<service>", "<resource>", "<method>"]
+ ["--params", JSON.stringify(gwsParams)]   // if gwsParams present
+ ["--json",   JSON.stringify(gwsBody)]     // if gwsBody present
→ gws-runner.ts execFile call
```

---

## Key Implementation Decisions

- **`execFile` not `exec`** — avoids shell quoting issues with JSON params
- **Lazy singleton for Anthropic client** — module-level instantiation breaks Jest mocks; both `intent-router.ts` and `response-formatter.ts` use `let _client = null` pattern
- **YAML `params:` vs `body:`** — `params` → `--params` (query/path params), `body` → `--json` (request body)
- **SSE streaming** — custom `ReadableStream` in the chat route, no Vercel AI SDK
- **Claude Haiku** (`claude-haiku-4-5-20251001`) for all AI calls — fast and cheap for deterministic routing
- **`IntentMatch` type** (`types/index.ts`) — has optional `gwsParams?: Record<string, unknown>` and `gwsBody?: Record<string, unknown>` fields for general-command intents

---

## GWS CLI Auth

Authenticated as `anik@metaborong.com`.

If token expires or `invalid_rapt` error:
```bash
gws auth logout
gws auth login --scopes "https://www.googleapis.com/auth/gmail.modify,https://www.googleapis.com/auth/gmail.settings.basic,https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/documents,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/tasks"
```

`gmail.settings.basic` is **not** included in `gws auth login --full` — must be specified explicitly.

---

## Running Locally

```bash
npm run dev       # starts on localhost:3000
npm test          # Jest test suite
npx tsc --noEmit  # type check
```

Requires `ANTHROPIC_API_KEY` in `.env.local`. If Claude calls return auth errors or credit errors, the key may be pointing to the wrong Anthropic account — replace it with a key from the correct account (one with active credits).

---

## What's Next

1. **Vercel deployment** — GWS CLI runs locally only; cloud deployment needs rethinking (GWS CLI won't be available on Vercel)
2. **Extend YAML engine** — add array-passing support between steps to enable labeler-style workflows in YAML
3. **Add new workflows** — drop a YAML in `workflows/<category>/`. No code changes needed unless native logic is required

# GoogolOS MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web app with a chat UI that lets a single user trigger 19 deterministic Google Workspace workflows and ad-hoc GWS CLI commands using natural language.

**Architecture:** Claude routes natural language intent to named workflow configs (YAML). A workflow engine chains GWS CLI subprocess calls, and a response formatter converts raw JSON output to human-readable markdown streamed back to the chat UI. No database — GWS CLI handles auth locally via `gws auth login`.

**Tech Stack:** Next.js 15 (App Router), Vercel AI SDK, Anthropic Claude API, GWS CLI (subprocess), js-yaml, Tailwind CSS v4, Jest + ts-jest

---

## File Map

```
GoogolOS/
├── app/
│   ├── layout.tsx                          # Root HTML shell
│   ├── page.tsx                            # Main page: sidebar + chat
│   ├── globals.css                         # Tailwind import
│   └── api/
│       ├── chat/route.ts                   # SSE streaming endpoint: intent → execute → format
│       └── workflow/route.ts               # GET: list workflows | POST: run by name
├── components/
│   ├── message-bubble.tsx                  # Renders user/assistant/status messages
│   ├── workflow-card.tsx                   # Clickable workflow tile in sidebar
│   ├── workflow-sidebar.tsx                # Grouped sidebar of all 19 workflows
│   └── chat-interface.tsx                  # Chat input, message list, SSE consumer
├── lib/
│   ├── gws-runner.ts                       # Runs `gws` binary as subprocess → parsed JSON
│   ├── workflow-engine.ts                  # Loads YAML, resolves params, chains gws-runner calls
│   ├── intent-router.ts                   # Claude prompt: message → IntentMatch
│   └── response-formatter.ts              # Claude prompt: raw JSON → markdown summary
├── types/
│   └── index.ts                            # Shared TypeScript types
├── workflows/
│   ├── email/
│   │   ├── morning-digest.yaml
│   │   ├── follow-up-sweep.yaml
│   │   └── smart-archive.yaml
│   ├── calendar/
│   │   ├── meeting-prep-brief.yaml
│   │   ├── daily-agenda.yaml
│   │   └── meeting-follow-up.yaml
│   ├── admin/
│   │   ├── weekly-standup-report.yaml
│   │   ├── time-audit.yaml
│   │   └── doc-snapshot.yaml
│   ├── client-tracking/
│   │   ├── sheet-pipeline-updater.yaml
│   │   ├── client-status-email.yaml
│   │   └── onboarding-checklist.yaml
│   ├── docs/
│   │   ├── proposal-generator.yaml
│   │   ├── meeting-notes-action-items.yaml
│   │   ├── doc-summarizer.yaml
│   │   └── template-cloner.yaml
│   └── sheets/
│       ├── expense-categorizer.yaml
│       ├── cross-sheet-consolidator.yaml
│       └── data-cleanup.yaml
└── __tests__/
    ├── gws-runner.test.ts
    ├── workflow-engine.test.ts
    ├── intent-router.test.ts
    └── response-formatter.test.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `jest.config.js`, `.env.local`, `app/globals.css`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /Users/zephyr/Claude-Workspace/projects/GoogolOS
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-import-alias --yes
```

Expected: Next.js project created with App Router and Tailwind.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install ai @ai-sdk/anthropic @anthropic-ai/sdk js-yaml react-markdown
npm install --save-dev @types/js-yaml jest @types/jest ts-jest
```

- [ ] **Step 3: Configure Jest**

Create `jest.config.js`:
```js
const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

module.exports = createJestConfig({
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
});
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 5: Set up environment file**

Create `.env.local`:
```
ANTHROPIC_API_KEY=your_api_key_here
```

- [ ] **Step 6: Replace globals.css with Tailwind v4 import**

Replace all content of `app/globals.css` with:
```css
@import "tailwindcss";
```

- [ ] **Step 7: Verify scaffold compiles**

```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Create types file**

Create `types/index.ts`:
```typescript
export interface WorkflowInput {
  name: string;
  description?: string;
  default?: string;
  required?: boolean;
}

export interface WorkflowStep {
  id: string;
  command: string;
  args: string[];
  foreach?: string;
}

export interface WorkflowOutput {
  format: 'summary' | 'list' | 'table' | 'raw';
  template?: string;
}

export type WorkflowCategory =
  | 'email'
  | 'calendar'
  | 'admin'
  | 'client-tracking'
  | 'docs'
  | 'sheets';

export interface WorkflowConfig {
  name: string;
  label: string;
  category: WorkflowCategory;
  description: string;
  inputs: WorkflowInput[];
  steps: WorkflowStep[];
  output: WorkflowOutput;
}

export interface StepResult {
  stepId: string;
  data: unknown;
  error?: string;
}

export interface WorkflowResult {
  workflowName: string;
  steps: StepResult[];
  raw: Record<string, unknown>;
}

export interface IntentMatch {
  type: 'workflow' | 'general-command';
  workflowName?: string;
  params?: Record<string, string>;
  gwsCommand?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

- [ ] **Step 2: Verify TypeScript accepts the types**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: GWS CLI Runner

**Files:**
- Create: `lib/gws-runner.ts`
- Create: `__tests__/gws-runner.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/gws-runner.test.ts`:
```typescript
import { runGwsCommand } from '@/lib/gws-runner';

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

import { exec } from 'child_process';

const mockExec = exec as unknown as jest.Mock;

describe('runGwsCommand', () => {
  beforeEach(() => jest.clearAllMocks());

  it('executes gws command and returns parsed JSON', async () => {
    mockExec.mockImplementation((_cmd: string, _opts: object, cb: Function) => {
      cb(null, JSON.stringify({ messages: [{ id: 'abc', snippet: 'Hello' }] }), '');
    });

    const result = await runGwsCommand(['gmail', 'messages', 'list', '--maxResults', '5']);
    expect(result).toEqual({ messages: [{ id: 'abc', snippet: 'Hello' }] });
  });

  it('constructs the correct gws command string', async () => {
    mockExec.mockImplementation((_cmd: string, _opts: object, cb: Function) => {
      cb(null, '{}', '');
    });

    await runGwsCommand(['calendar', 'events', 'list', '--calendarId', 'primary']);
    expect(mockExec).toHaveBeenCalledWith(
      'gws calendar events list --calendarId primary',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('returns raw string when output is not JSON', async () => {
    mockExec.mockImplementation((_cmd: string, _opts: object, cb: Function) => {
      cb(null, 'plain text output', '');
    });

    const result = await runGwsCommand(['some', 'command']);
    expect(result).toBe('plain text output');
  });

  it('throws when exec reports an error', async () => {
    mockExec.mockImplementation((_cmd: string, _opts: object, cb: Function) => {
      cb(new Error('command not found'), '', '');
    });

    await expect(runGwsCommand(['bad', 'command'])).rejects.toThrow('command not found');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- gws-runner
```
Expected: FAIL — `Cannot find module '@/lib/gws-runner'`

- [ ] **Step 3: Implement gws-runner.ts**

Create `lib/gws-runner.ts`:
```typescript
import { exec } from 'child_process';

export interface GwsRunnerOptions {
  timeout?: number;
}

export async function runGwsCommand(
  args: string[],
  options: GwsRunnerOptions = {}
): Promise<unknown> {
  const { timeout = 30000 } = options;
  const command = `gws ${args.join(' ')}`;

  return new Promise((resolve, reject) => {
    exec(command, { timeout }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr) {
        reject(new Error(`GWS CLI error: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(stdout);
      }
    });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- gws-runner
```
Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/gws-runner.ts __tests__/gws-runner.test.ts
git commit -m "feat: add GWS CLI subprocess runner with tests"
```

---

## Task 4: Workflow Engine

**Files:**
- Create: `lib/workflow-engine.ts`
- Create: `__tests__/workflow-engine.test.ts`
- Create: `workflows/email/morning-digest.yaml` (needed for tests — full YAML library in Tasks 7–12)

- [ ] **Step 1: Create minimal test workflow YAML**

Create `workflows/email/morning-digest.yaml`:
```yaml
name: morning-digest
label: Morning Digest
category: email
description: Summarizes unread emails from the last 24 hours
inputs:
  - name: time_range
    description: Time range to look back
    default: "24h"
steps:
  - id: fetch_emails
    command: gws gmail messages list
    args: ["--q", "is:unread newer_than:{time_range}", "--maxResults", "50"]
output:
  format: summary
```

- [ ] **Step 2: Write failing tests**

Create `__tests__/workflow-engine.test.ts`:
```typescript
import { loadWorkflow, listWorkflows, executeWorkflow } from '@/lib/workflow-engine';

jest.mock('@/lib/gws-runner', () => ({
  runGwsCommand: jest.fn(),
}));

import { runGwsCommand } from '@/lib/gws-runner';
const mockRun = runGwsCommand as jest.Mock;

describe('loadWorkflow', () => {
  it('loads a workflow by name', () => {
    const config = loadWorkflow('morning-digest');
    expect(config.name).toBe('morning-digest');
    expect(config.label).toBe('Morning Digest');
    expect(config.category).toBe('email');
    expect(config.steps).toHaveLength(1);
  });

  it('throws for unknown workflow', () => {
    expect(() => loadWorkflow('does-not-exist')).toThrow('Workflow not found: does-not-exist');
  });
});

describe('listWorkflows', () => {
  it('returns an array with at least one workflow', () => {
    const workflows = listWorkflows();
    expect(workflows.length).toBeGreaterThan(0);
    expect(workflows[0]).toHaveProperty('name');
    expect(workflows[0]).toHaveProperty('label');
  });
});

describe('executeWorkflow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('executes workflow steps and returns results', async () => {
    mockRun.mockResolvedValue({ messages: [{ id: '1', snippet: 'Test email' }] });

    const result = await executeWorkflow('morning-digest', { time_range: '12h' });

    expect(result.workflowName).toBe('morning-digest');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].stepId).toBe('fetch_emails');
    expect(mockRun).toHaveBeenCalledWith(
      ['gmail', 'messages', 'list', '--q', 'is:unread newer_than:12h', '--maxResults', '50']
    );
  });

  it('applies default param values when not provided', async () => {
    mockRun.mockResolvedValue({ messages: [] });

    await executeWorkflow('morning-digest', {});

    expect(mockRun).toHaveBeenCalledWith(
      expect.arrayContaining(['newer_than:24h'])
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- workflow-engine
```
Expected: FAIL — `Cannot find module '@/lib/workflow-engine'`

- [ ] **Step 4: Implement workflow-engine.ts**

Create `lib/workflow-engine.ts`:
```typescript
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { WorkflowConfig, WorkflowResult, StepResult } from '@/types';
import { runGwsCommand } from './gws-runner';

const WORKFLOWS_DIR = path.join(process.cwd(), 'workflows');

const CATEGORIES = ['email', 'calendar', 'admin', 'client-tracking', 'docs', 'sheets'];

export function loadWorkflow(name: string): WorkflowConfig {
  for (const category of CATEGORIES) {
    const filePath = path.join(WORKFLOWS_DIR, category, `${name}.yaml`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return yaml.load(content) as WorkflowConfig;
    }
  }
  throw new Error(`Workflow not found: ${name}`);
}

export function listWorkflows(): WorkflowConfig[] {
  const configs: WorkflowConfig[] = [];

  for (const category of CATEGORIES) {
    const categoryPath = path.join(WORKFLOWS_DIR, category);
    if (!fs.existsSync(categoryPath)) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.yaml'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(categoryPath, file), 'utf-8');
      configs.push(yaml.load(content) as WorkflowConfig);
    }
  }

  return configs;
}

function resolveArgs(
  args: string[],
  params: Record<string, string>,
  stepResultMap: Record<string, unknown>
): string[] {
  return args.map(arg =>
    arg
      .replace(/\{(\w+)\}/g, (_, key) => params[key] ?? '')
      .replace(/\{(\w+)\.(\w+)\}/g, (_, stepId, field) => {
        const result = stepResultMap[stepId];
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          return String((result as Record<string, unknown>)[field] ?? '');
        }
        return '';
      })
  );
}

export async function executeWorkflow(
  name: string,
  params: Record<string, string> = {}
): Promise<WorkflowResult> {
  const config = loadWorkflow(name);
  const resolvedParams = { ...params };

  for (const input of config.inputs) {
    if (!resolvedParams[input.name] && input.default) {
      resolvedParams[input.name] = input.default;
    }
  }

  const stepResults: StepResult[] = [];
  const stepResultMap: Record<string, unknown> = {};

  for (const step of config.steps) {
    if (step.foreach) {
      const sourceData = stepResultMap[step.foreach];
      const items = Array.isArray(sourceData) ? sourceData : [sourceData];
      const results: unknown[] = [];

      for (const item of items) {
        const itemParams = {
          ...resolvedParams,
          ...(typeof item === 'object' && item !== null ? (item as Record<string, string>) : {}),
        };
        const resolvedArgs = resolveArgs(step.args, itemParams, stepResultMap);
        const cmdParts = [...step.command.replace('gws ', '').split(' '), ...resolvedArgs];
        const result = await runGwsCommand(cmdParts);
        results.push(result);
      }

      stepResultMap[step.id] = results;
      stepResults.push({ stepId: step.id, data: results });
    } else {
      const resolvedArgs = resolveArgs(step.args, resolvedParams, stepResultMap);
      const cmdParts = [...step.command.replace('gws ', '').split(' '), ...resolvedArgs];
      const result = await runGwsCommand(cmdParts);
      stepResultMap[step.id] = result;
      stepResults.push({ stepId: step.id, data: result });
    }
  }

  return { workflowName: name, steps: stepResults, raw: stepResultMap };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- workflow-engine
```
Expected: PASS — 5 tests passing

- [ ] **Step 6: Commit**

```bash
git add lib/workflow-engine.ts __tests__/workflow-engine.test.ts workflows/email/morning-digest.yaml
git commit -m "feat: add workflow engine with YAML loading and step chaining"
```

---

## Task 5: Intent Router

**Files:**
- Create: `lib/intent-router.ts`
- Create: `__tests__/intent-router.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/intent-router.test.ts`:
```typescript
import { routeIntent } from '@/lib/intent-router';

jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}));

jest.mock('@/lib/workflow-engine', () => ({
  listWorkflows: jest.fn().mockReturnValue([
    { name: 'morning-digest', description: 'Summarizes unread emails from the last 24 hours' },
    { name: 'daily-agenda', description: 'Shows all of today\'s meetings' },
  ]),
}));

import Anthropic from '@anthropic-ai/sdk';

describe('routeIntent', () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const instance = new (Anthropic as any)();
    mockCreate = instance.messages.create;
    (Anthropic as any).mockImplementation(() => instance);
  });

  it('routes to a workflow when intent matches', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"type":"workflow","workflowName":"morning-digest","params":{}}' }],
    });

    const result = await routeIntent('show me my unread emails');
    expect(result.type).toBe('workflow');
    expect(result.workflowName).toBe('morning-digest');
  });

  it('routes to general-command for ad-hoc queries', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"type":"general-command","gwsCommand":"gws gmail messages list --maxResults 10"}' }],
    });

    const result = await routeIntent('list my last 10 emails');
    expect(result.type).toBe('general-command');
    expect(result.gwsCommand).toContain('gws');
  });

  it('falls back to general-command when Claude returns unparseable JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json' }],
    });

    const result = await routeIntent('something weird');
    expect(result.type).toBe('general-command');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- intent-router
```
Expected: FAIL — `Cannot find module '@/lib/intent-router'`

- [ ] **Step 3: Implement intent-router.ts**

Create `lib/intent-router.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { IntentMatch } from '@/types';
import { listWorkflows } from './workflow-engine';

const client = new Anthropic();

export async function routeIntent(userMessage: string): Promise<IntentMatch> {
  const workflows = listWorkflows();
  const workflowList = workflows
    .map(w => `- ${w.name}: ${w.description}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are an intent router for GoogolOS, a Google Workspace automation tool.

Available workflows:
${workflowList}

User message: "${userMessage}"

Respond with a JSON object only (no markdown, no explanation):
- If the message matches a workflow: {"type":"workflow","workflowName":"<exact-name>","params":{}}
- If it is a general GWS query: {"type":"general-command","gwsCommand":"<full gws command starting with gws>"}

Extract params from the user message. Use workflow defaults for missing params.`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text.trim() : '';

  try {
    return JSON.parse(text) as IntentMatch;
  } catch {
    return { type: 'general-command', gwsCommand: 'gws gmail messages list --maxResults 10' };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- intent-router
```
Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/intent-router.ts __tests__/intent-router.test.ts
git commit -m "feat: add Claude-powered intent router"
```

---

## Task 6: Response Formatter

**Files:**
- Create: `lib/response-formatter.ts`
- Create: `__tests__/response-formatter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/response-formatter.test.ts`:
```typescript
import { formatWorkflowResult, formatGeneralCommandResult } from '@/lib/response-formatter';

jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() },
  })),
}));

import Anthropic from '@anthropic-ai/sdk';

describe('formatWorkflowResult', () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const instance = new (Anthropic as any)();
    mockCreate = instance.messages.create;
    (Anthropic as any).mockImplementation(() => instance);
  });

  it('returns formatted markdown string', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '## Morning Digest\n- 3 unread emails' }],
    });

    const result = await formatWorkflowResult('Morning Digest', { fetch_emails: [] });
    expect(typeof result).toBe('string');
    expect(result).toContain('Morning Digest');
  });
});

describe('formatGeneralCommandResult', () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const instance = new (Anthropic as any)();
    mockCreate = instance.messages.create;
    (Anthropic as any).mockImplementation(() => instance);
  });

  it('returns formatted markdown string for a command result', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Found 5 emails matching your query.' }],
    });

    const result = await formatGeneralCommandResult(
      'gws gmail messages list --q test',
      { messages: [] }
    );
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- response-formatter
```
Expected: FAIL — `Cannot find module '@/lib/response-formatter'`

- [ ] **Step 3: Implement response-formatter.ts**

Create `lib/response-formatter.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function formatWorkflowResult(
  workflowLabel: string,
  raw: unknown
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are formatting output from a Google Workspace automation called "${workflowLabel}".

Raw data:
${JSON.stringify(raw, null, 2)}

Write a clean, concise markdown summary. Use bullet points and headers where helpful. Skip raw IDs and technical fields. Focus on what the user needs to know.`,
      },
    ],
  });

  return response.content[0].type === 'text' ? response.content[0].text : 'No output';
}

export async function formatGeneralCommandResult(
  command: string,
  raw: unknown
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You ran the Google Workspace command: "${command}"

Result:
${JSON.stringify(raw, null, 2)}

Write a clean, concise markdown response. Skip raw IDs and technical fields.`,
      },
    ],
  });

  return response.content[0].type === 'text' ? response.content[0].text : 'No output';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- response-formatter
```
Expected: PASS — 2 tests passing

- [ ] **Step 5: Run all tests**

```bash
npm test
```
Expected: All 14 tests passing across 4 suites.

- [ ] **Step 6: Commit**

```bash
git add lib/response-formatter.ts __tests__/response-formatter.test.ts
git commit -m "feat: add response formatter for workflow and general command output"
```

---

## Task 7: Email Workflow YAMLs

**Files:**
- Modify: `workflows/email/morning-digest.yaml` (already exists — update to final version)
- Create: `workflows/email/follow-up-sweep.yaml`
- Create: `workflows/email/smart-archive.yaml`

- [ ] **Step 1: Finalize morning-digest.yaml**

Replace `workflows/email/morning-digest.yaml` with:
```yaml
name: morning-digest
label: Morning Digest
category: email
description: Summarizes unread emails from the last 24 hours
inputs:
  - name: time_range
    description: Time range to look back
    default: "24h"
steps:
  - id: fetch_emails
    command: gws gmail messages list
    args: ["--q", "is:unread newer_than:{time_range}", "--maxResults", "50"]
output:
  format: summary
```

- [ ] **Step 2: Create follow-up-sweep.yaml**

Create `workflows/email/follow-up-sweep.yaml`:
```yaml
name: follow-up-sweep
label: Follow-up Sweep
category: email
description: Finds sent emails with no reply in the last 3-7 days and drafts follow-ups
inputs:
  - name: days_ago
    description: How many days ago to check for unanswered sent emails
    default: "5"
steps:
  - id: sent_emails
    command: gws gmail messages list
    args: ["--q", "in:sent newer_than:{days_ago}d", "--maxResults", "30"]
output:
  format: list
```

- [ ] **Step 3: Create smart-archive.yaml**

Create `workflows/email/smart-archive.yaml`:
```yaml
name: smart-archive
label: Smart Archive
category: email
description: Lists emails that can be archived (newsletters, receipts, notifications) for your review
inputs: []
steps:
  - id: newsletters
    command: gws gmail messages list
    args: ["--q", "unsubscribe in:inbox", "--maxResults", "30"]
  - id: receipts
    command: gws gmail messages list
    args: ["--q", "receipt OR \"order confirmation\" in:inbox", "--maxResults", "20"]
  - id: notifications
    command: gws gmail messages list
    args: ["--q", "noreply in:inbox", "--maxResults", "20"]
output:
  format: list
```

- [ ] **Step 4: Verify all 3 email workflows load**

```bash
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
['morning-digest','follow-up-sweep','smart-archive'].forEach(n => {
  const f = fs.readFileSync('workflows/email/' + n + '.yaml', 'utf-8');
  const c = yaml.load(f);
  console.log('OK:', c.name, '-', c.label);
});
"
```
Expected:
```
OK: morning-digest - Morning Digest
OK: follow-up-sweep - Follow-up Sweep
OK: smart-archive - Smart Archive
```

- [ ] **Step 5: Commit**

```bash
git add workflows/email/
git commit -m "feat: add 3 email workflow YAML configs"
```

---

## Task 8: Calendar Workflow YAMLs

**Files:**
- Create: `workflows/calendar/meeting-prep-brief.yaml`
- Create: `workflows/calendar/daily-agenda.yaml`
- Create: `workflows/calendar/meeting-follow-up.yaml`

- [ ] **Step 1: Create meeting-prep-brief.yaml**

Create `workflows/calendar/meeting-prep-brief.yaml`:
```yaml
name: meeting-prep-brief
label: Meeting Prep Brief
category: calendar
description: Pulls upcoming meeting details including attendees and agenda
inputs:
  - name: max_results
    description: Maximum number of upcoming meetings to show
    default: "5"
steps:
  - id: upcoming_events
    command: gws calendar events list
    args: ["--calendarId", "primary", "--maxResults", "{max_results}", "--orderBy", "startTime", "--singleEvents", "--timeMin", "now"]
output:
  format: summary
```

- [ ] **Step 2: Create daily-agenda.yaml**

Create `workflows/calendar/daily-agenda.yaml`:
```yaml
name: daily-agenda
label: Daily Agenda
category: calendar
description: Shows all of today's meetings with times and attendees
inputs: []
steps:
  - id: todays_events
    command: gws calendar events list
    args: ["--calendarId", "primary", "--maxResults", "20", "--orderBy", "startTime", "--singleEvents", "--timeMin", "now"]
output:
  format: list
```

- [ ] **Step 3: Create meeting-follow-up.yaml**

Create `workflows/calendar/meeting-follow-up.yaml`:
```yaml
name: meeting-follow-up
label: Meeting Follow-up
category: calendar
description: Retrieves your most recent meeting and helps draft a follow-up email with action items
inputs: []
steps:
  - id: recent_meetings
    command: gws calendar events list
    args: ["--calendarId", "primary", "--maxResults", "5", "--orderBy", "startTime", "--singleEvents", "--timeMax", "now"]
output:
  format: summary
```

- [ ] **Step 4: Verify all 3 calendar workflows load**

```bash
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
['meeting-prep-brief','daily-agenda','meeting-follow-up'].forEach(n => {
  const f = fs.readFileSync('workflows/calendar/' + n + '.yaml', 'utf-8');
  const c = yaml.load(f);
  console.log('OK:', c.name, '-', c.label);
});
"
```
Expected:
```
OK: meeting-prep-brief - Meeting Prep Brief
OK: daily-agenda - Daily Agenda
OK: meeting-follow-up - Meeting Follow-up
```

- [ ] **Step 5: Commit**

```bash
git add workflows/calendar/
git commit -m "feat: add 3 calendar workflow YAML configs"
```

---

## Task 9: Admin Workflow YAMLs

**Files:**
- Create: `workflows/admin/weekly-standup-report.yaml`
- Create: `workflows/admin/time-audit.yaml`
- Create: `workflows/admin/doc-snapshot.yaml`

- [ ] **Step 1: Create weekly-standup-report.yaml**

Create `workflows/admin/weekly-standup-report.yaml`:
```yaml
name: weekly-standup-report
label: Weekly Standup Report
category: admin
description: Summarizes calendar events and emails from the past week into a standup report
inputs:
  - name: days
    description: Number of days to look back
    default: "7"
steps:
  - id: week_events
    command: gws calendar events list
    args: ["--calendarId", "primary", "--maxResults", "50", "--orderBy", "startTime", "--singleEvents"]
  - id: week_emails
    command: gws gmail messages list
    args: ["--q", "newer_than:{days}d", "--maxResults", "50"]
output:
  format: summary
```

- [ ] **Step 2: Create time-audit.yaml**

Create `workflows/admin/time-audit.yaml`:
```yaml
name: time-audit
label: Time Audit
category: admin
description: Breaks down how many hours were spent in meetings vs. focus time over the past week
inputs:
  - name: days
    description: Number of days to analyze
    default: "7"
steps:
  - id: all_events
    command: gws calendar events list
    args: ["--calendarId", "primary", "--maxResults", "100", "--orderBy", "startTime", "--singleEvents"]
output:
  format: summary
```

- [ ] **Step 3: Create doc-snapshot.yaml**

Create `workflows/admin/doc-snapshot.yaml`:
```yaml
name: doc-snapshot
label: Doc Snapshot
category: admin
description: Lists all Drive files created or modified recently
inputs:
  - name: days
    description: Number of days to look back
    default: "7"
steps:
  - id: recent_files
    command: gws drive files list
    args: ["--orderBy", "modifiedTime desc", "--pageSize", "50", "--fields", "files(id,name,mimeType,modifiedTime,owners)"]
output:
  format: list
```

- [ ] **Step 4: Verify all 3 admin workflows load**

```bash
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
['weekly-standup-report','time-audit','doc-snapshot'].forEach(n => {
  const f = fs.readFileSync('workflows/admin/' + n + '.yaml', 'utf-8');
  const c = yaml.load(f);
  console.log('OK:', c.name, '-', c.label);
});
"
```
Expected:
```
OK: weekly-standup-report - Weekly Standup Report
OK: time-audit - Time Audit
OK: doc-snapshot - Doc Snapshot
```

- [ ] **Step 5: Commit**

```bash
git add workflows/admin/
git commit -m "feat: add 3 admin/reporting workflow YAML configs"
```

---

## Task 10: Client Tracking Workflow YAMLs

**Files:**
- Create: `workflows/client-tracking/sheet-pipeline-updater.yaml`
- Create: `workflows/client-tracking/client-status-email.yaml`
- Create: `workflows/client-tracking/onboarding-checklist.yaml`

- [ ] **Step 1: Create sheet-pipeline-updater.yaml**

Create `workflows/client-tracking/sheet-pipeline-updater.yaml`:
```yaml
name: sheet-pipeline-updater
label: Sheet Pipeline Updater
category: client-tracking
description: Reads a Sheets-based tracker and flags rows with no update in the specified number of days
inputs:
  - name: spreadsheet_id
    description: Google Sheets spreadsheet ID
    required: true
  - name: sheet_name
    description: Name of the sheet tab to scan
    default: "Sheet1"
  - name: stale_days
    description: Number of days without update to flag as stale
    default: "7"
steps:
  - id: read_sheet
    command: gws sheets spreadsheets values get
    args: ["{spreadsheet_id}", "{sheet_name}"]
output:
  format: summary
```

- [ ] **Step 2: Create client-status-email.yaml**

Create `workflows/client-tracking/client-status-email.yaml`:
```yaml
name: client-status-email
label: Client Status Email
category: client-tracking
description: Drafts a client-facing status update email from a Sheet row and recent email context
inputs:
  - name: spreadsheet_id
    description: Google Sheets spreadsheet ID
    required: true
  - name: client_name
    description: Client name to search for in emails
    required: true
steps:
  - id: project_data
    command: gws sheets spreadsheets values get
    args: ["{spreadsheet_id}", "Sheet1"]
  - id: client_emails
    command: gws gmail messages list
    args: ["--q", "{client_name} newer_than:14d", "--maxResults", "10"]
output:
  format: summary
```

- [ ] **Step 3: Create onboarding-checklist.yaml**

Create `workflows/client-tracking/onboarding-checklist.yaml`:
```yaml
name: onboarding-checklist
label: Onboarding Checklist
category: client-tracking
description: Creates a Drive folder and shared Sheet for a new client, and drafts a welcome email
inputs:
  - name: client_name
    description: Name of the new client
    required: true
  - name: client_email
    description: Client email address
    required: true
steps:
  - id: create_folder
    command: gws drive files create
    args: ["--name", "{client_name}", "--mimeType", "application/vnd.google-apps.folder"]
  - id: create_sheet
    command: gws drive files create
    args: ["--name", "{client_name} - Project Tracker", "--mimeType", "application/vnd.google-apps.spreadsheet"]
output:
  format: summary
```

- [ ] **Step 4: Verify all 3 client-tracking workflows load**

```bash
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
['sheet-pipeline-updater','client-status-email','onboarding-checklist'].forEach(n => {
  const f = fs.readFileSync('workflows/client-tracking/' + n + '.yaml', 'utf-8');
  const c = yaml.load(f);
  console.log('OK:', c.name, '-', c.label);
});
"
```
Expected:
```
OK: sheet-pipeline-updater - Sheet Pipeline Updater
OK: client-status-email - Client Status Email
OK: onboarding-checklist - Onboarding Checklist
```

- [ ] **Step 5: Commit**

```bash
git add workflows/client-tracking/
git commit -m "feat: add 3 client tracking workflow YAML configs"
```

---

## Task 11: Google Docs Workflow YAMLs

**Files:**
- Create: `workflows/docs/proposal-generator.yaml`
- Create: `workflows/docs/meeting-notes-action-items.yaml`
- Create: `workflows/docs/doc-summarizer.yaml`
- Create: `workflows/docs/template-cloner.yaml`

- [ ] **Step 1: Create proposal-generator.yaml**

Create `workflows/docs/proposal-generator.yaml`:
```yaml
name: proposal-generator
label: Proposal Generator
category: docs
description: Copies a proposal template Doc and renames it for a specific client
inputs:
  - name: template_doc_id
    description: Google Doc ID of the proposal template
    required: true
  - name: client_name
    description: Client name for the proposal
    required: true
  - name: project_scope
    description: Brief description of project scope
    required: true
steps:
  - id: copy_template
    command: gws drive files copy
    args: ["{template_doc_id}", "--name", "Proposal - {client_name}"]
output:
  format: summary
```

- [ ] **Step 2: Create meeting-notes-action-items.yaml**

Create `workflows/docs/meeting-notes-action-items.yaml`:
```yaml
name: meeting-notes-action-items
label: Meeting Notes to Action Items
category: docs
description: Reads a meeting notes Google Doc and extracts action items as a structured summary
inputs:
  - name: doc_id
    description: Google Doc ID containing meeting notes
    required: true
  - name: spreadsheet_id
    description: Google Sheets spreadsheet ID for tracking action items
    required: true
steps:
  - id: read_doc
    command: gws docs documents get
    args: ["{doc_id}"]
  - id: read_sheet
    command: gws sheets spreadsheets values get
    args: ["{spreadsheet_id}", "Action Items"]
output:
  format: summary
```

- [ ] **Step 3: Create doc-summarizer.yaml**

Create `workflows/docs/doc-summarizer.yaml`:
```yaml
name: doc-summarizer
label: Doc Summarizer
category: docs
description: Summarizes any Google Doc into a 5-bullet TL;DR
inputs:
  - name: doc_id
    description: Google Doc ID to summarize
    required: true
steps:
  - id: read_doc
    command: gws docs documents get
    args: ["{doc_id}"]
output:
  format: summary
```

- [ ] **Step 4: Create template-cloner.yaml**

Create `workflows/docs/template-cloner.yaml`:
```yaml
name: template-cloner
label: Template Cloner
category: docs
description: Duplicates a master template Doc into a new named file in a specified Drive folder
inputs:
  - name: template_doc_id
    description: Google Doc ID of the template to clone
    required: true
  - name: new_name
    description: Name for the new document
    required: true
  - name: folder_id
    description: Google Drive folder ID where the new doc will be placed
    required: true
steps:
  - id: copy_doc
    command: gws drive files copy
    args: ["{template_doc_id}", "--name", "{new_name}", "--parents", "{folder_id}"]
output:
  format: summary
```

- [ ] **Step 5: Verify all 4 docs workflows load**

```bash
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
['proposal-generator','meeting-notes-action-items','doc-summarizer','template-cloner'].forEach(n => {
  const f = fs.readFileSync('workflows/docs/' + n + '.yaml', 'utf-8');
  const c = yaml.load(f);
  console.log('OK:', c.name, '-', c.label);
});
"
```
Expected:
```
OK: proposal-generator - Proposal Generator
OK: meeting-notes-action-items - Meeting Notes to Action Items
OK: doc-summarizer - Doc Summarizer
OK: template-cloner - Template Cloner
```

- [ ] **Step 6: Commit**

```bash
git add workflows/docs/
git commit -m "feat: add 4 Google Docs workflow YAML configs"
```

---

## Task 12: Google Sheets Workflow YAMLs

**Files:**
- Create: `workflows/sheets/expense-categorizer.yaml`
- Create: `workflows/sheets/cross-sheet-consolidator.yaml`
- Create: `workflows/sheets/data-cleanup.yaml`

- [ ] **Step 1: Create expense-categorizer.yaml**

Create `workflows/sheets/expense-categorizer.yaml`:
```yaml
name: expense-categorizer
label: Expense Categorizer
category: sheets
description: Reads expense rows from a Sheet and produces a categorized summary
inputs:
  - name: spreadsheet_id
    description: Google Sheets spreadsheet ID containing expenses
    required: true
  - name: sheet_name
    description: Name of the sheet tab with expenses
    default: "Expenses"
steps:
  - id: read_expenses
    command: gws sheets spreadsheets values get
    args: ["{spreadsheet_id}", "{sheet_name}"]
output:
  format: summary
```

- [ ] **Step 2: Create cross-sheet-consolidator.yaml**

Create `workflows/sheets/cross-sheet-consolidator.yaml`:
```yaml
name: cross-sheet-consolidator
label: Cross-Sheet Consolidator
category: sheets
description: Reads data from a spreadsheet across all its sheets and produces a consolidated summary
inputs:
  - name: spreadsheet_id
    description: Google Sheets spreadsheet ID to consolidate
    required: true
steps:
  - id: spreadsheet_info
    command: gws sheets spreadsheets get
    args: ["{spreadsheet_id}"]
  - id: read_data
    command: gws sheets spreadsheets values get
    args: ["{spreadsheet_id}", "Sheet1"]
output:
  format: summary
```

- [ ] **Step 3: Create data-cleanup.yaml**

Create `workflows/sheets/data-cleanup.yaml`:
```yaml
name: data-cleanup
label: Data Cleanup
category: sheets
description: Scans a Sheet for duplicates, empty required fields, and formatting issues
inputs:
  - name: spreadsheet_id
    description: Google Sheets spreadsheet ID to audit
    required: true
  - name: sheet_name
    description: Name of the sheet tab to audit
    default: "Sheet1"
steps:
  - id: read_sheet
    command: gws sheets spreadsheets values get
    args: ["{spreadsheet_id}", "{sheet_name}"]
output:
  format: summary
```

- [ ] **Step 4: Verify all 3 sheets workflows load**

```bash
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
['expense-categorizer','cross-sheet-consolidator','data-cleanup'].forEach(n => {
  const f = fs.readFileSync('workflows/sheets/' + n + '.yaml', 'utf-8');
  const c = yaml.load(f);
  console.log('OK:', c.name, '-', c.label);
});
"
```
Expected:
```
OK: expense-categorizer - Expense Categorizer
OK: cross-sheet-consolidator - Cross-Sheet Consolidator
OK: data-cleanup - Data Cleanup
```

- [ ] **Step 5: Verify all 19 workflows load via build**

```bash
npm run build
```
Expected: Build succeeds. Full runtime verification of all 19 workflows is done in Task 16 Step 5 when the dev server is running.

- [ ] **Step 6: Commit**

```bash
git add workflows/sheets/
git commit -m "feat: add 3 Google Sheets workflow YAML configs — all 19 workflows complete"
```

---

## Task 13: API Routes

**Files:**
- Create: `app/api/chat/route.ts`
- Create: `app/api/workflow/route.ts`

- [ ] **Step 1: Create the workflow list/run API route**

Create `app/api/workflow/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { listWorkflows, executeWorkflow, loadWorkflow } from '@/lib/workflow-engine';
import { formatWorkflowResult } from '@/lib/response-formatter';

export async function GET() {
  const workflows = listWorkflows();
  return NextResponse.json(workflows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, params } = body as { name: string; params?: Record<string, string> };

  if (!name) {
    return NextResponse.json({ error: 'Workflow name required' }, { status: 400 });
  }

  try {
    const config = loadWorkflow(name);
    const result = await executeWorkflow(name, params ?? {});
    const formatted = await formatWorkflowResult(config.label, result.raw);
    return NextResponse.json({ result: formatted, raw: result.raw });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the chat streaming API route**

Create `app/api/chat/route.ts`:
```typescript
import { NextRequest } from 'next/server';
import { routeIntent } from '@/lib/intent-router';
import { executeWorkflow, loadWorkflow } from '@/lib/workflow-engine';
import { runGwsCommand } from '@/lib/gws-runner';
import { formatWorkflowResult, formatGeneralCommandResult } from '@/lib/response-formatter';

function sseChunk(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: NextRequest) {
  const { message } = (await req.json()) as { message: string };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(sseChunk({ type: 'status', text: 'Understanding your request...' }));

        const intent = await routeIntent(message);

        if (intent.type === 'workflow' && intent.workflowName) {
          const config = loadWorkflow(intent.workflowName);
          controller.enqueue(sseChunk({ type: 'status', text: `Running: ${config.label}...` }));

          const result = await executeWorkflow(intent.workflowName, intent.params ?? {});
          const formatted = await formatWorkflowResult(config.label, result.raw);
          controller.enqueue(sseChunk({ type: 'result', text: formatted }));
        } else if (intent.type === 'general-command' && intent.gwsCommand) {
          controller.enqueue(sseChunk({ type: 'status', text: `Running command...` }));

          const cmdParts = intent.gwsCommand.replace(/^gws\s+/, '').split(' ');
          const raw = await runGwsCommand(cmdParts);
          const formatted = await formatGeneralCommandResult(intent.gwsCommand, raw);
          controller.enqueue(sseChunk({ type: 'result', text: formatted }));
        } else {
          controller.enqueue(sseChunk({ type: 'result', text: "I wasn't sure how to handle that. Try selecting a workflow from the sidebar or rephrasing your request." }));
        }

        controller.enqueue(sseChunk({ type: 'done' }));
        controller.close();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(sseChunk({ type: 'error', text: msg }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

- [ ] **Step 3: Verify API routes compile**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/api/
git commit -m "feat: add chat SSE and workflow REST API routes"
```

---

## Task 14: UI Components

**Files:**
- Create: `components/message-bubble.tsx`
- Create: `components/workflow-card.tsx`
- Create: `components/workflow-sidebar.tsx`
- Create: `components/chat-interface.tsx`

- [ ] **Step 1: Create message-bubble.tsx**

Create `components/message-bubble.tsx`:
```tsx
'use client';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'status';
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === 'status') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-1 px-4">
        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        {content}
      </div>
    );
  }

  if (role === 'user') {
    return (
      <div className="flex justify-end px-4 py-1">
        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%] text-sm">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start px-4 py-1">
      <div className="bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm prose prose-invert prose-sm max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create workflow-card.tsx**

Create `components/workflow-card.tsx`:
```tsx
'use client';
import { WorkflowConfig } from '@/types';

interface WorkflowCardProps {
  workflow: WorkflowConfig;
  onSelect: (workflow: WorkflowConfig) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  email: 'bg-blue-900 text-blue-300',
  calendar: 'bg-purple-900 text-purple-300',
  admin: 'bg-yellow-900 text-yellow-300',
  'client-tracking': 'bg-green-900 text-green-300',
  docs: 'bg-orange-900 text-orange-300',
  sheets: 'bg-teal-900 text-teal-300',
};

export function WorkflowCard({ workflow, onSelect }: WorkflowCardProps) {
  return (
    <button
      onClick={() => onSelect(workflow)}
      className="w-full text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-100 group-hover:text-white">
          {workflow.label}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[workflow.category] ?? 'bg-gray-700 text-gray-300'}`}
        >
          {workflow.category}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{workflow.description}</p>
    </button>
  );
}
```

- [ ] **Step 3: Create workflow-sidebar.tsx**

Create `components/workflow-sidebar.tsx`:
```tsx
'use client';
import { WorkflowConfig, WorkflowCategory } from '@/types';
import { WorkflowCard } from './workflow-card';

interface WorkflowSidebarProps {
  workflows: WorkflowConfig[];
  onSelect: (workflow: WorkflowConfig) => void;
}

const CATEGORIES: WorkflowCategory[] = [
  'email', 'calendar', 'admin', 'client-tracking', 'docs', 'sheets',
];

const CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  email: 'Email',
  calendar: 'Calendar',
  admin: 'Admin / Reporting',
  'client-tracking': 'Client Tracking',
  docs: 'Google Docs',
  sheets: 'Google Sheets',
};

export function WorkflowSidebar({ workflows, onSelect }: WorkflowSidebarProps) {
  return (
    <aside className="w-72 shrink-0 h-full overflow-y-auto bg-gray-900 border-r border-gray-700 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Workflows
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {CATEGORIES.map(category => {
          const categoryWorkflows = workflows.filter(w => w.category === category);
          if (categoryWorkflows.length === 0) return null;
          return (
            <div key={category}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
                {CATEGORY_LABELS[category]}
              </p>
              <div className="space-y-1">
                {categoryWorkflows.map(w => (
                  <WorkflowCard key={w.name} workflow={w} onSelect={onSelect} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Create chat-interface.tsx**

Create `components/chat-interface.tsx`:
```tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { WorkflowConfig } from '@/types';
import { MessageBubble } from './message-bubble';

interface ChatInterfaceProps {
  selectedWorkflow: WorkflowConfig | null;
  onWorkflowClear: () => void;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'status';
  content: string;
}

export function ChatInterface({ selectedWorkflow, onWorkflowClear }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Welcome to **GoogolOS**. Select a workflow from the sidebar or ask me anything about your Google Workspace.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedWorkflow) {
      setInput(`Run ${selectedWorkflow.label}`);
    }
  }, [selectedWorkflow]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: DisplayMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    const statusId = `s-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: statusId, role: 'status', content: 'Thinking...' },
    ]);
    setInput('');
    setIsLoading(true);
    onWorkflowClear();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      let resultText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const json = JSON.parse(line.slice(6)) as { type: string; text?: string };

          if (json.type === 'status') {
            setMessages(prev =>
              prev.map(m => (m.id === statusId ? { ...m, content: json.text ?? '' } : m))
            );
          } else if (json.type === 'result' || json.type === 'error') {
            resultText = json.text ?? '';
          }
        }
      }

      setMessages(prev => [
        ...prev.filter(m => m.id !== statusId),
        { id: `a-${Date.now()}`, role: 'assistant', content: resultText || 'Done.' },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.filter(m => m.id !== statusId),
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.map(msg => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-700 p-4">
        {selectedWorkflow && (
          <div className="mb-2 flex items-center gap-2 text-xs text-blue-400">
            <span>
              Workflow: <strong>{selectedWorkflow.label}</strong>
            </span>
            <button
              onClick={onWorkflowClear}
              className="text-gray-500 hover:text-gray-300 ml-auto"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask anything or select a workflow..."
            disabled={isLoading}
            className="flex-1 bg-gray-800 text-gray-100 rounded-xl px-4 py-3 text-sm placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript accepts all components**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/
git commit -m "feat: add chat UI and workflow sidebar components"
```

---

## Task 15: Main Page and Layout

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update layout.tsx**

Replace `app/layout.tsx` with:
```tsx
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GoogolOS',
  description: 'Google Workspace Automation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geist.className} bg-gray-950 h-full`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Update page.tsx**

Replace `app/page.tsx` with:
```tsx
'use client';
import { useState, useEffect } from 'react';
import { WorkflowConfig } from '@/types';
import { WorkflowSidebar } from '@/components/workflow-sidebar';
import { ChatInterface } from '@/components/chat-interface';

export default function Home() {
  const [workflows, setWorkflows] = useState<WorkflowConfig[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowConfig | null>(null);

  useEffect(() => {
    fetch('/api/workflow')
      .then(res => res.json())
      .then(setWorkflows)
      .catch(console.error);
  }, []);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <WorkflowSidebar workflows={workflows} onSelect={setSelectedWorkflow} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 py-3 border-b border-gray-700 flex items-center gap-3 shrink-0">
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
            G
          </div>
          <h1 className="text-sm font-semibold">GoogolOS</h1>
          <span className="text-xs text-gray-500 ml-auto">Google Workspace Automation</span>
        </header>
        <ChatInterface
          selectedWorkflow={selectedWorkflow}
          onWorkflowClear={() => setSelectedWorkflow(null)}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Final build check**

```bash
npm run build
```
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: wire up main page with sidebar and chat interface"
```

---

## Task 16: End-to-End Verification

- [ ] **Step 1: Set your Anthropic API key**

Add your real key to `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 2: Authenticate GWS CLI**

```bash
gws auth login
```
Expected: Browser opens for Google OAuth. Complete the flow. Credentials stored locally by GWS CLI.

- [ ] **Step 3: Smoke test GWS CLI directly**

```bash
gws gmail messages list --maxResults 5
```
Expected: JSON output with email message IDs.

- [ ] **Step 4: Start dev server**

```bash
npm run dev
```
Expected: Server running at http://localhost:3000

- [ ] **Step 5: Verify workflow library loads**

Open http://localhost:3000 — sidebar should show all 19 workflows grouped by category.

- [ ] **Step 6: Test workflow via chat**

Type: `Show me my daily agenda`

Expected:
1. Status bubble: "Understanding your request..."
2. Status bubble: "Running: Daily Agenda..."
3. Assistant response: Markdown summary of today's calendar events

- [ ] **Step 7: Test workflow via sidebar click**

Click "Morning Digest" in the sidebar → input auto-fills with "Run Morning Digest" → press Send.

Expected: Formatted email digest appears in chat.

- [ ] **Step 8: Test General Command mode**

Type: `How many unread emails do I have?`

Expected: Claude routes to a general `gws gmail messages list` command, returns formatted count.

- [ ] **Step 9: Run all tests one final time**

```bash
npm test
```
Expected: All 14 tests passing.

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "chore: complete GoogolOS MVP — 19 workflows, chat UI, GWS CLI integration"
```

---

## Post-MVP Checklist (not in scope now)

- [ ] Add Google OAuth per-user flow (Supabase for token storage)
- [ ] Add workflow parameter prompt UI (for required inputs like `spreadsheet_id`)
- [ ] Add Vercel Cron for scheduled workflows
- [ ] Submit for Google OAuth verification (granular Gmail scopes to avoid audit)
- [ ] Apply for Google Workspace Marketplace listing

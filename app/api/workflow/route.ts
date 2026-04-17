import { NextRequest, NextResponse } from 'next/server';
import { listWorkflows, executeWorkflow, loadWorkflow } from '@/lib/workflow-engine';
import { formatWorkflowResult } from '@/lib/response-formatter';
import { runInboxLabeler } from '@/lib/inbox-labeler';

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
    // Native workflows that bypass the YAML engine
    if (name === 'inbox-labeler') {
      const maxEmails = params?.max_emails ? parseInt(params.max_emails, 10) : 200;
      const { summary } = await runInboxLabeler(maxEmails);
      return NextResponse.json({ result: summary });
    }

    const config = loadWorkflow(name);
    const result = await executeWorkflow(name, params ?? {});
    const formatted = await formatWorkflowResult(config.label, result.raw);
    return NextResponse.json({ result: formatted, raw: result.raw });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

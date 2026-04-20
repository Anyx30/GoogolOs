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
    let formatted: string;
    try {
      formatted = await formatWorkflowResult(config.label, result.raw);
    } catch {
      formatted = '```json\n' + JSON.stringify(result.raw, null, 2) + '\n```';
    }
    return NextResponse.json({ result: formatted, raw: result.raw });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

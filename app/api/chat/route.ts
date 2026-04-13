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

          const cmdParts = intent.gwsCommand.replace(/^gws\s+/, '').split(/\s+/);
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

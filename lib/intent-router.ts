import Anthropic from '@anthropic-ai/sdk';
import { IntentMatch } from '@/types';
import { listWorkflows } from './workflow-engine';

export async function routeIntent(userMessage: string): Promise<IntentMatch> {
  const client = new Anthropic();
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

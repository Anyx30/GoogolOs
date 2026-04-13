import Anthropic from '@anthropic-ai/sdk';
import { IntentMatch } from '@/types';
import { listWorkflows } from './workflow-engine';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export async function routeIntent(userMessage: string): Promise<IntentMatch> {
  const client = getClient();
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

  const block = response.content[0];
  const text = block?.type === 'text' ? block.text.trim() : '';

  try {
    return JSON.parse(text) as IntentMatch;
  } catch {
    return { type: 'general-command', gwsCommand: 'gws gmail messages list --maxResults 10' };
  }
}

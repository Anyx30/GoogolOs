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
- If it is a general GWS query: {"type":"general-command","gwsCommand":"gws <service> <resource> <method>","gwsParams":{"param":"value"}}

GWS command format rules:
- Gmail: gws gmail users messages list  (always include "users" resource)
- Calendar: gws calendar events list
- Drive: gws drive files list
- Sheets: gws sheets spreadsheets values get
- Put ALL query/path parameters in gwsParams as a JSON object (not in the command string)
- Gmail always needs userId: "me" in gwsParams

Extract params from the user message. Use workflow defaults for missing params.`,
      },
    ],
  });

  const block = response.content[0];
  const raw = block?.type === 'text' ? block.text.trim() : '';

  // Strip markdown code fences if the model wrapped the JSON
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(text) as IntentMatch;
  } catch {
    // Last resort: extract first {...} JSON object from the response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as IntentMatch;
      } catch {
        // fall through
      }
    }
    return { type: 'general-command', gwsCommand: 'gws gmail users messages list', gwsParams: { userId: 'me', maxResults: 10 } };
  }
}

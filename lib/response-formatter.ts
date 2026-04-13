import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export async function formatWorkflowResult(
  workflowLabel: string,
  raw: unknown
): Promise<string> {
  const client = getClient();
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

  const block = response.content[0];
  return block?.type === 'text' ? block.text : 'No output';
}

export async function formatGeneralCommandResult(
  command: string,
  raw: unknown
): Promise<string> {
  const client = getClient();
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

  const block = response.content[0];
  return block?.type === 'text' ? block.text : 'No output';
}

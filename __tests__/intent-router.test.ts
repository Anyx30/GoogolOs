import { routeIntent } from '@/lib/intent-router';

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
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

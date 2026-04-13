import { formatWorkflowResult, formatGeneralCommandResult } from '@/lib/response-formatter';

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
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

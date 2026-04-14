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
      ['gmail', 'users', 'messages', 'list', '--params', expect.stringContaining('"q":"is:unread newer_than:12h"')]
    );
  });

  it('applies default param values when not provided', async () => {
    mockRun.mockResolvedValue({ messages: [] });

    await executeWorkflow('morning-digest', {});

    expect(mockRun).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('newer_than:24h')])
    );
  });
});

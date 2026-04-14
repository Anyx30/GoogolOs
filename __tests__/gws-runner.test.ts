import { runGwsCommand } from '@/lib/gws-runner';

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

import { execFile } from 'child_process';

const mockExecFile = execFile as unknown as jest.Mock;

describe('runGwsCommand', () => {
  beforeEach(() => jest.clearAllMocks());

  it('executes gws command and returns parsed JSON', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: object, cb: (...args: unknown[]) => void) => {
      cb(null, JSON.stringify({ messages: [{ id: 'abc', snippet: 'Hello' }] }), '');
    });

    const result = await runGwsCommand(['gmail', 'users', 'messages', 'list', '--params', '{"userId":"me"}']);
    expect(result).toEqual({ messages: [{ id: 'abc', snippet: 'Hello' }] });
  });

  it('calls execFile with gws binary and args array', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: object, cb: (...args: unknown[]) => void) => {
      cb(null, '{}', '');
    });

    await runGwsCommand(['calendar', 'events', 'list', '--params', '{"calendarId":"primary"}']);
    expect(mockExecFile).toHaveBeenCalledWith(
      'gws',
      ['calendar', 'events', 'list', '--params', '{"calendarId":"primary"}'],
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('returns raw string when output is not JSON', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: object, cb: (...args: unknown[]) => void) => {
      cb(null, 'plain text output', '');
    });

    const result = await runGwsCommand(['some', 'command']);
    expect(result).toBe('plain text output');
  });

  it('throws when execFile reports an error', async () => {
    mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: object, cb: (...args: unknown[]) => void) => {
      cb(new Error('command not found'), '', '');
    });

    await expect(runGwsCommand(['bad', 'command'])).rejects.toThrow('command not found');
  });
});

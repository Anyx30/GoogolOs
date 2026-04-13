import { runGwsCommand } from '@/lib/gws-runner';

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

import { exec } from 'child_process';

const mockExec = exec as unknown as jest.Mock;

describe('runGwsCommand', () => {
  beforeEach(() => jest.clearAllMocks());

  it('executes gws command and returns parsed JSON', async () => {
    mockExec.mockImplementation((_cmd: string, _opts: object, cb: (...args: unknown[]) => void) => {
      cb(null, JSON.stringify({ messages: [{ id: 'abc', snippet: 'Hello' }] }), '');
    });

    const result = await runGwsCommand(['gmail', 'messages', 'list', '--maxResults', '5']);
    expect(result).toEqual({ messages: [{ id: 'abc', snippet: 'Hello' }] });
  });

  it('constructs the correct gws command string', async () => {
    mockExec.mockImplementation((_cmd: string, _opts: object, cb: (...args: unknown[]) => void) => {
      cb(null, '{}', '');
    });

    await runGwsCommand(['calendar', 'events', 'list', '--calendarId', 'primary']);
    expect(mockExec).toHaveBeenCalledWith(
      'gws calendar events list --calendarId primary',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('returns raw string when output is not JSON', async () => {
    mockExec.mockImplementation((_cmd: string, _opts: object, cb: (...args: unknown[]) => void) => {
      cb(null, 'plain text output', '');
    });

    const result = await runGwsCommand(['some', 'command']);
    expect(result).toBe('plain text output');
  });

  it('throws when exec reports an error', async () => {
    mockExec.mockImplementation((_cmd: string, _opts: object, cb: (...args: unknown[]) => void) => {
      cb(new Error('command not found'), '', '');
    });

    await expect(runGwsCommand(['bad', 'command'])).rejects.toThrow('command not found');
  });
});

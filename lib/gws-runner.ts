import { execFile } from 'child_process';

export interface GwsRunnerOptions {
  timeout?: number;
}

export async function runGwsCommand(
  args: string[],
  options: GwsRunnerOptions = {}
): Promise<unknown> {
  const { timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    execFile('gws', args, { timeout }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(stdout);
      }
    });
  });
}

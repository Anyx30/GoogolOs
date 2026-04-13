import { exec } from 'child_process';

export interface GwsRunnerOptions {
  timeout?: number;
}

export async function runGwsCommand(
  args: string[],
  options: GwsRunnerOptions = {}
): Promise<unknown> {
  const { timeout = 30000 } = options;
  const command = `gws ${args.join(' ')}`;

  return new Promise((resolve, reject) => {
    exec(command, { timeout }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr) {
        reject(new Error(`GWS CLI error: ${stderr}`));
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

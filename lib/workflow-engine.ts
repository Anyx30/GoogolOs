import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { WorkflowConfig, WorkflowResult, StepResult } from '@/types';
import { runGwsCommand } from './gws-runner';

const WORKFLOWS_DIR = path.join(process.cwd(), 'workflows');

const CATEGORIES = ['email', 'calendar', 'admin', 'client-tracking', 'docs', 'sheets'];

export function loadWorkflow(name: string): WorkflowConfig {
  for (const category of CATEGORIES) {
    const filePath = path.join(WORKFLOWS_DIR, category, `${name}.yaml`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return yaml.load(content) as WorkflowConfig;
    }
  }
  throw new Error(`Workflow not found: ${name}`);
}

export function listWorkflows(): WorkflowConfig[] {
  const configs: WorkflowConfig[] = [];

  for (const category of CATEGORIES) {
    const categoryPath = path.join(WORKFLOWS_DIR, category);
    if (!fs.existsSync(categoryPath)) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.yaml'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(categoryPath, file), 'utf-8');
      configs.push(yaml.load(content) as WorkflowConfig);
    }
  }

  return configs;
}

function resolveArgs(
  args: string[],
  params: Record<string, string>,
  stepResultMap: Record<string, unknown>
): string[] {
  return args.map(arg =>
    arg
      .replace(/\{(\w+)\}/g, (_, key) => params[key] ?? '')
      .replace(/\{(\w+)\.(\w+)\}/g, (_, stepId, field) => {
        const result = stepResultMap[stepId];
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          return String((result as Record<string, unknown>)[field] ?? '');
        }
        return '';
      })
  );
}

function resolveValue(
  value: unknown,
  resolvedParams: Record<string, string>,
  stepResultMap: Record<string, unknown>
): unknown {
  if (typeof value === 'string') {
    const substituted = value
      .replace(/\{(\w+)\}/g, (_, key) => resolvedParams[key] ?? '')
      .replace(/\{(\w+)\.(\w+)\}/g, (_, stepId, field) => {
        const result = stepResultMap[stepId];
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          return String((result as Record<string, unknown>)[field] ?? '');
        }
        return '';
      });
    // Coerce to number if result is purely numeric
    if (/^\d+$/.test(substituted.trim())) return parseInt(substituted, 10);
    if (/^\d+\.\d+$/.test(substituted.trim())) return parseFloat(substituted);
    return substituted;
  }
  if (Array.isArray(value)) {
    return value.map(item => resolveValue(item, resolvedParams, stepResultMap));
  }
  return value; // boolean, number, null — keep as-is
}

function resolveParamObject(
  params: Record<string, unknown>,
  resolvedParams: Record<string, string>,
  stepResultMap: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(params)) {
    result[key] = resolveValue(val, resolvedParams, stepResultMap);
  }
  return result;
}

export async function executeWorkflow(
  name: string,
  params: Record<string, string> = {}
): Promise<WorkflowResult> {
  const config = loadWorkflow(name);
  const resolvedParams = { ...params };

  for (const input of config.inputs) {
    if (!(input.name in resolvedParams) && input.default !== undefined) {
      resolvedParams[input.name] = input.default;
    }
  }

  const stepResults: StepResult[] = [];
  const stepResultMap: Record<string, unknown> = {};

  for (const step of config.steps) {
    if (step.foreach) {
      const sourceData = stepResultMap[step.foreach];
      const items = Array.isArray(sourceData) ? sourceData : [sourceData];
      const results: unknown[] = [];

      for (const item of items) {
        const itemParams = {
          ...resolvedParams,
          ...(typeof item === 'object' && item !== null ? (item as Record<string, string>) : {}),
        };
        // Build command parts
        let cmdParts: string[];
        if (step.params !== undefined || step.body !== undefined) {
          cmdParts = step.command.replace(/^gws\s+/, '').split(/\s+/);
          if (step.params) {
            const resolvedParamObj = resolveParamObject(step.params, itemParams, stepResultMap);
            cmdParts.push('--params', JSON.stringify(resolvedParamObj));
          }
          if (step.body) {
            const resolvedBody = resolveParamObject(step.body, itemParams, stepResultMap);
            cmdParts.push('--json', JSON.stringify(resolvedBody));
          }
        } else if (step.args) {
          const resolvedArgs = resolveArgs(step.args, itemParams, stepResultMap);
          cmdParts = [...step.command.replace(/^gws\s+/, '').split(/\s+/), ...resolvedArgs];
        } else {
          cmdParts = step.command.replace(/^gws\s+/, '').split(/\s+/);
        }
        const result = await runGwsCommand(cmdParts);
        results.push(result);
      }

      stepResultMap[step.id] = results;
      stepResults.push({ stepId: step.id, data: results });
    } else {
      // Build command parts
      let cmdParts: string[];
      if (step.params !== undefined || step.body !== undefined) {
        cmdParts = step.command.replace(/^gws\s+/, '').split(/\s+/);
        if (step.params) {
          const resolvedParamObj = resolveParamObject(step.params, resolvedParams, stepResultMap);
          cmdParts.push('--params', JSON.stringify(resolvedParamObj));
        }
        if (step.body) {
          const resolvedBody = resolveParamObject(step.body, resolvedParams, stepResultMap);
          cmdParts.push('--json', JSON.stringify(resolvedBody));
        }
      } else if (step.args) {
        const resolvedArgs = resolveArgs(step.args, resolvedParams, stepResultMap);
        cmdParts = [...step.command.replace(/^gws\s+/, '').split(/\s+/), ...resolvedArgs];
      } else {
        cmdParts = step.command.replace(/^gws\s+/, '').split(/\s+/);
      }
      const result = await runGwsCommand(cmdParts);
      stepResultMap[step.id] = result;
      stepResults.push({ stepId: step.id, data: result });
    }
  }

  return { workflowName: name, steps: stepResults, raw: stepResultMap };
}

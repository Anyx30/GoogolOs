export interface WorkflowInput {
  name: string;
  description?: string;
  default?: string;
  required?: boolean;
}

export interface WorkflowStep {
  id: string;
  command: string;
  args?: string[];
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  foreach?: string;
}

export interface WorkflowOutput {
  format: 'summary' | 'list' | 'table' | 'raw';
  template?: string;
}

export type WorkflowCategory =
  | 'email'
  | 'calendar'
  | 'admin'
  | 'client-tracking'
  | 'docs'
  | 'sheets';

export interface WorkflowConfig {
  name: string;
  label: string;
  category: WorkflowCategory;
  description: string;
  inputs: WorkflowInput[];
  steps: WorkflowStep[];
  output: WorkflowOutput;
}

export interface StepResult {
  stepId: string;
  data: unknown;
  error?: string;
}

export interface WorkflowResult {
  workflowName: string;
  steps: StepResult[];
  raw: Record<string, unknown>;
}

export interface IntentMatch {
  type: 'workflow' | 'general-command';
  workflowName?: string;
  params?: Record<string, string>;
  gwsCommand?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

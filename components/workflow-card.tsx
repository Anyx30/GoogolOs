'use client';
import { WorkflowConfig } from '@/types';

interface WorkflowCardProps {
  workflow: WorkflowConfig;
  onSelect: (workflow: WorkflowConfig) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  email: 'bg-blue-900/60 text-blue-300',
  calendar: 'bg-purple-900/60 text-purple-300',
  admin: 'bg-yellow-900/60 text-yellow-300',
  'client-tracking': 'bg-green-900/60 text-green-300',
  docs: 'bg-orange-900/60 text-orange-300',
  sheets: 'bg-teal-900/60 text-teal-300',
};

export function WorkflowCard({ workflow, onSelect }: WorkflowCardProps) {
  return (
    <button
      onClick={() => onSelect(workflow)}
      className="w-full text-left p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700/70 border border-gray-700/50 hover:border-gray-600/70 transition-all duration-150 group"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors leading-tight">
          {workflow.label}
        </span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${CATEGORY_COLORS[workflow.category] ?? 'bg-gray-700 text-gray-300'}`}
        >
          {workflow.category}
        </span>
      </div>
      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{workflow.description}</p>
    </button>
  );
}

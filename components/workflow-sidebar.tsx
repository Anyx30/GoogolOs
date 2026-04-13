'use client';
import { WorkflowConfig, WorkflowCategory } from '@/types';
import { WorkflowCard } from './workflow-card';

interface WorkflowSidebarProps {
  workflows: WorkflowConfig[];
  onSelect: (workflow: WorkflowConfig) => void;
}

const CATEGORIES: WorkflowCategory[] = [
  'email', 'calendar', 'admin', 'client-tracking', 'docs', 'sheets',
];

const CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  email: 'Email',
  calendar: 'Calendar',
  admin: 'Admin / Reporting',
  'client-tracking': 'Client Tracking',
  docs: 'Google Docs',
  sheets: 'Google Sheets',
};

const CATEGORY_ICONS: Record<WorkflowCategory, string> = {
  email: '✉',
  calendar: '📅',
  admin: '📊',
  'client-tracking': '👤',
  docs: '📄',
  sheets: '🗂',
};

export function WorkflowSidebar({ workflows, onSelect }: WorkflowSidebarProps) {
  const total = workflows.length;

  return (
    <aside className="w-72 shrink-0 h-full flex flex-col bg-gray-900 border-r border-gray-800">
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Workflows
          </h2>
          {total > 0 && (
            <span className="text-xs text-gray-600 tabular-nums">{total}</span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
        {CATEGORIES.map(category => {
          const categoryWorkflows = workflows.filter(w => w.category === category);
          if (categoryWorkflows.length === 0) return null;
          return (
            <div key={category}>
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <span className="text-xs opacity-60">{CATEGORY_ICONS[category]}</span>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {CATEGORY_LABELS[category]}
                </p>
              </div>
              <div className="space-y-1">
                {categoryWorkflows.map(w => (
                  <WorkflowCard key={w.name} workflow={w} onSelect={onSelect} />
                ))}
              </div>
            </div>
          );
        })}
        {total === 0 && (
          <div className="px-1 py-8 text-center">
            <p className="text-xs text-gray-600">Loading workflows...</p>
          </div>
        )}
      </div>
    </aside>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { WorkflowConfig } from '@/types';
import { WorkflowSidebar } from '@/components/workflow-sidebar';
import { ChatInterface } from '@/components/chat-interface';

export default function Home() {
  const [workflows, setWorkflows] = useState<WorkflowConfig[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowConfig | null>(null);

  useEffect(() => {
    fetch('/api/workflow')
      .then(res => res.json())
      .then(setWorkflows)
      .catch(console.error);
  }, []);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <WorkflowSidebar workflows={workflows} onSelect={setSelectedWorkflow} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 py-3 border-b border-gray-800 flex items-center gap-3 shrink-0 bg-gray-950">
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
            G
          </div>
          <h1 className="text-sm font-semibold tracking-tight">GoogolOS</h1>
          <span className="text-xs text-gray-600 ml-auto">Google Workspace Automation</span>
        </header>
        <ChatInterface
          selectedWorkflow={selectedWorkflow}
          onWorkflowClear={() => setSelectedWorkflow(null)}
        />
      </main>
    </div>
  );
}

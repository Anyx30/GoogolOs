'use client';
import { useState, useRef, useEffect } from 'react';
import { WorkflowConfig } from '@/types';
import { MessageBubble } from './message-bubble';

interface ChatInterfaceProps {
  selectedWorkflow: WorkflowConfig | null;
  onWorkflowClear: () => void;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'status';
  content: string;
}

export function ChatInterface({ selectedWorkflow, onWorkflowClear }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Welcome to **GoogolOS**. Select a workflow from the sidebar or ask me anything about your Google Workspace.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedWorkflow) {
      setInput(`Run ${selectedWorkflow.label}`);
      inputRef.current?.focus();
    }
  }, [selectedWorkflow]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: DisplayMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    const statusId = `s-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: statusId, role: 'status', content: 'Thinking...' },
    ]);
    setInput('');
    setIsLoading(true);
    onWorkflowClear();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      let resultText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(line.slice(6)) as { type: string; text?: string };

            if (json.type === 'status') {
              setMessages(prev =>
                prev.map(m => (m.id === statusId ? { ...m, content: json.text ?? '' } : m))
              );
            } else if (json.type === 'result' || json.type === 'error') {
              resultText = json.text ?? '';
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      setMessages(prev => [
        ...prev.filter(m => m.id !== statusId),
        { id: `a-${Date.now()}`, role: 'assistant', content: resultText || 'Done.' },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.filter(m => m.id !== statusId),
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.map(msg => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 bg-gray-950 p-4">
        {selectedWorkflow && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="text-blue-400">
              Workflow: <span className="font-semibold">{selectedWorkflow.label}</span>
            </span>
            <button
              onClick={onWorkflowClear}
              className="ml-auto text-gray-600 hover:text-gray-400 transition-colors text-base leading-none"
              aria-label="Clear selected workflow"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask anything or select a workflow..."
            disabled={isLoading}
            className="flex-1 bg-gray-800 text-gray-100 rounded-xl px-4 py-3 text-sm placeholder-gray-600 border border-gray-700 focus:outline-none focus:border-blue-500/70 focus:bg-gray-800 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

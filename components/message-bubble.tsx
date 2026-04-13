'use client';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'status';
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === 'status') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-1 px-4">
        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        {content}
      </div>
    );
  }

  if (role === 'user') {
    return (
      <div className="flex justify-end px-4 py-1">
        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%] text-sm">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start px-4 py-1">
      <div className="bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

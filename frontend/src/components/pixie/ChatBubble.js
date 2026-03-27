import React from 'react';
import { ActionBadgeList } from './ActionBadge';

export function ChatBubble({ message, isUser }) {
  const align = isUser ? 'justify-end' : 'justify-start';
  const bg = isUser
    ? 'bg-primary text-white rounded-br-md'
    : 'bg-slate-800/80 text-slate-200 border border-slate-700/50 rounded-bl-md';

  return (
    <div className={`flex ${align} mb-3`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${bg}`}
        data-testid={isUser ? 'pixie-user-msg' : 'pixie-bot-msg'}>
        {message.isVoice && <p className="text-[10px] opacity-60 mb-0.5 italic">Voice</p>}
        <p className="whitespace-pre-wrap">{message.content}</p>
        <ActionBadgeList actions={message.actions} />
      </div>
    </div>
  );
}

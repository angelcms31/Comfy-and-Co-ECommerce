import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bot, SendHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ChatSender } from '@/services/chatService';

// pieces shared by the customer chat bubble and the admin Chats page

export const timeOf = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const WHO: Record<ChatSender, string> = { customer: 'Customer', bot: 'Assistant', admin: 'Staff' };

export function MessageBubble({
  sender,
  mine,
  name,
  time,
  children,
}: {
  sender: ChatSender;
  mine: boolean; // shown on the right in dark green
  name?: string | null;
  time?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      {!mine && (
        <span className="flex items-center gap-1 px-1 text-[11px] font-medium text-muted">
          {sender === 'bot' && <Bot className="size-3.5" />}
          {name || WHO[sender]}
        </span>
      )}
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          mine ? 'rounded-br-md bg-forest text-white' : sender === 'bot' ? 'rounded-bl-md bg-cream text-ink' : 'rounded-bl-md bg-mint-light text-ink',
        )}
      >
        {children}
      </div>
      {time && <span className="px-1 text-[10px] text-muted">{time}</span>}
    </div>
  );
}

export function Suggestions({ items, onPick, disabled }: { items: string[]; onPick: (s: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="rounded-full border border-forest/40 bg-white px-3 py-1 text-xs font-medium text-forest transition-colors hover:bg-mint-light disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// keeps a message list scrolled to the newest message whenever it changes
export function useStickToBottom<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}

// Enter sends, Shift+Enter adds a new line
export function Composer({ onSend, disabled, placeholder = 'Type a message...' }: { onSend: (text: string) => void; disabled?: boolean; placeholder?: string }) {
  const [text, setText] = useState('');
  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  };
  return (
    <form
      className="flex items-end gap-2 border-t border-line bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <textarea
        rows={1}
        value={text}
        maxLength={1000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={placeholder}
        aria-label="Message"
        className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-line bg-white px-3.5 py-2 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-mint"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        aria-label="Send"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-forest text-white transition-opacity hover:bg-forest/90 disabled:opacity-40"
      >
        <SendHorizontal className="size-4" />
      </button>
    </form>
  );
}

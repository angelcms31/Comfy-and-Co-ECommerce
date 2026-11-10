import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail, MessageCircle, Phone, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import StatusPill from '@/components/ui/StatusPill';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { Composer, MessageBubble, timeOf, useStickToBottom } from '@/components/chat/ChatParts';
import { useAsync } from '@/hooks/useAsync';
import { usePolling } from '@/hooks/usePolling';
import { cn } from '@/lib/cn';
import { formatPeso } from '@/lib/pricing';
import { chatService, type AdminChat, type ChatThread } from '@/services/chatService';
import AdminPageHeader from './AdminPageHeader';
import { FilterPills } from './AdminUi';

type Filter = 'waiting' | 'all';

function ThreadRow({ t, active, onOpen }: { t: ChatThread; active: boolean; onOpen: () => void }) {
  const preview = t.last_message ? `${t.last_message.sender === 'admin' ? 'You: ' : t.last_message.sender === 'bot' ? 'Bot: ' : ''}${t.last_message.body}` : '';
  return (
    <li>
      <button
        onClick={onOpen}
        className={cn('flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors', active ? 'bg-mint-light' : 'hover:bg-cream')}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mint font-semibold text-forest">{t.customer_name.charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className={cn('truncate text-sm text-ink', t.unread ? 'font-semibold' : 'font-medium')}>{t.customer_name}</span>
            <span className="shrink-0 text-[11px] text-muted">{timeOf(t.last_message_at)}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={cn('truncate text-xs', t.unread ? 'text-ink' : 'text-muted')}>{preview}</span>
            {t.unread > 0 && (
              <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-coral-dark px-1 text-[11px] font-semibold leading-5 text-white">{t.unread}</span>
            )}
          </span>
          {t.needs_staff && <span className="mt-1 inline-block rounded-full bg-butter px-2 py-0.5 text-[10px] font-semibold text-forest">Waiting for staff</span>}
        </span>
      </button>
    </li>
  );
}

function Conversation({ threadId, onBack, onChanged }: { threadId: number; onBack: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [chat, setChat] = useState<AdminChat | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    chatService
      .open(threadId)
      .then((c) => {
        setChat(c);
        setError('');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the chat'));
  }, [threadId]);

  useEffect(() => {
    setChat(null);
    load();
  }, [load]);
  usePolling(load, 5000);
  // opening the chat marks it read, so the list badge updates
  useEffect(() => {
    if (chat) onChanged();
  }, [chat?.thread.thread_id]);

  const listRef = useStickToBottom<HTMLDivElement>(chat?.messages.length);

  const act = async (action: () => Promise<AdminChat>, done?: string) => {
    setBusy(true);
    try {
      setChat(await action());
      onChanged();
      if (done) toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (error && !chat) return <ErrorState message={error} onRetry={load} />;
  if (!chat) return <LoadingState label="Loading chat..." />;
  const { thread, messages, orders } = chat;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line p-4">
        <button onClick={onBack} className="rounded-full p-1.5 text-forest hover:bg-cream lg:hidden" aria-label="Back to chats">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{thread.customer_name}</p>
          <p className="flex flex-wrap gap-x-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1 break-all">
              <Mail className="size-3" /> {thread.email}
            </span>
            {thread.mobile_no && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" /> {thread.mobile_no}
              </span>
            )}
          </p>
        </div>
        {thread.needs_staff ? (
          <Button size="sm" variant="outline" className="shrink-0" loading={busy} onClick={() => act(() => chatService.setResolved(thread.thread_id, true), 'Marked as resolved')}>
            <CheckCircle2 className="size-4" /> Mark resolved
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="shrink-0" loading={busy} onClick={() => act(() => chatService.setResolved(thread.thread_id, false))}>
            <RotateCcw className="size-4" /> Reopen
          </Button>
        )}
      </header>

      {orders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-cream/60 px-4 py-2">
          <span className="text-xs text-muted">Recent orders:</span>
          {orders.map((o) => (
            <span key={o.order_id} className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1 text-xs">
              <span className="font-medium">#{o.order_num}</span>
              {formatPeso(o.total_amt)}
              <StatusPill status={o.order_stat} />
            </span>
          ))}
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <MessageBubble
            key={m.message_id}
            sender={m.sender}
            mine={m.sender === 'admin'}
            name={m.sender === 'customer' ? thread.customer_name : undefined}
            time={`${m.sender === 'admin' && m.admin_name ? `${m.admin_name} · ` : ''}${timeOf(m.created_at)}`}
          >
            {m.body}
          </MessageBubble>
        ))}
      </div>
      {!thread.needs_staff && <p className="px-4 pb-1 text-center text-xs text-muted">The assistant is answering this chat. Replying takes it over.</p>}
      <Composer onSend={(text) => act(() => chatService.reply(thread.thread_id, text))} disabled={busy} placeholder={`Reply to ${thread.customer_name.split(' ')[0]}...`} />
    </div>
  );
}

// customers' chats: the bot answers first, and chats where they asked for staff are listed on top
export default function ChatsPage() {
  const threads = useAsync(() => chatService.list(), []);
  const [filter, setFilter] = useState<Filter>('waiting');
  const [openId, setOpenId] = useState<number | null>(null);
  const { reload, setData } = threads;
  // background refresh: keeps the list on screen if one request fails
  const refresh = useCallback(() => {
    chatService.list().then(setData).catch(() => {});
  }, [setData]);
  usePolling(refresh, 10000);

  const all = threads.data ?? [];
  const waiting = all.filter((t) => t.needs_staff);
  const rows = filter === 'waiting' ? waiting : all;

  return (
    <div>
      <AdminPageHeader title="Chats" subtitle="Talk with customers. The assistant answers common questions; chats asking for staff wait here." />

      {threads.loading && !threads.data ? (
        <LoadingState label="Loading chats..." layout="list" />
      ) : threads.error && !threads.data ? (
        <ErrorState message={threads.error} onRetry={reload} />
      ) : !all.length ? (
        <EmptyState title="No chats yet" message="When customers use the chat button on the store, their chats show up here." />
      ) : (
        <div className="grid h-[calc(100dvh-14rem)] min-h-[28rem] overflow-hidden rounded-card border border-line bg-white lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className={cn('flex min-h-0 flex-col border-line lg:border-r', openId !== null && 'hidden lg:flex')}>
            <FilterPills
              className="border-b border-line p-3"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'waiting', label: `Waiting for staff (${waiting.length})` },
                { value: 'all', label: `All (${all.length})` },
              ]}
            />
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">No chats are waiting for staff.</p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {rows.map((t) => (
                  <ThreadRow key={t.thread_id} t={t} active={t.thread_id === openId} onOpen={() => setOpenId(t.thread_id)} />
                ))}
              </ul>
            )}
          </aside>
          <div className={cn('min-h-0 min-w-0', openId === null && 'hidden lg:block')}>
            {openId === null ? (
              <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
                <span>
                  <MessageCircle className="mx-auto mb-2 size-8 text-forest/40" />
                  Pick a chat to read and reply.
                </span>
              </div>
            ) : (
              <Conversation threadId={openId} onBack={() => setOpenId(null)} onChanged={refresh} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

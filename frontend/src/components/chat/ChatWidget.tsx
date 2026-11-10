import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Headset, MessageCircle, X } from 'lucide-react';
import LoadingDots from '@/components/ui/LoadingDots';
import { useAuth } from '@/context/AuthContext';
import { usePolling } from '@/hooks/usePolling';
import { isAdmin } from '@/lib/roles';
import { chatService, type ChatMessage, type CustomerChat } from '@/services/chatService';
import { Composer, MessageBubble, Suggestions, timeOf, useStickToBottom } from './ChatParts';

// same text and buttons as backend/app/chatbot.py, shown before the first message
const GREETING = "Hi! I'm the comfy&co assistant. Ask me about shipping, payment, your orders or returns, or pick a topic below.";
const SUGGESTIONS = ['Shipping & delivery', 'Payment methods', 'Track my order', 'Returns & refunds', 'Store hours & location', 'Talk to staff'];

// guests only talk to the bot, and the chat lives in this component until the page is reloaded
interface GuestMessage {
  id: number;
  sender: 'customer' | 'bot';
  body: string;
  login?: boolean; // they asked for staff: show the log in / contact links
}

// floating chat button on every store page. Logged-in customers' chats are saved and answered by staff.
export default function ChatWidget() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(0);
  const [chat, setChat] = useState<CustomerChat | null>(null);
  const [guest, setGuest] = useState<GuestMessage[]>([]);
  const [pending, setPending] = useState<string | null>(null); // the customer's message while it's being sent

  const customer = !!user && !isAdmin(user);

  // a different person logged in (or out): start fresh
  useEffect(() => {
    setChat(null);
    setGuest([]);
    setUnread(0);
  }, [user?.user_id]);

  const load = useCallback(() => {
    if (!customer) return;
    chatService
      .getMine()
      .then((c) => {
        setChat(c);
        setUnread(0);
        setError('');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the chat'));
  }, [customer]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);
  usePolling(load, 5000, open && customer);
  // the badge: staff replies that came in while the chat was closed
  const checkUnread = useCallback(() => {
    chatService.unread().then((r) => setUnread(r.unread)).catch(() => {});
  }, []);
  useEffect(() => {
    if (customer && !open) checkUnread();
  }, [customer, open, checkUnread]);
  usePolling(checkUnread, 30000, customer && !open);

  const send = async (text: string) => {
    setBusy(true);
    setError('');
    setPending(text);
    try {
      if (customer) {
        setChat(await chatService.send(text));
      } else {
        const id = Date.now();
        setGuest((g) => [...g, { id, sender: 'customer', body: text }]);
        const r = await chatService.faq(text);
        const reply: GuestMessage = r.handoff
          ? { id: id + 1, sender: 'bot', body: 'Our staff can chat with you once you log in, so we can see your orders.', login: true }
          : { id: id + 1, sender: 'bot', body: r.body ?? '' };
        setGuest((g) => [...g, reply]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Message not sent, please try again');
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const messages: (ChatMessage | GuestMessage)[] = customer ? (chat?.messages ?? []) : guest;
  const listRef = useStickToBottom<HTMLDivElement>(`${messages.length}-${pending}-${open}`);

  // admins answer from the admin Chats page; the checkout and GCash pages keep the screen clear
  if (isAdmin(user) || pathname.startsWith('/checkout')) return null;

  const withStaff = customer && !!chat?.needs_staff;
  const loading = customer && !chat && !error;

  return (
    <>
      {/* docked to the bottom of the screen like a messenger window: full width on phones (over the tab bar), bottom right on bigger screens */}
      {open && (
        <section
          aria-label="Chat with comfy&co"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[min(36rem,85dvh)] flex-col overflow-hidden rounded-t-card border border-b-0 border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgb(29_43_38/0.18)] sm:left-auto sm:right-6 sm:w-96"
        >
          <header className="flex items-center gap-3 bg-forest px-4 py-3 text-white">
            <span className="grid size-9 place-items-center rounded-full bg-mint text-forest">
              {withStaff ? <Headset className="size-5" /> : <MessageCircle className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold leading-tight">comfy&amp;co help</p>
              <p className="text-xs text-white/75">{withStaff ? 'Chatting with our staff' : 'Assistant · answers right away'}</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-full p-1.5 hover:bg-white/10">
              <X className="size-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-white p-4" aria-live="polite">
            {loading ? (
              <div className="grid h-full place-items-center">
                <LoadingDots />
              </div>
            ) : (
              <>
                <MessageBubble sender="bot" mine={false}>
                  {GREETING}
                </MessageBubble>
                {messages.map((m) => (
                  <MessageBubble
                    key={'message_id' in m ? m.message_id : m.id}
                    sender={m.sender}
                    mine={m.sender === 'customer'}
                    name={'admin_name' in m && m.admin_name ? m.admin_name : undefined}
                    time={'created_at' in m ? timeOf(m.created_at) : undefined}
                  >
                    {m.body}
                    {'login' in m && m.login && (
                      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-semibold">
                        <Link to="/login" state={{ from: pathname }} onClick={() => setOpen(false)} className="text-forest underline">
                          Log in
                        </Link>
                        <Link to="/contact" onClick={() => setOpen(false)} className="text-forest underline">
                          Or send us a message
                        </Link>
                      </span>
                    )}
                  </MessageBubble>
                ))}
                {pending && customer && (
                  <MessageBubble sender="customer" mine>
                    {pending}
                  </MessageBubble>
                )}
                {busy && (
                  <div className="px-1">
                    <LoadingDots size="sm" />
                  </div>
                )}
                {withStaff && <p className="text-center text-xs text-muted">A staff member will reply here. You can close this and keep browsing.</p>}
                {!withStaff && !busy && <Suggestions items={chat?.suggestions ?? SUGGESTIONS} onPick={send} disabled={busy} />}
              </>
            )}
            {error && <p className="text-center text-xs text-coral-dark">{error}</p>}
          </div>

          <Composer onSend={send} disabled={busy || loading} placeholder={withStaff ? 'Message our staff...' : 'Ask a question...'} />
        </section>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={unread ? `Open chat, ${unread} new replies` : 'Open chat'}
          aria-expanded={false}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 grid size-14 place-items-center rounded-full bg-forest text-white shadow-lg transition-transform hover:scale-105 lg:bottom-6 lg:right-6"
        >
          <MessageCircle className="size-6" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-coral-dark px-1 text-[11px] font-semibold leading-5 text-white">
              {unread}
            </span>
          )}
        </button>
      )}
    </>
  );
}

import { http } from '@/lib/http';
import type { OrderStat } from '@/types/db';

// store chat (backend/app/routers/chat.py). The FAQ bot answers anyone; logged-in customers' chats are saved for staff.

export type ChatSender = 'customer' | 'bot' | 'admin';

export interface ChatMessage {
  message_id: number;
  sender: ChatSender;
  body: string;
  created_at: string;
  admin_name: string | null; // who replied, shown as "Angel (Admin)" (or just "Admin")
}

export interface CustomerChat {
  needs_staff: boolean; // a staff member was asked to join, the bot stays quiet until it's resolved
  messages: ChatMessage[];
  suggestions: string[];
}

export interface FaqReply {
  body: string | null; // null when they asked for a person
  handoff: boolean;
  suggestions: string[];
}

export interface ChatThread {
  thread_id: number;
  user_id: string;
  needs_staff: boolean;
  last_message_at: string;
  customer_name: string;
  email: string;
  mobile_no: string | null;
  unread: number; // customer messages no admin has opened yet
  last_message: { sender: ChatSender; body: string } | null;
}

export interface AdminChat {
  thread: ChatThread;
  messages: ChatMessage[];
  orders: { order_id: number; order_num: number; order_stat: OrderStat; total_amt: number; placed_at: string }[];
}

export const chatService = {
  faq: (body: string) => http<FaqReply>('/chat/faq', { method: 'POST', body: { body } }),

  // customers
  getMine: () => http<CustomerChat>('/chat'),
  unread: () => http<{ unread: number }>('/chat/unread'),
  send: (body: string) => http<CustomerChat>('/chat/messages', { method: 'POST', body: { body } }),
  askStaff: () => http<CustomerChat>('/chat/staff', { method: 'POST' }),

  // admins
  list: () => http<ChatThread[]>('/admin/chats'),
  adminUnread: () => http<{ unread: number }>('/admin/chats/unread'),
  open: (threadId: number) => http<AdminChat>(`/admin/chats/${threadId}`),
  reply: (threadId: number, body: string) => http<AdminChat>(`/admin/chats/${threadId}/messages`, { method: 'POST', body: { body } }),
  setResolved: (threadId: number, resolved: boolean) => http<AdminChat>(`/admin/chats/${threadId}`, { method: 'PATCH', body: { resolved } }),
};

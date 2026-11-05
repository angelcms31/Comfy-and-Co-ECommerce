import { http } from '@/lib/http';

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactMessage {
  message_id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
}

export const contactService = {
  // saves the message and says which inbox it should go to
  send: (input: ContactInput) => http<{ to: string | null }>('/contact', { method: 'POST', body: input }),
  getAll: () => http<ContactMessage[]>('/admin/messages'),
};

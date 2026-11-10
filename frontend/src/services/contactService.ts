import { http } from '@/lib/http';

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const contactService = {
  // emails the message to the store and a receipt to the customer; `receipt` is false when the copy couldn't be sent
  send: (input: ContactInput) => http<{ to: string; receipt: boolean }>('/contact', { method: 'POST', body: input }),
};

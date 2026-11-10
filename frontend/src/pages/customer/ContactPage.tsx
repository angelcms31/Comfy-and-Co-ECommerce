import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, MapPin, Map as MapIcon, Phone, Send } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input, { Select, Textarea } from '@/components/ui/Input';
import SocialIcons from '@/components/ui/SocialIcons';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useStoreInfo } from '@/hooks/useStoreInfo';
import { MAX_MESSAGE_WORDS, STORE_SOCIAL } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { emailError } from '@/lib/email';
import { contactService } from '@/services/contactService';

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const SUBJECTS = [
  { value: 'order', label: 'Order or delivery concern' },
  { value: 'refund', label: 'Refund request' },
  { value: 'product', label: 'Product question' },
  { value: 'other', label: 'Something else' },
];

function Info({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-forest text-white">{icon}</span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-ink">{title}</p>
        <div className="text-muted">{children}</div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  const { user } = useAuth();
  const toast = useToast();
  const store = useStoreInfo();
  const [params] = useSearchParams();
  const order = params.get('order');

  const [form, setForm] = useState({
    name: user?.full_name ?? '',
    email: user?.email ?? '',
    subject: params.get('subject') ?? (order ? 'order' : ''),
    message: order ? `Order #${order}: ` : '',
  });
  // the account can finish loading after the page opens
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: user.full_name, email: user.email }));
  }, [user]);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const [sending, setSending] = useState(false);
  const words = wordCount(form.message);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!form.name.trim()) found.name = 'Please enter your name';
    const badEmail = emailError(form.email);
    if (badEmail) found.email = badEmail;
    if (!form.subject) found.subject = 'Please pick a subject';
    if (!form.message.trim()) found.message = 'Please write your message';
    else if (wordCount(form.message) > MAX_MESSAGE_WORDS) found.message = `Keep your message to ${MAX_MESSAGE_WORDS} words or less`;
    setErrors(found);
    if (Object.keys(found).length) return;

    // opened right away because browsers block new tabs that only open after waiting for the server
    const gmail = window.open('', '_blank');
    if (gmail) gmail.opener = null;
    setSending(true);
    try {
      const { to } = await contactService.send({ name: form.name.trim(), email: form.email.trim(), subject: form.subject, message: form.message.trim() });
      const subject = SUBJECTS.find((s) => s.value === form.subject)?.label ?? 'Inquiry';
      const body = `${form.message.trim()}\n\nFrom: ${form.name.trim()} (${form.email.trim()})`;
      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to ?? store.support_email)}&su=${encodeURIComponent(`[Comfy&Co] ${subject}`)}&body=${encodeURIComponent(body)}`;
      if (gmail) gmail.location.href = url;
      else window.location.href = url;
      toast.info("Almost done! We've prepared your message in Gmail. Hit Send there to deliver it.");
      setForm((f) => ({ ...f, subject: '', message: '' }));
    } catch (err) {
      gmail?.close();
      toast.error(err instanceof Error ? err.message : 'Could not send your message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Contact Us</h1>
      <p className="mt-1 text-muted">Have a question or need help? Get in touch!</p>

      {/* title on top, then the details card and the form side by side: same top, same height */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
        <div className="space-y-5 rounded-card border border-ink/20 bg-white p-5 sm:p-6">
          <Info icon={<MapPin className="size-5" />} title="Located at">
            <p>{store.address}</p>
          </Info>
          {/* the map shows right away (no click needed); it follows the address saved in Settings */}
          <div className="overflow-hidden rounded-xl border border-line">
            <iframe
              title={`Map of ${store.address}`}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(store.address)}&z=16&output=embed`}
              className="block h-56 w-full sm:h-64"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(store.address)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 border-t border-line bg-cream py-2 text-xs font-medium text-forest hover:bg-mint-light"
            >
              <MapIcon className="size-3.5" /> Get directions in Google Maps
            </a>
          </div>
          <Info icon={<Phone className="size-5" />} title={`Hours (${store.hours})`}>
            <a href={`tel:${store.phone.replace(/\s/g, '')}`} className="hover:text-forest">
              {store.phone}
            </a>
          </Info>
          <Info icon={<Mail className="size-5" />} title="Email">
            <a href={`mailto:${store.support_email}`} className="break-all hover:text-forest">
              {store.support_email}
            </a>
          </Info>
          <div className="border-t border-line pt-4">
            <p className="text-sm font-semibold text-ink">Follow us on our social media</p>
            <p className="mt-2 flex items-center gap-3 text-forest">
              <SocialIcons />
              <span className="text-sm text-ink">{STORE_SOCIAL}</span>
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="flex flex-col rounded-card border border-forest/30 bg-mint-light p-5 sm:p-7">
          {!user && (
            <p className="-mx-5 -mt-5 mb-5 rounded-t-card border-b border-forest/20 bg-white/60 px-5 py-2.5 text-center text-xs text-muted sm:-mx-7 sm:-mt-7 sm:mb-6">
              Already have an account?{' '}
              <Link to="/login" state={{ from: '/contact' }} className="font-medium text-forest underline">
                Log in
              </Link>{' '}
              to auto-fill your details
            </p>
          )}
          <div className="flex flex-1 flex-col gap-4">
            <Input label="Name" placeholder="e.g., Juan Dela Cruz" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} disabled={!!user} />
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g., juan@example.com"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
              disabled={!!user}
            />
            <Select label="What can we help you with?" value={form.subject} onChange={set('subject')} error={errors.subject}>
              <option value="" disabled>
                Select subject
              </option>
              {SUBJECTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Textarea
              grow
              label="Message"
              placeholder="Tell us what's on your mind..."
              rows={4}
              value={form.message}
              onChange={set('message')}
              error={errors.message}
              invalid={words > MAX_MESSAGE_WORDS}
            />
            {/* live word count, turns red past the limit */}
            <p className={cn('-mt-2 text-right text-xs', words > MAX_MESSAGE_WORDS ? 'font-semibold text-coral-dark' : 'text-muted')} aria-live="polite">
              {words} / {MAX_MESSAGE_WORDS} words
            </p>
            <Button type="submit" size="lg" className="w-full" loading={sending}>
              Send message <Send className="size-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, MapPin, Map as MapIcon, Phone, Send } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input, { Select, Textarea } from '@/components/ui/Input';
import SocialIcons from '@/components/ui/SocialIcons';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useStoreInfo } from '@/hooks/useStoreInfo';
import { STORE_SOCIAL } from '@/lib/constants';
import { contactService } from '@/services/contactService';

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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!form.name.trim()) found.name = 'Please enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) found.email = 'Please enter a valid email';
    if (!form.subject) found.subject = 'Please pick a subject';
    if (!form.message.trim()) found.message = 'Please write your message';
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
    <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
      <div>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Contact Us</h1>
        <p className="mt-1 text-muted">Have a question or need help? Get in touch!</p>

        <div className="mt-6 space-y-5 rounded-card border border-ink/20 bg-white p-5 sm:p-6">
          <Info icon={<MapPin className="size-5" />} title="Located at">
            <p>{store.address}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-forest px-3 py-1 text-xs font-medium text-forest hover:bg-mint-light"
            >
              <MapIcon className="size-3.5" /> View on map
            </a>
          </Info>
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
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <p className="font-semibold text-ink">Follow us on our social media</p>
          <p className="mt-2 flex items-center gap-3 text-forest">
            <SocialIcons />
            <span className="text-sm text-ink">{STORE_SOCIAL}</span>
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate className="self-start rounded-card border border-forest/30 bg-mint-light p-5 sm:p-7">
        {!user && (
          <p className="-mx-5 -mt-5 mb-5 rounded-t-card border-b border-forest/20 bg-white/60 px-5 py-2.5 text-center text-xs text-muted sm:-mx-7 sm:-mt-7 sm:mb-6">
            Already have an account?{' '}
            <Link to="/login" state={{ from: '/contact' }} className="font-medium text-forest underline">
              Log in
            </Link>{' '}
            to auto-fill your details
          </p>
        )}
        <div className="space-y-4">
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
          <Textarea label="Message" placeholder="Tell us what's on your mind..." rows={4} value={form.message} onChange={set('message')} error={errors.message} />
          <Button type="submit" size="lg" className="w-full" loading={sending}>
            Send message <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

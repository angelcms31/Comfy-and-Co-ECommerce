import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserX } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ACCOUNT_DELETE_DAYS } from '@/lib/constants';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services/userService';
import { toDay } from '@/lib/dates';
import { AddressFields, contactFromUser, contactPatch, NameMobileFields, validateContact, type ContactErrors, type ContactForm } from './AddressFields';

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<ContactForm>(() => contactFromUser(user!));
  const [birthdate, setBirthdate] = useState(user?.birthdate ?? '');
  const [errors, setErrors] = useState<ContactErrors & { birthdate?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  if (!user) return null; // RequireLogin handles this

  const onChange = (patch: Partial<ContactForm>) => setForm((f) => ({ ...f, ...patch }));
  const changed = birthdate !== (user.birthdate ?? '') || JSON.stringify(contactPatch(form)) !== JSON.stringify(contactPatch(contactFromUser(user)));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // mobile, birthdate and address are optional like on sign up, checkout asks for what it needs
    const found: typeof errors = validateContact(form, false);
    if (birthdate && birthdate >= toDay()) found.birthdate = 'Birthdate must be in the past';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      updateUser(await userService.updateProfile({ ...contactPatch(form), birthdate: birthdate || null }));
      toast.success('Your profile was saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setDeactivating(true);
    try {
      await userService.deactivate();
      await logout();
      navigate('/', { replace: true });
      toast.info('Your account was deactivated. Thank you for shopping with us.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not deactivate your account');
      setDeactivating(false);
    }
  };

  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      <form onSubmit={onSubmit} noValidate className="rounded-card border border-line bg-white p-5 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-forest">My Profile</h1>
            <p className="mt-1 text-sm text-muted">Update your personal details and preferences</p>
          </div>
          {user.role === 'customer' && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-coral-dark px-3.5 py-1.5 text-sm font-medium text-coral-dark transition-colors hover:bg-cancelled"
            >
              <UserX className="size-4" /> Deactivate Account
            </button>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <NameMobileFields form={form} errors={errors} onChange={onChange} disabled={saving} />
          <Input
            label="Birthdate"
            type="date"
            max={toDay()}
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            error={errors.birthdate}
            disabled={saving}
          />
          <Input label="Email Address" type="email" value={user.email} disabled hint="Your email is used to log in and can't be changed here." />

          <h2 className="pt-3 font-sans text-sm font-semibold text-ink">Address</h2>
          <AddressFields form={form} errors={errors} onChange={onChange} disabled={saving} />
        </div>

        <Button type="submit" size="lg" className="mt-8 w-full" loading={saving} disabled={!changed}>
          Save Changes
        </Button>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate your account?"
        danger
        loading={deactivating}
        confirmLabel="Yes, deactivate"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={deactivate}
        message={`You'll be logged out right away. Your account and personal details will be permanently deleted after ${ACCOUNT_DELETE_DAYS} days. Contact us before then if you change your mind. Your past orders stay on record.`}
      />
    </div>
  );
}

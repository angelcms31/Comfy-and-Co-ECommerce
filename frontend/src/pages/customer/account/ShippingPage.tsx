import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services/userService';
import { AddressFields, contactFromUser, contactPatch, NameMobileFields, validateContact, type ContactErrors, type ContactForm } from './AddressFields';

// opened from "Edit details" on the checkout page; saves to the profile (one address per user)
export default function ShippingPage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { search } = useLocation(); // keeps a Buy Now item when going back to checkout

  const [form, setForm] = useState<ContactForm>(() => contactFromUser(user!));
  const [errors, setErrors] = useState<ContactErrors>({});
  const [saving, setSaving] = useState(false);

  if (!user) return null; // RequireLogin handles this

  const onChange = (patch: Partial<ContactForm>) => setForm((f) => ({ ...f, ...patch }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateContact(form, true);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      updateUser(await userService.updateProfile(contactPatch(form)));
      toast.success('Shipping details saved.');
      navigate(`/checkout${search}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your details');
      setSaving(false);
    }
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <form onSubmit={onSubmit} noValidate className="rounded-card border border-line bg-white p-5 shadow-card sm:p-8">
        <Link to={`/checkout${search}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-forest">
          <ArrowLeft className="size-4" /> Back to checkout
        </Link>
        <h1 className="mb-6 mt-2 text-3xl font-semibold text-forest">Edit Shipping Information</h1>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <NameMobileFields form={form} errors={errors} onChange={onChange} required disabled={saving} />
          </div>
          <AddressFields form={form} errors={errors} onChange={onChange} required disabled={saving} />
        </div>

        <Button type="submit" size="lg" className="mt-8 w-full" loading={saving}>
          Save Changes
        </Button>
      </form>
    </div>
  );
}

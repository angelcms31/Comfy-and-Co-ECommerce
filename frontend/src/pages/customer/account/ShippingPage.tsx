import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import LocationPicker from '@/components/order/LocationPicker';
import { useAuth } from '@/context/AuthContext';
import { locationService } from '@/services/locationService';
import { userService } from '@/services/userService';
import { reverseGeocode, type LatLng } from '@/lib/tracking';
import { AddressFields, contactFromUser, contactPatch, NameMobileFields, validateContact, type ContactErrors, type ContactForm } from './AddressFields';

const MAX_NOTE = 300;

// opened from "Edit details" on the checkout page; saves to the profile (one address per user), with the map pin and rider notes
export default function ShippingPage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { search } = useLocation(); // keeps a Buy Now item when going back to checkout

  const [form, setForm] = useState<ContactForm>(() => contactFromUser(user!));
  const [pin, setPin] = useState<LatLng | null>(() => (user?.lat != null && user?.lng != null ? [user.lat, user.lng] : null));
  const [note, setNote] = useState(user?.delivery_note ?? '');
  const [errors, setErrors] = useState<ContactErrors>({});
  const [saving, setSaving] = useState(false);

  if (!user) return null; // RequireLogin handles this

  const onChange = (patch: Partial<ContactForm>) => setForm((f) => ({ ...f, ...patch }));

  // what the map looks for when there's no pin: the city name is known only while it's still the saved one
  const cityName = form.city_id && form.city_id === String(user.city_id ?? '') ? (user.city?.city ?? '') : '';
  const mapAddress = [form.st_add, cityName, form.postal, 'Philippines'].filter(Boolean).join(', ');

  // "Use my current location": the address at that spot goes into the fields above, the customer checks and fixes it
  const fillFromPin = async (point: LatLng) => {
    try {
      const [found, cities] = await Promise.all([reverseGeocode(point), locationService.getCities()]);
      if (!found) {
        toast.info('Pinned. We could not read the address there, please type it in.');
        return;
      }
      // "Quezon City" vs "City of Quezon", "Manila" vs "City of Manila": match on either name containing the other
      const norm = (s: string) => s.toLowerCase().replace(/^city of /, '').replace(/ city$/, '').trim();
      const want = norm(found.city);
      const city = want ? cities.find((c) => norm(c.city) === want) ?? cities.find((c) => norm(c.city).includes(want) || want.includes(norm(c.city))) : undefined;
      onChange({
        ...(found.street && { st_add: found.street }),
        ...(found.postal && { postal: found.postal }),
        ...(city && { city_id: String(city.city_id), country_id: String(city.country_id) }),
      });
      setErrors({});
      toast.info(city || !found.city ? 'Address filled in from your location. Please check it.' : `Address filled in. ${found.city} is not in our city list, please pick the nearest one.`);
    } catch {
      toast.info('Pinned. We could not read the address there, please type it in.');
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateContact(form, true);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      updateUser(
        await userService.updateProfile({
          ...contactPatch(form),
          lat: pin?.[0] ?? null,
          lng: pin?.[1] ?? null,
          delivery_note: note.trim() || null,
        }),
      );
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

          <div className="border-t border-line pt-4">
            <LocationPicker value={pin} address={mapAddress} onChange={setPin} onLocate={fillFromPin} disabled={saving} />
          </div>

          <Textarea
            label="Notes for the rider (optional)"
            rows={2}
            maxLength={MAX_NOTE}
            placeholder="e.g. Blue gate beside the sari-sari store, call when you arrive"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            hint={`${note.length}/${MAX_NOTE}`}
            disabled={saving}
          />
        </div>

        <Button type="submit" size="lg" className="mt-8 w-full" loading={saving}>
          Save Changes
        </Button>
      </form>
    </div>
  );
}

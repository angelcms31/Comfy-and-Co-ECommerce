import { useMemo } from 'react';
import Input, { Select } from '@/components/ui/Input';
import { useAsync } from '@/hooks/useAsync';
import { cleanMobile, isValidMobile, MOBILE_ERROR, MOBILE_LENGTH, MOBILE_REQUIRED, normalizeMobile } from '@/lib/mobile';
import { isValidName, NAME_ERROR } from '@/lib/names';
import { locationService } from '@/services/locationService';
import type { UserProfile } from '@/types/models';

// name, mobile and address fields shared by My Profile and Edit Shipping Information

export interface ContactForm {
  full_name: string;
  mobile_no: string;
  st_add: string;
  postal: string;
  city_id: string;
  country_id: string;
}

export type ContactErrors = Partial<Record<keyof ContactForm, string>>;

export const contactFromUser = (u: UserProfile): ContactForm => ({
  full_name: u.full_name,
  mobile_no: u.mobile_no ?? '',
  st_add: u.st_add ?? '',
  postal: u.postal ?? '',
  city_id: u.city_id ? String(u.city_id) : '',
  country_id: u.city ? String(u.city.country_id) : '',
});

export function validateContact(f: ContactForm, requireAddress: boolean): ContactErrors {
  const e: ContactErrors = {};
  if (!f.full_name.trim()) e.full_name = 'Please enter your name';
  else if (!isValidName(f.full_name)) e.full_name = NAME_ERROR;
  // the mobile number is always required
  if (!f.mobile_no.trim()) e.mobile_no = MOBILE_REQUIRED;
  else if (!isValidMobile(f.mobile_no)) e.mobile_no = MOBILE_ERROR;
  const anyAddress = f.st_add.trim() || f.postal.trim() || f.city_id;
  if (requireAddress || anyAddress) {
    if (!f.st_add.trim()) e.st_add = 'Please enter your street address';
    if (!/^\d{4}$/.test(f.postal.trim())) e.postal = '4 digits';
    if (!f.city_id) e.city_id = 'Pick a city';
  }
  return e;
}

export const contactPatch = (f: ContactForm) => ({
  full_name: f.full_name.trim(),
  mobile_no: normalizeMobile(f.mobile_no),
  st_add: f.st_add.trim() || null,
  postal: f.postal.trim() || null,
  city_id: f.city_id ? Number(f.city_id) : null,
});

interface Props {
  form: ContactForm;
  errors: ContactErrors;
  onChange: (patch: Partial<ContactForm>) => void;
  required?: boolean;
  disabled?: boolean;
}

const req = (on?: boolean) => (on ? <span className="text-coral-dark"> *</span> : null);

export function NameMobileFields({ form, errors, onChange, disabled }: Props) {
  return (
    <>
      <Input
        label={<>Full Name{req(true)}</>}
        autoComplete="name"
        value={form.full_name}
        onChange={(e) => onChange({ full_name: e.target.value })}
        error={errors.full_name}
        disabled={disabled}
      />
      <Input
        label={<>Mobile Number{req(true)}</>}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={MOBILE_LENGTH}
        placeholder="09171234567"
        value={form.mobile_no}
        onChange={(e) => onChange({ mobile_no: cleanMobile(e.target.value) })}
        error={errors.mobile_no}
        disabled={disabled}
      />
    </>
  );
}

export function AddressFields({ form, errors, onChange, required, disabled }: Props) {
  const cities = useAsync(() => locationService.getCities(), []);

  const countries = useMemo(() => {
    const seen = new Map<number, string>();
    for (const c of cities.data ?? []) seen.set(c.country_id, c.country.country);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [cities.data]);

  // with one country (Philippines) it's picked already
  const countryId = form.country_id || (countries.length === 1 ? String(countries[0].id) : '');
  const cityOptions = (cities.data ?? []).filter((c) => !countryId || String(c.country_id) === countryId);

  return (
    <>
      <Input
        label={<>Street Address{req(required)}</>}
        autoComplete="street-address"
        placeholder="House no., street, barangay"
        value={form.st_add}
        onChange={(e) => onChange({ st_add: e.target.value })}
        error={errors.st_add}
        disabled={disabled}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1.5fr_1.5fr]">
        <Input
          label={<>Postal Code{req(required)}</>}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={4}
          value={form.postal}
          onChange={(e) => onChange({ postal: e.target.value.replace(/\D/g, '') })}
          error={errors.postal}
          disabled={disabled}
        />
        <Select
          label={<>City{req(required)}</>}
          value={form.city_id}
          onChange={(e) => onChange({ city_id: e.target.value })}
          error={errors.city_id ?? (cities.error ? "Couldn't load cities" : null)}
          disabled={disabled || cities.loading}
        >
          <option value="">{cities.loading ? 'Loading...' : 'Select city'}</option>
          {cityOptions.map((c) => (
            <option key={c.city_id} value={c.city_id}>
              {c.city}
            </option>
          ))}
        </Select>
        <div className="col-span-2 sm:col-span-1">
        <Select
          label={<>Country{req(required)}</>}
          value={countryId}
          onChange={(e) => onChange({ country_id: e.target.value, city_id: '' })}
          disabled={disabled || countries.length <= 1}
        >
          {countries.length !== 1 && <option value="">Select country</option>}
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        </div>
      </div>
    </>
  );
}

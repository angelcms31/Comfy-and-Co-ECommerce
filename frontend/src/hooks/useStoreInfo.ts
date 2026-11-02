import { useEffect, useState } from 'react';
import { storeInfoService } from '@/services/adminService';
import { STORE_ADDRESS, STORE_EMAIL, STORE_HOURS, STORE_PHONE } from '@/lib/constants';
import type { StoreSettings } from '@/types/admin';

// shown until the saved values load, or if they can't
const FALLBACK: StoreSettings = { name: 'comfy&co', support_email: STORE_EMAIL, phone: STORE_PHONE, address: STORE_ADDRESS, hours: STORE_HOURS };

// loaded once per visit and shared by the footer and Contact Us (Super Admin edits it in Settings > Store Info)
let cached: Promise<StoreSettings> | null = null;

export function useStoreInfo() {
  const [info, setInfo] = useState<StoreSettings>(FALLBACK);
  useEffect(() => {
    cached ??= storeInfoService.get().catch(() => FALLBACK);
    let alive = true;
    cached.then((i) => alive && setInfo(i));
    return () => {
      alive = false;
    };
  }, []);
  return info;
}

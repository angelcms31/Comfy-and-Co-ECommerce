import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera, CheckCircle2, MapPin, Navigation, PackageX, Phone, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Input';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { deliveryService } from '@/services/orderService';
import { compressImage } from '@/lib/compressImage';
import { COURIER } from '@/lib/constants';
import { formatDateTime } from '@/lib/dates';
import { parseImages } from '@/lib/images';
import { formatPeso } from '@/lib/pricing';
import { geocode, type LatLng } from '@/lib/tracking';
import type { RiderOrder } from '@/types/models';

const MAX_PHOTOS = 3;

const pinIcon = L.divIcon({
  className: '',
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  html: '<svg width="30" height="40" viewBox="0 0 30 40" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))"><path d="M15 39S2 25.9 2 16a13 13 0 0 1 26 0c0 9.9-13 23-13 23z" fill="#1fb5a8" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>',
});

// small map with the customer's pin (or the address found on the map)
function DropMap({ point, address }: { point: LatLng | null; address: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current) return;
    const map = L.map(box.current, { scrollWheelZoom: false, zoomControl: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    let cancelled = false;
    const show = (p: LatLng) => {
      if (cancelled) return;
      L.marker(p, { icon: pinIcon }).addTo(map);
      map.setView(p, 16);
    };
    if (point) show(point);
    else {
      map.setView([14.5995, 120.9842], 11);
      geocode(address).then((p) => p && show(p)).catch(() => undefined);
    }
    return () => {
      cancelled = true;
      map.remove();
    };
  }, [point?.[0], point?.[1], address]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={box} className="h-56 w-full" />;
}

// The rider's page, opened from the QR code on the receipt. No login: the link itself is the key.
export default function DeliverPage() {
  const { orderNum = '', token = '' } = useParams();
  const { data, loading, error, reload, setData } = useAsync(() => deliveryService.get(orderNum, token), [orderNum, token]);
  const [mode, setMode] = useState<'idle' | 'photos' | 'failed'>('idle');
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (loading) return <div className="container-page max-w-lg py-8"><LoadingState label="Opening the delivery..." layout="detail" /></div>;
  if (error || !data) {
    return (
      <div className="container-page max-w-lg py-12">
        <ErrorState message={error ?? 'This delivery link is not valid'} onRetry={error?.toLowerCase().includes('not valid') ? undefined : reload} />
      </div>
    );
  }
  const order: RiderOrder = data;
  const point: LatLng | null = order.drop_lat != null && order.drop_lng != null ? [order.drop_lat, order.drop_lng] : null;
  const dest = point ? `${point[0]},${point[1]}` : order.address;
  const googleMaps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  const waze = point ? `https://waze.com/ul?ll=${point[0]},${point[1]}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(order.address)}&navigate=yes`;
  const attemptsLeft = order.max_attempts - order.attempts.length;
  const proof = parseImages(order.proof_photos);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setProblem(null);
    const room = MAX_PHOTOS - photos.length;
    const next = [...photos];
    for (const file of [...files].slice(0, room)) {
      const small = await compressImage(file);
      next.push({ file: small, url: URL.createObjectURL(small) });
    }
    setPhotos(next);
    if (input.current) input.current.value = '';
  };

  const confirm = async () => {
    if (!photos.length) return setProblem('Please take at least one photo of the delivered package.');
    setBusy(true);
    setProblem(null);
    try {
      setData(await deliveryService.confirm(orderNum, token, photos.map((p) => p.file)));
      setMode('idle');
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not send the photos, please try again');
    } finally {
      setBusy(false);
    }
  };

  const fail = async () => {
    if (!reason) return setProblem('Please pick what happened.');
    if (reason === 'Other' && !note.trim()) return setProblem('Please say what happened.');
    setBusy(true);
    setProblem(null);
    try {
      setData(await deliveryService.failed(orderNum, token, reason, note.trim()));
      setMode('idle');
      setReason('');
      setNote('');
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not save, please try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-forest px-4 py-3 text-white">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <img src="/logo.png" alt="" className="size-9" />
          <div>
            <p className="font-display text-lg font-semibold leading-tight">comfy&amp;co delivery</p>
            <p className="text-xs text-white/70">
              {COURIER} {order.vehicle ?? ''} · Order {order.order_num}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4 pb-10">
        {order.order_stat === 'Delivered' ? (
          <section className="rounded-card border border-line bg-white p-5 text-center shadow-card">
            <CheckCircle2 className="mx-auto size-14 text-forest" />
            <h1 className="mt-2 text-2xl font-semibold text-forest">Delivered</h1>
            <p className="text-sm text-muted">
              {order.delivered_at && formatDateTime(order.delivered_at)}. Thank you! The customer has been notified.
            </p>
            {proof.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {proof.map((src) => (
                  <img key={src} src={src} alt="" className="size-24 rounded-lg border border-line object-cover" />
                ))}
              </div>
            )}
          </section>
        ) : order.order_stat === 'Returned' ? (
          <section className="rounded-card border border-line bg-white p-5 text-center shadow-card">
            <PackageX className="mx-auto size-14 text-coral-dark" />
            <h1 className="mt-2 text-2xl font-semibold text-ink">Return to store</h1>
            <p className="text-sm text-muted">
              {order.attempts.length} delivery attempts failed. Please bring the package back to comfy&amp;co.
            </p>
          </section>
        ) : order.order_stat !== 'Shipped' ? (
          <section className="rounded-card border border-line bg-white p-5 text-center shadow-card">
            <h1 className="text-xl font-semibold text-ink">This order is not out for delivery</h1>
            <p className="text-sm text-muted">Its status is {order.order_stat}. Please check with the store.</p>
          </section>
        ) : (
          <>
            <section className="rounded-card border border-line bg-white p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Deliver to</p>
              <p className="mt-1 text-xl font-semibold text-ink">{order.customer_name}</p>
              <p className="flex items-start gap-2 text-sm text-ink">
                <MapPin className="mt-0.5 size-4 shrink-0 text-coral-dark" /> {order.address}
              </p>
              {order.delivery_note && (
                <p className="mt-2 rounded-lg bg-butter-light px-3 py-2 text-sm text-ink">
                  <span className="font-semibold">Customer's note:</span> {order.delivery_note}
                </p>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {order.mobile_no && (
                  <a href={`tel:${order.mobile_no}`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-forest text-sm font-medium text-white">
                    <Phone className="size-4" /> Call
                  </a>
                )}
                <a href={googleMaps} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-forest bg-white text-sm font-medium text-forest">
                  <Navigation className="size-4" /> Google Maps
                </a>
                <a href={waze} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-forest bg-white text-sm font-medium text-forest">
                  <Navigation className="size-4" /> Waze
                </a>
              </div>
            </section>

            <section className="overflow-hidden rounded-card border border-line bg-white shadow-card">
              <DropMap point={point} address={order.address} />
              <p className="px-4 py-2 text-xs text-muted">{point ? 'The pin is where the customer marked their house.' : 'No pin from the customer, the address was looked up on the map.'}</p>
            </section>

            <section className="rounded-card border border-line bg-white p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Package</p>
              <ul className="mt-1 divide-y divide-line text-sm">
                {order.items.map((i) => (
                  <li key={i.item_name} className="flex justify-between gap-3 py-1.5">
                    <span>{i.item_name}</span>
                    <span className="shrink-0 font-medium">× {i.quantity}</span>
                  </li>
                ))}
              </ul>
              <div className={`mt-3 rounded-xl p-3 ${order.collect_amt ? 'bg-butter-light' : 'bg-mint-light'}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{order.collect_amt ? 'Collect cash' : 'Already paid'}</p>
                <p className="text-2xl font-bold text-ink">{order.collect_amt ? formatPeso(order.collect_amt) : 'Paid by e-wallet, nothing to collect'}</p>
              </div>
            </section>

            {order.attempts.length > 0 && (
              <section className="rounded-card border border-coral-dark/40 bg-white p-4 text-sm shadow-card">
                <p className="font-semibold text-coral-dark">
                  {order.attempts.length} failed attempt{order.attempts.length > 1 ? 's' : ''} so far · {attemptsLeft} left before it goes back to the store
                </p>
                <ul className="mt-1 text-muted">
                  {order.attempts.map((a) => (
                    <li key={a.attempted_at}>
                      {formatDateTime(a.attempted_at)} · {a.reason}
                      {a.note && ` (${a.note})`}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {mode === 'idle' && (
              <div className="grid gap-2">
                <Button size="lg" onClick={() => setMode('photos')}>
                  <Camera className="size-5" /> Delivered, take photos
                </Button>
                <Button size="lg" variant="outline" onClick={() => setMode('failed')}>
                  <PackageX className="size-5" /> Could not deliver
                </Button>
              </div>
            )}

            {mode === 'photos' && (
              <section className="space-y-3 rounded-card border border-line bg-white p-4 shadow-card">
                <p className="font-semibold text-ink">Photos of the delivered package (1 to {MAX_PHOTOS})</p>
                <p className="text-xs text-muted">Show the package at the door or with the customer. The customer will see these photos.</p>
                <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div key={p.url} className="relative">
                      <img src={p.url} alt="" className="size-24 rounded-lg border border-line object-cover" />
                      <button
                        type="button"
                        aria-label={`Remove photo ${i + 1}`}
                        onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                        className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-coral-dark text-white"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button type="button" onClick={() => input.current?.click()} className="grid size-24 place-items-center rounded-lg border-2 border-dashed border-forest/50 text-forest">
                      <Camera className="size-7" />
                    </button>
                  )}
                </div>
                {problem && <p className="text-sm text-coral-dark">{problem}</p>}
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Button variant="ghost" onClick={() => setMode('idle')} disabled={busy}>
                    Back
                  </Button>
                  <Button size="lg" loading={busy} onClick={confirm} disabled={!photos.length}>
                    <CheckCircle2 className="size-5" /> Confirm delivery
                  </Button>
                </div>
              </section>
            )}

            {mode === 'failed' && (
              <section className="space-y-3 rounded-card border border-line bg-white p-4 shadow-card">
                <p className="font-semibold text-ink">What happened?</p>
                <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">Pick a reason</option>
                  {order.reasons.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
                <Textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={reason === 'Other' ? 'Please describe it' : 'Anything else (optional)'} />
                <p className="text-xs text-muted">
                  This is attempt {order.attempts.length + 1} of {order.max_attempts}.{attemptsLeft <= 1 ? ' After this the package goes back to the store.' : ' The store will arrange another try.'}
                </p>
                {problem && <p className="text-sm text-coral-dark">{problem}</p>}
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Button variant="ghost" onClick={() => setMode('idle')} disabled={busy}>
                    Back
                  </Button>
                  <Button size="lg" variant="danger" loading={busy} onClick={fail}>
                    Log failed attempt
                  </Button>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

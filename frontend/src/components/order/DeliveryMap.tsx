import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, CheckCircle2, Copy, LocateFixed, Store, Truck } from 'lucide-react';
import { STORE_LOCATION } from '@/lib/constants';
import { geocode, roadRoute, splitRoute, type LatLng } from '@/lib/tracking';

const FOREST = '#1f4d40';
const ROUTE_GRAY = '#9aa3ad';
// extra room on top for the address label and at the bottom for the store label
const FIT = { paddingTopLeft: [50, 90], paddingBottomRight: [50, 70] } as L.FitBoundsOptions;
const PIN_TEAL = '#1fb5a8';

// white rounded label shown above a point, like "Manila" on the TikTok Shop map
const bubble = (inner: string) =>
  `<div style="background:#fff;color:#111;border-radius:10px;padding:6px 10px;font:600 13px/1.2 system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.18);display:flex;align-items:center;gap:6px">${inner}</div>`;

// the marker element is 0x0 at the point, so the content is moved with transform to sit above or on the point
function htmlIcon(html: string, transform: string) {
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div style="position:absolute;left:0;top:0;transform:${transform};display:flex;flex-direction:column;align-items:center;gap:6px">${html}</div>`,
  });
}

// store: small gray dot with the label under it (the rider starts near the store, so a label above would be covered)
const storeIcon = (label: string) =>
  htmlIcon(
    `<div style="width:14px;height:14px;border-radius:9999px;background:${ROUTE_GRAY};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>` +
      bubble(`${renderToStaticMarkup(<Store size={15} color={FOREST} />)}${label}`),
    'translate(-50%, -7px)',
  );

// delivery address: label + pin, the tip of the pin sits on the point. Turns green with a check once delivered.
const homeIcon = (label: string, delivered: boolean) =>
  htmlIcon(
    bubble(delivered ? `${renderToStaticMarkup(<CheckCircle2 size={15} color={FOREST} />)}Delivered · ${label}` : label) +
      `<svg width="30" height="40" viewBox="0 0 30 40" style="margin-top:-2px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))"><path d="M15 39S2 25.9 2 16a13 13 0 0 1 26 0c0 9.9-13 23-13 23z" fill="${delivered ? FOREST : PIN_TEAL}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>`,
    'translate(-50%, -100%)',
  );

const riderIcon = () =>
  htmlIcon(
    `<div style="width:38px;height:38px;border-radius:9999px;background:${FOREST};color:#fff;border:3px solid #fff;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.3)">${renderToStaticMarkup(<Truck size={18} />)}</div>`,
    'translate(-50%, -50%)',
  );

// short place name for the pin label: the last part of the address that isn't a zip code, region or country
function placeName(address: string) {
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^\d+$/.test(p) && !/^(metro manila|ncr|philippines)$/i.test(p));
  return (parts[parts.length - 1] ?? 'Delivery address').replace(/\s*\d{4}$/, '');
}

type Props = {
  address: string;
  point?: LatLng | null; // the pin the customer dropped at checkout; without it the address is geocoded
  progress: number;
  pickup: boolean;
  courier?: string | null;
  vehicle?: string | null; // the Lalamove vehicle booked for the order
  orderNum?: string;
};

// Map from the store to the delivery address with the road route and where the rider is, with the courier card under it.
// pickup orders only show the store.
export default function DeliveryMap({ address, point, progress, pickup, courier, vehicle, orderNum }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found'>('loading');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    const map = L.map(box.current, { scrollWheelZoom: false, zoomControl: false, attributionControl: true });
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    L.marker(STORE_LOCATION, { icon: storeIcon('Comfy&amp;Co') }).addTo(map);
    map.setView(STORE_LOCATION, 15);
    boundsRef.current = null;

    let cancelled = false;
    if (pickup) {
      setStatus('ready');
    } else {
      (async () => {
        const home = point ?? (await geocode(address).catch(() => null));
        if (cancelled) return;
        if (!home) {
          setStatus('not-found');
          return;
        }
        const route: LatLng[] = await roadRoute(STORE_LOCATION, home);
        if (cancelled) return;

        // gray road line with a white edge, the part already driven is a bit darker
        const { done, here } = splitRoute(route, progress);
        L.polyline(route, { color: '#fff', weight: 9, opacity: 0.9 }).addTo(map);
        L.polyline(route, { color: ROUTE_GRAY, weight: 6 }).addTo(map);
        if (progress > 0) L.polyline(done, { color: FOREST, weight: 6 }).addTo(map);
        L.marker(home, { icon: homeIcon(placeName(address), progress >= 1), zIndexOffset: 500 }).addTo(map);
        if (progress > 0 && progress < 1) {
          L.marker(here, { icon: riderIcon(), zIndexOffset: 1000 }).addTo(map).bindTooltip('Your order is here');
        }
        boundsRef.current = L.latLngBounds(route);
        map.fitBounds(boundsRef.current, FIT);
        setStatus('ready');
      })();
    }

    return () => {
      cancelled = true;
      mapRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, point?.[0], point?.[1], progress, pickup]);

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (boundsRef.current) map.fitBounds(boundsRef.current, { padding: [60, 60] });
    else map.setView(STORE_LOCATION, 15);
  };

  const copyOrderNum = async () => {
    if (!orderNum) return;
    try {
      await navigator.clipboard.writeText(orderNum);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked, nothing to do
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="relative isolate">
        <div ref={box} className="h-80 w-full sm:h-96" />
        {status === 'ready' && (
          <button
            type="button"
            onClick={recenter}
            title="Re-center map"
            aria-label="Re-center map"
            className="absolute bottom-4 right-4 z-[500] grid size-11 place-items-center rounded-full bg-white text-ink shadow-card transition-colors hover:bg-cream"
          >
            <LocateFixed className="size-5" />
          </button>
        )}
        {status === 'loading' && (
          <div className="skeleton absolute inset-0 z-[500]" role="status">
            <span className="sr-only">Loading map...</span>
          </div>
        )}
        {status === 'not-found' && (
          <p className="absolute inset-x-3 bottom-3 z-[500] rounded-lg bg-white/95 px-3 py-2 text-xs text-muted shadow-card">
            We couldn't find your address on the map, so only the store is shown.
          </p>
        )}
      </div>

      {!pickup && (
        <div className="space-y-2 border-t border-line px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-cream text-forest">
              <Truck className="size-4" />
            </span>
            <p className="min-w-0 flex-1 truncate font-semibold text-ink">
              {courier ?? 'Courier'} {vehicle ? `· ${vehicle}` : 'Standard shipping'}
            </p>
            <Link to="/contact" className="shrink-0 text-sm font-semibold text-forest-light hover:underline">
              Contact
            </Link>
          </div>
          {orderNum && (
            <p className="flex items-center gap-2 text-sm text-ink">
              {orderNum}
              <button
                type="button"
                onClick={copyOrderNum}
                title={copied ? 'Copied' : 'Copy order number'}
                aria-label="Copy order number"
                className="text-muted transition-colors hover:text-forest"
              >
                {copied ? <Check className="size-4 text-forest" /> : <Copy className="size-4" />}
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Home, Store, Truck } from 'lucide-react';
import { STORE_LOCATION } from '@/lib/constants';
import { geocode, roadRoute, splitRoute, type LatLng } from '@/lib/tracking';

const FOREST = '#1f4d40';

function pin(icon: React.ReactNode, bg: string, size = 36) {
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;background:${bg};color:#fff;border:3px solid #fff;border-radius:9999px;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.3)">${renderToStaticMarkup(icon)}</div>`,
  });
}

// Map from the store to the delivery address with the road route and where the rider is.
// pickup orders only show the store.
export default function DeliveryMap({ address, progress, pickup }: { address: string; progress: number; pickup: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found'>('loading');

  useEffect(() => {
    if (!box.current) return;
    const map = L.map(box.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    L.marker(STORE_LOCATION, { icon: pin(<Store size={16} />, FOREST) })
      .addTo(map)
      .bindTooltip('Comfy&Co store');
    map.setView(STORE_LOCATION, 15);

    let cancelled = false;
    if (pickup) {
      setStatus('ready');
    } else {
      (async () => {
        const home = await geocode(address).catch(() => null);
        if (cancelled) return;
        if (!home) {
          setStatus('not-found');
          return;
        }
        const route: LatLng[] = await roadRoute(STORE_LOCATION, home);
        if (cancelled) return;

        const { done, rest, here } = splitRoute(route, progress);
        L.polyline(rest, { color: FOREST, weight: 5, opacity: 0.35, dashArray: '8 8' }).addTo(map);
        L.polyline(done, { color: FOREST, weight: 5 }).addTo(map);
        L.marker(home, { icon: pin(<Home size={16} />, '#c4502f') })
          .addTo(map)
          .bindTooltip('Delivery address');
        if (progress > 0 && progress < 1) {
          L.marker(here, { icon: pin(<Truck size={18} />, '#f2b84b', 42), zIndexOffset: 1000 })
            .addTo(map)
            .bindTooltip('Your order is here');
        }
        map.fitBounds(L.latLngBounds(route), { padding: [40, 40] });
        setStatus('ready');
      })();
    }

    return () => {
      cancelled = true;
      map.remove();
    };
  }, [address, progress, pickup]);

  return (
    <div className="relative isolate overflow-hidden rounded-xl border border-line">
      <div ref={box} className="h-72 w-full sm:h-80" />
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
  );
}

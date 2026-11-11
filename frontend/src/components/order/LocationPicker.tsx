import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { STORE_LOCATION } from '@/lib/constants';
import { geocode, type LatLng } from '@/lib/tracking';

const PIN_TEAL = '#1fb5a8';

// the same pin as the tracking map, its tip sits on the point
const pinIcon = L.divIcon({
  className: '',
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  html: `<svg width="30" height="40" viewBox="0 0 30 40" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))"><path d="M15 39S2 25.9 2 16a13 13 0 0 1 26 0c0 9.9-13 23-13 23z" fill="${PIN_TEAL}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>`,
});

type Props = {
  value: LatLng | null; // the saved pin
  address: string; // the typed address, located on the map when there's no pin yet
  onChange: (point: LatLng | null) => void;
  onLocate?: (point: LatLng) => void; // "Use my current location" found the phone: the page can fill in the address from it
  disabled?: boolean;
};

// Map where the customer drops a pin on their house, so the Lalamove rider goes to the right door.
// Without a pin the typed address is located on the map (often only as far as the street or barangay).
export default function LocationPicker({ value, address, onChange, onLocate, disabled }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const place = (point: LatLng) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) markerRef.current.setLatLng(point);
    else {
      markerRef.current = L.marker(point, { icon: pinIcon, draggable: !disabled }).addTo(map);
      markerRef.current.on('dragend', () => {
        const { lat, lng } = markerRef.current!.getLatLng();
        setHint(null);
        latest.current([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
      });
    }
  };

  // the map is made once; the pin and the view follow the props below
  useEffect(() => {
    if (!box.current) return;
    const map = L.map(box.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    map.setView(STORE_LOCATION, 12);
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (disabled) return;
      setHint(null);
      latest.current([Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]);
    });
    return () => {
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the pin follows the value: shown and centred, or removed
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (value) {
      place(value);
      map.setView(value, Math.max(map.getZoom(), 16));
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.[0], value?.[1]]);

  // The pin follows the typed address: when it changes (or there's no pin yet), the address is looked up and the pin
  // put there, so the customer only has to drag it to the exact house. A saved pin stays put until the address is edited.
  // Only an exact match places the pin; if just the city or street is found, the map looks there and the pin is left off,
  // so a rider is never sent to the middle of the city.
  const lastAddress = useRef<string | null>(value ? address : null);
  useEffect(() => {
    const clean = address.replace(/\s+/g, ' ').trim();
    if (clean === lastAddress.current) return;
    lastAddress.current = clean;
    if (clean.length < 8) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const exact = await geocode(clean, { exact: true });
        if (cancelled) return;
        if (exact) {
          latest.current(exact);
          setHint('Pin placed from your address. Drag it to your exact house, or use your current location.');
          return;
        }
        latest.current(null);
        const area = await geocode(clean);
        if (cancelled || !area || !mapRef.current) return;
        mapRef.current.setView(area, 15);
        setHint('We found the area but not the exact address. Tap your house on the map to drop a pin, or use your current location.');
      } catch {
        if (!cancelled) setHint('We could not find this address on the map. You can still drop a pin.');
      }
    }, 700); // waits for the typing to pause (OpenStreetMap allows about one lookup a second)
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setHint('Your browser cannot share your location.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const point: LatLng = [Number(pos.coords.latitude.toFixed(6)), Number(pos.coords.longitude.toFixed(6))];
        setHint(null);
        onChange(point);
        onLocate?.(point);
      },
      () => {
        setLocating(false);
        setHint('Location access was blocked. Tap your house on the map instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">
          Pin your location <span className="font-normal text-muted">(optional, helps the rider find you)</span>
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={useMyLocation} loading={locating} disabled={disabled}>
            <LocateFixed className="size-4" /> Use my current location
          </Button>
          {value && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setHint(null);
                onChange(null);
              }}
              disabled={disabled}
            >
              <X className="size-4" /> Remove pin
            </Button>
          )}
        </div>
      </div>
      {/* isolate: Leaflet's own z-indexes stay inside the map, under the sticky header (same as DeliveryMap) */}
      <div className="relative isolate overflow-hidden rounded-xl border border-line">
        <div ref={box} className="h-64 w-full sm:h-72" />
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <MapPin className="mt-0.5 size-3.5 shrink-0 text-forest" />
        {hint ?? (value ? `Pinned at ${value[0].toFixed(5)}, ${value[1].toFixed(5)}. Drag the pin to adjust it.` : 'Type your address above and the pin goes there, or tap your house on the map.')}
      </p>
    </div>
  );
}

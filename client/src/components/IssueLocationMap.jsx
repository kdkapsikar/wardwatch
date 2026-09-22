import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useT } from '../i18n/LanguageContext.jsx';

const pin = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
const ZOOM = 17;

/** Read-only map showing where an issue was reported (staff record views). */
export default function IssueLocationMap({ latitude, longitude }) {
  const { t } = useT();
  const containerRef = useRef(null);

  useEffect(() => {
    const position = [latitude, longitude];
    const map = L.map(containerRef.current, { center: position, zoom: ZOOM, scrollWheelZoom: false });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    L.marker(position, { icon: pin, alt: t('map.markerAlt'), keyboard: false }).addTo(map);
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
    };
    // The marker alt text is set once; the map itself only depends on the coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  return (
    <div className="relative z-0 mt-3 h-56 w-full overflow-hidden rounded-lg border border-slate-300 sm:h-72">
      <div ref={containerRef} role="group" aria-label={t('map.viewAria')} className="h-full w-full" />
    </div>
  );
}

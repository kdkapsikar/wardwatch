import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { translate } from '../i18n/index.js';
import { useT } from '../i18n/LanguageContext.jsx';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../lib/constants.js';

// Leaflet's default icon URLs break under bundlers, so point it at the imported assets.
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
const GPS_ZOOM = 17;

// Browser geolocation error codes -> dictionary keys (map.geo.<kind>)
const GEO_KIND = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };

const round6 = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Map-based location picker (OpenStreetMap tiles via Leaflet).
 * Controlled by `latitude` / `longitude` (numbers or null). The marker can be set by
 * GPS ("Use My Current Location"), by tapping the map, or by dragging the marker.
 */
export default function LocationPicker({ latitude, longitude, onChange, error, disabled }) {
  const { t } = useT();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  // Map event handlers are registered once, so they read the latest props through refs.
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onChangeRef.current = onChange;
    disabledRef.current = disabled;
  });

  const [source, setSource] = useState(null); // { type: 'gps', accuracy } | { type: 'map' } | null
  // `kind` (not the text) is stored, so an error already on screen re-translates when the language changes.
  const [geo, setGeo] = useState({ locating: false, kind: '' });

  const hasLocation = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;

  // Create the map once.
  useEffect(() => {
    const map = L.map(containerRef.current, {
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      scrollWheelZoom: false, // don't hijack page scrolling; enabled while the map has focus
    });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);

    map.on('click', (e) => {
      if (disabledRef.current) return;
      setSource({ type: 'map' });
      onChangeRef.current({ latitude: round6(e.latlng.lat), longitude: round6(e.latlng.lng) });
    });
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());

    // Keep tiles correct when the layout changes (rotation, window resize, lazy layout).
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);

    mapRef.current = map;
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Keep the marker in sync with the form state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!hasLocation) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const position = [latitude, longitude];
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    } else {
      const marker = L.marker(position, { icon: pin, draggable: true, alt: translate('map.markerAlt') }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        setSource({ type: 'map' });
        onChangeRef.current({ latitude: round6(p.lat), longitude: round6(p.lng) });
      });
      markerRef.current = marker;
    }
    if (!map.getBounds().contains(position)) map.setView(position, map.getZoom());
  }, [hasLocation, latitude, longitude]);

  function handleUseLocation() {
    if (!('geolocation' in navigator)) {
      setGeo({ locating: false, kind: 'unsupported' });
      return;
    }
    if (!window.isSecureContext) {
      setGeo({ locating: false, kind: 'insecure' });
      return;
    }
    setGeo({ locating: true, kind: '' });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGeo({ locating: false, kind: '' });
        setSource({ type: 'gps', accuracy: Math.round(coords.accuracy) });
        onChangeRef.current({ latitude: round6(coords.latitude), longitude: round6(coords.longitude) });
        mapRef.current?.setView([coords.latitude, coords.longitude], GPS_ZOOM);
      },
      (err) => setGeo({ locating: false, kind: GEO_KIND[err.code] ?? 'unavailable' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  function clear() {
    setSource(null);
    onChangeRef.current({ latitude: null, longitude: null });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleUseLocation}
        disabled={disabled || geo.locating}
        className="btn btn-secondary w-full sm:w-auto"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
        </svg>
        {geo.locating ? t('map.locating') : t('map.useLocation')}
      </button>
      {geo.kind && <p role="alert" className="mt-2 text-xs text-red-600">{t(`map.geo.${geo.kind}`)}</p>}

      {/* Outer div is React-styled (error border). The inner div is handed to Leaflet, which adds its
          own classes to it, so its className must never change or React would wipe them. */}
      <div
        className={`relative z-0 mt-3 h-64 w-full overflow-hidden rounded-lg border sm:h-80 ${
          error ? 'border-red-500 ring-2 ring-red-500/25' : 'border-slate-300'
        }`}
      >
        <div
          ref={containerRef}
          role="group"
          aria-label={t('map.aria')}
          className="h-full w-full"
        />
      </div>

      <div aria-live="polite" className="mt-2 text-sm">
        {hasLocation ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <dl className="flex flex-wrap gap-x-5 gap-y-1">
              <div className="flex gap-1.5"><dt className="text-slate-500">{t('map.latitude')}</dt><dd className="font-mono font-medium">{latitude.toFixed(6)}</dd></div>
              <div className="flex gap-1.5"><dt className="text-slate-500">{t('map.longitude')}</dt><dd className="font-mono font-medium">{longitude.toFixed(6)}</dd></div>
            </dl>
            <button type="button" onClick={clear} disabled={disabled} className="text-xs font-medium text-slate-500 underline hover:text-slate-800">
              {t('map.clear')}
            </button>
          </div>
        ) : (
          <p className="text-slate-500">{t('map.none')}</p>
        )}
        {hasLocation && source?.type === 'gps' && (
          <p className="mt-0.5 text-xs text-slate-500">{t('map.fromGps', { m: source.accuracy })}</p>
        )}
        {hasLocation && source?.type === 'map' && <p className="mt-0.5 text-xs text-slate-500">{t('map.placed')}</p>}
      </div>

      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      {!error && !hasLocation && (
        <p className="mt-1 text-xs text-slate-500">{t('map.hint')}</p>
      )}
    </div>
  );
}

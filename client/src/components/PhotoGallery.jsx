import { assetUrl } from '../lib/config.js';

/** Thumbnails that open the full-size image in a new tab. */
export default function PhotoGallery({ photos, size = 'h-24 w-24' }) {
  if (!photos?.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {photos.map((src, i) => (
        <li key={src}>
          <a href={assetUrl(src)} target="_blank" rel="noreferrer" className="block">
            <img
              src={assetUrl(src)}
              alt={`Photo ${i + 1} of ${photos.length}`}
              loading="lazy"
              className={`${size} rounded-lg border border-slate-200 object-cover transition hover:opacity-90`}
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

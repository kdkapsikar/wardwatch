import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/LanguageContext.jsx';
import { ACCEPTED_IMAGE_TYPES, MAX_PHOTOS, MAX_PHOTO_BYTES } from '../lib/constants.js';

/** Controlled multi-photo picker with thumbnails. `files` is a File[]; the server re-validates everything. */
export default function PhotoUploader({ files, onChange, error, disabled }) {
  const { t } = useT();
  const inputRef = useRef(null);
  const [localError, setLocalError] = useState('');

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function handlePick(event) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = ''; // allow re-picking the same file after removing it
    const accepted = [];
    let problem = '';
    for (const file of picked) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) problem = t('photo.notImage', { name: file.name });
      else if (file.size > MAX_PHOTO_BYTES) problem = t('photo.tooBig', { name: file.name, mb: MAX_PHOTO_BYTES / 1024 / 1024 });
      else if (files.length + accepted.length >= MAX_PHOTOS) problem = t('photo.tooMany', { max: MAX_PHOTOS });
      else accepted.push(file);
    }
    setLocalError(problem);
    if (accepted.length) onChange([...files, ...accepted]);
  }

  const shownError = localError || error;
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {files.map((file, i) => (
          <div key={`${file.name}-${i}`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
            <img src={previews[i]} alt={t('photo.selected', { n: i + 1 })} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, idx) => idx !== i))}
              disabled={disabled}
              aria-label={t('photo.remove', { n: i + 1 })}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/70 text-xs leading-none text-white hover:bg-slate-900"
            >
              &times;
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-600 hover:text-brand-600"
          >
            <span className="text-xl leading-none">+</span>
            {t('photo.add')}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple
        onChange={handlePick}
        className="hidden"
        aria-label={t('photo.addLabel')}
      />
      <p className="mt-2 text-xs text-slate-500">
        {t('photo.hint', { max: MAX_PHOTOS, mb: MAX_PHOTO_BYTES / 1024 / 1024 })}
      </p>
      {shownError && <p className="mt-1 text-xs text-red-600">{shownError}</p>}
    </div>
  );
}

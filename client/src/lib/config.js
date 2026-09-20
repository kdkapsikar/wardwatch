// Where the API lives. Empty (the default) = same origin as the web app, which is how `npm run dev`
// (Vite proxy) and the single-server production setup work. Set VITE_API_URL at build time when the
// web app is hosted separately from the API, e.g. VITE_API_URL=https://wardwatch-api.onrender.com
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

/** Uploaded photos are served by the API as "/uploads/<name>"; make them absolute when it is on another origin. */
export const assetUrl = (path) => (path.startsWith('/') ? `${API_URL}${path}` : path);

/** Router basename: "" normally, "/wardwatch" when served from a GitHub Pages project site. */
export const BASENAME = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** URL of a file in client/public, respecting the deploy base path. */
export const publicUrl = (file) => `${import.meta.env.BASE_URL}${file}`;

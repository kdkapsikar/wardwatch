import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev: the API runs on :3001; proxying keeps everything same-origin, so no CORS setup is needed.
const devApi = process.env.API_URL || 'http://localhost:3001';

/**
 * When the app is hosted apart from the API (GitHub Pages), the server cannot send security headers
 * for the page, so ship an equivalent Content-Security-Policy as a <meta> tag at build time.
 * (Same-origin builds get the real header from the Express server instead.)
 */
function contentSecurityPolicy(apiUrl) {
  return {
    name: 'wardwatch-csp-meta',
    transformIndexHtml() {
      if (!apiUrl) return [];
      const api = new URL(apiUrl).origin;
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'", // Leaflet positions tiles/markers with inline styles
        `img-src 'self' data: blob: ${api} https://tile.openstreetmap.org`,
        `connect-src 'self' ${api}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ');
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig(() => ({
  // GitHub Pages project sites live under /<repo>/. Set VITE_BASE=/wardwatch/ at build time.
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy(process.env.VITE_API_URL)],
  server: {
    port: 5173,
    proxy: { '/api': devApi, '/uploads': devApi },
  },
}));

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In dev the API runs on :3001; proxying keeps everything same-origin, so the
// session cookie works exactly as in production and no CORS setup is needed.
const api = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': api, '/uploads': api },
  },
});

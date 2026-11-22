import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev: `npm run dev` proxies /api to the analytics server (PORT 8095 by default).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT ?? 8095}` } },
});

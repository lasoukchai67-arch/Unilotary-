import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The app is served as static files under /admin/ (see README.md).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:3000';
  const proxy = { '/v1': { target: proxyTarget, changeOrigin: true } };

  return {
    base: '/admin/',
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: { target: 'es2020', sourcemap: false },
  };
});

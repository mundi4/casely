
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { apiHandlers } from './apiHandlers.js';

export default defineConfig({
  server: {
    port: 8000,
  },
  plugins: [
    react(),
    {
      name: 'mock-api-middleware',
      configureServer(server: any) {
        server.middlewares.use(apiHandlers());
      },
    },
  ],
});

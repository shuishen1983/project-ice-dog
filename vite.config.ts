import { defineConfig } from 'vite';

export default defineConfig({
  base: '/project-ice-dog/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  test: {
    environment: 'node',
  },
});

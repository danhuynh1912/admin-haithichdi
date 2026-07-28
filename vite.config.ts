import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: { port: 3001 },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    // @refinedev/react-router ships its own copy of react-router. Without this
    // it lands in a separate pre-bundled chunk with its own Router context, so
    // its useLocation() cannot see the BrowserRouter from react-router-dom and
    // the whole app renders nothing.
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
});

// Imported here, not from index.css: Tailwind inlines a CSS @import without
// letting Vite rewrite its relative url()s, so the woff2 files never ship.
import '@fontsource-variable/inter';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

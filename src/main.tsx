import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

// Routing is hash-based (see src/router.tsx) so that a deep link to a tab works
// on any static host without server rewrite rules.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

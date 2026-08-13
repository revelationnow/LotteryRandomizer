import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';

// HashRouter rather than BrowserRouter: GitHub Pages serves static files with no
// SPA fallback, so a deep link to /observatory would 404 under history routing.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './index.css';

// The dial press arrives as Enter/Space; without this it also clicks whichever button was last tapped.
window.addEventListener(
  'keydown',
  e => {
    if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
  },
  { capture: true },
);

// Nothing here is reached by Tab, so a tapped button keeping focus only shows a stray ring on the next key.
window.addEventListener('click', () => {
  if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

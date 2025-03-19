import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faPlay, faStop, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { registerSW } from 'virtual:pwa-register';

// Register service worker with improved configuration for Android compatibility
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (confirm('New content available. Reload application?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
  onRegistered(registration: ServiceWorkerRegistration | undefined) {
    console.log('Service worker registered:', registration);
    
    // Force update check periodically (helps with Android refresh issues)
    setInterval(() => {
      if (registration) {
        registration.update().catch(console.error);
      }
    }, 60 * 60 * 1000); // Check every hour
  },
  onRegisterError(error: any) {
    console.error('Service worker registration failed:', error);
  }
});

// Handle Android back button correctly in standalone mode
if (window.matchMedia('(display-mode: standalone)').matches) {
  window.addEventListener('load', () => {
    window.addEventListener('popstate', () => {
      if (window.history.state === null && window.location.pathname === '/') {
        // We're at the root with no history state, likely a back button from the root
        if (navigator.userAgent.includes('Android')) {
          // On Android, this should exit the app instead of navigating back
          window.close();
        }
      }
    });
  });
}

// Add icons to the library
library.add(faPlay, faStop, faSpinner);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 
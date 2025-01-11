import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/tailwind.css';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faPlay, faStop, faSpinner } from '@fortawesome/free-solid-svg-icons';

// Configure future flags for React Router
const router = {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
};

// Add icons to the library
library.add(faPlay, faStop, faSpinner);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter {...router}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
); 
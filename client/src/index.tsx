import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faPlay, faStop, faSpinner } from '@fortawesome/free-solid-svg-icons';

// Add icons to the library
library.add(faPlay, faStop, faSpinner);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 
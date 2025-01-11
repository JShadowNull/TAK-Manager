import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/shared/ui/layout/Layout';
import Dashboard from './pages/Dashboard';
import Takserver from './pages/Takserver';
import DataPackage from './pages/DataPackage';
import Transfer from './pages/Transfer';
import CertManager from './pages/CertManager';
import { ThemeProvider } from './components/shared/ui/shadcn/theme-provider';

const App: React.FC = () => {
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Clear any existing timeout
        if (reconnectTimeout) clearTimeout(reconnectTimeout);

        // You can perform other actions here if needed, but avoid reloading the page
        // reconnectTimeout = setTimeout(() => {
        //   window.location.reload();
        // }, 2000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="takserver" element={<Takserver />} />
          <Route path="data-package" element={<DataPackage />} />
          <Route path="transfer" element={<Transfer />} />
          <Route path="cert-manager" element={<CertManager />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}

export default App; 
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/shared/ui/Layout';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Takserver from './pages/Takserver';
import DataPackage from './pages/DataPackage';
import Transfer from './pages/Transfer';
import CertManager from './pages/CertManager';
import { ThemeProvider } from './components/shared/ui/shadcn/theme-provider';
function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="services" element={<Services />} />
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
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Takserver from './pages/Takserver';
import Installers from './pages/Installers';
import DataPackage from './pages/DataPackage';
import Transfer from './pages/Transfer';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="services" element={<Services />} />
        <Route path="takserver" element={<Takserver />} />
        <Route path="installers" element={<Installers />} />
        <Route path="data-package" element={<DataPackage />} />
        <Route path="transfer" element={<Transfer />} />
      </Route>
    </Routes>
  );
}

export default App; 
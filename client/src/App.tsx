import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "@/components/shared/ui/shadcn/theme-provider"
import { TakServerProvider } from "@/components/shared/ui/shadcn/sidebar/app-sidebar"
import Layout from './components/shared/ui/layout/Layout'
import Dashboard from './pages/Dashboard'
import Takserver from './pages/Takserver'
import DataPackage from './pages/DataPackage'
import CertManager from './pages/CertManager'

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <TakServerProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="takserver" element={<Takserver />} />
              <Route path="data-package" element={<DataPackage />} />
              <Route path="cert-manager" element={<CertManager />} />
            </Route>
          </Routes>
        </TakServerProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App 
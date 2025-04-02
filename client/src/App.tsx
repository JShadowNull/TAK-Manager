import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "@/components/shared/ui/shadcn/theme-provider"
import { TakServerProvider } from "@/components/shared/ui/shadcn/sidebar/app-sidebar"
import { AuthProvider } from "@/utils/AuthContext"
import Layout from './components/shared/ui/layout/Layout'
import Dashboard from './pages/Dashboard'
import Takserver from './pages/Takserver'
import DataPackage from './pages/DataPackage'
import CertManager from './pages/CertManager'
import AdvancedFeatures from './pages/AdvancedFeatures'
import Profile from './pages/Profile'
import Login from './pages/Login'
import PrivateRoute from './components/shared/PrivateRoute'

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <TakServerProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              
              {/* Protected routes */}
              <Route element={<PrivateRoute />}>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="takserver" element={<Takserver />} />
                  <Route path="data-package" element={<DataPackage />} />
                  <Route path="cert-manager" element={<CertManager />} />
                  <Route path="advanced-features" element={<AdvancedFeatures />} />
                  <Route path="profile" element={<Profile />} />
                </Route>
              </Route>
            </Routes>
          </TakServerProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App 
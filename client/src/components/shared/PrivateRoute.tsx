import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/utils/AuthContext';
import { useEffect } from 'react';
import { BackgroundWrapper } from './ui/background/background-wrapper'; // Importing BackgroundWrapper
import { Loader2 } from 'lucide-react'; // Importing Loader2

const PrivateRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  
  useEffect(() => {
    console.log('PrivateRoute state:', { isAuthenticated, loading });
  }, [isAuthenticated, loading]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <BackgroundWrapper>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative top-[260px] text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Checking authentication...</p>
          </div>
        </div>
      </BackgroundWrapper>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  
  return <Outlet />;
};

export default PrivateRoute; 
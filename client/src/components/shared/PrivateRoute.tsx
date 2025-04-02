import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/utils/AuthContext';
import { useEffect } from 'react';

const PrivateRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  
  useEffect(() => {
    console.log('PrivateRoute state:', { isAuthenticated, loading });
  }, [isAuthenticated, loading]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
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
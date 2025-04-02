import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  exp: number;
  sub: string;
  type: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  loading: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<string>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Calculate time remaining on token (in seconds)
const getTokenTimeRemaining = (token: string): number => {
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(decoded.exp - currentTime, 0);
  } catch (error) {
    return 0;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const refreshTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();

  // Function to refresh the access token
  const refreshAccessToken = async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
      const { access_token, refresh_token } = response.data;
      
      // Update tokens in storage
      localStorage.setItem('token', access_token);
      localStorage.setItem('refreshToken', refresh_token);
      
      // Update axios headers
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Schedule next refresh
      scheduleTokenRefresh(access_token);
      
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      
      // Clear tokens and log out on refresh failure
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setIsAuthenticated(false);
      setUsername(null);
      
      return false;
    }
  };

  // Schedule token refresh
  const scheduleTokenRefresh = (token: string) => {
    // Clear any existing timeout
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
    }
    
    // Get token expiration time (in seconds)
    const timeRemaining = getTokenTimeRemaining(token);
    
    // If token has expired, refresh immediately
    if (timeRemaining <= 0) {
      refreshAccessToken();
      return;
    }
    
    // Schedule refresh at 90% of the token lifetime
    const refreshTime = timeRemaining * 0.9 * 1000; // convert to milliseconds
    
    console.log(`Token refresh scheduled in ${Math.round(refreshTime / 1000)} seconds`);
    
    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshAccessToken();
    }, refreshTime);
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      
      console.log('Initializing auth, token exists:', !!token, 'refresh token exists:', !!refreshToken);
      
      if (token) {
        // Check if token is expired
        const timeRemaining = getTokenTimeRemaining(token);
        
        if (timeRemaining <= 0) {
          // Token expired, try to refresh
          console.log('Token expired, attempting to refresh');
          const refreshed = await refreshAccessToken();
          
          if (!refreshed) {
            setLoading(false);
            return;
          }
        } else {
          // Token still valid
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          scheduleTokenRefresh(token);
          
          try {
            // Verify token is valid by getting user info
            const response = await axios.get('/api/auth/me');
            setUsername(response.data.username);
            setIsAuthenticated(true);
            console.log('Authentication successful:', response.data.username);
          } catch (error) {
            console.error('Auth token validation error', error);
            
            // Try to refresh the token if validation fails
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
              localStorage.removeItem('token');
              localStorage.removeItem('refreshToken');
            }
          }
        }
      } else if (refreshToken) {
        // Have refresh token but no access token
        console.log('No access token but refresh token exists, attempting to refresh');
        await refreshAccessToken();
      }
      
      setLoading(false);
      console.log('Auth initialization complete, isAuthenticated:', isAuthenticated);
    };

    initAuth();
    
    // Cleanup function
    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const login = async (accessToken: string, refreshToken: string) => {
    console.log('Login called with tokens:', accessToken ? 'token-exists' : 'no-token', 
                 refreshToken ? 'refresh-token-exists' : 'no-refresh-token');
    
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    
    // Schedule token refresh
    scheduleTokenRefresh(accessToken);
    
    try {
      // Get user info immediately after login
      const response = await axios.get('/api/auth/me');
      const username = response.data.username;
      
      // Update state (use function form to ensure we're using latest state)
      setUsername(username);
      setIsAuthenticated(true);
      console.log('Login successful, user:', username);
      
      // Return username for use in login component if needed
      return username;
    } catch (error) {
      console.error('Error fetching user info after login', error);
      // Still set authenticated even if we can't get the username
      setIsAuthenticated(true);
      return '';
    }
  };

  const logout = async () => {
    console.log('Logout called');
    
    // Clear refresh timeout
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    // Get refresh token to revoke it on server
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (refreshToken) {
      try {
        // Notify server to invalidate refresh token
        await axios.post('/api/auth/logout', { refresh_token: refreshToken });
      } catch (error) {
        console.error('Error logging out on server:', error);
      }
    }
    
    // Clear local storage and state
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUsername(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        username,
        loading,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  HomeIcon,
  AdjustmentsHorizontalIcon,
  MapPinIcon,
  WrenchScrewdriverIcon,
  CircleStackIcon,  
  ArrowsRightLeftIcon,
  ServerIcon,
  KeyIcon
} from '@heroicons/react/24/outline';

function Sidebar() {
  const location = useLocation();
  const [takServerInstalled, setTakServerInstalled] = useState(false);
  
  useEffect(() => {
    // Create socket connection to backend
    const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const takServerSocket = io('/takserver-status', {
      transports: ['websocket'],
      path: '/socket.io'
    });

    // Listen for status updates
    takServerSocket.on('connect', () => {
      console.log('Connected to TAK server status service');
      takServerSocket.emit('check_status');
    });

    takServerSocket.on('takserver_status', (status) => {
      setTakServerInstalled(status.isInstalled);
    });

    // Add error handling
    takServerSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    takServerSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Cleanup
    return () => {
      takServerSocket.off('takserver_status');
      takServerSocket.off('connect_error');
      takServerSocket.off('error');
      takServerSocket.disconnect();
    };
  }, []);

  const navItems = [
    { 
      path: '/', 
      icon: HomeIcon, 
      text: 'Dashboard',
      iconColor: 'text-orange-500',
      alwaysShow: true
    },
    { 
      path: '/services', 
      icon: AdjustmentsHorizontalIcon, 
      text: 'Services',
      iconColor: 'text-purple-500',
      alwaysShow: true
    },
    { 
      path: '/takserver', 
      icon: WrenchScrewdriverIcon, 
      text: 'TAK Server Manager',
      iconColor: 'text-blue-500',
      alwaysShow: true
    },
    { 
      path: '/cert-manager', 
      icon: KeyIcon, 
      text: 'Certificate Manager',
      iconColor: 'text-yellow-500',
      alwaysShow: false,
      showWhen: () => takServerInstalled
    },
    { 
      path: '/data-package', 
      icon: CircleStackIcon, 
      text: 'Data Package Configuration',
      iconColor: 'text-pink-500',
      alwaysShow: false,
      showWhen: () => takServerInstalled
    },
    { 
      path: '/transfer', 
      icon: ArrowsRightLeftIcon, 
      text: 'Rapid Transfer',
      iconColor: 'text-yellow-500',
      alwaysShow: true
    }
  ];

  return (
    <nav className="w-64 bg-cardBg p-6 text-textPrimary border-r border-accentBoarder">
      <ul>
        {navItems.filter(item => item.alwaysShow || item.showWhen()).map(({ path, icon: Icon, text, iconColor }) => {
          const isActive = location.pathname === path;
          return (
            <li key={path} className="mb-2">
              <Link
                to={path}
                onClick={(e) => {
                  if (isActive && path === '/data-package') {
                    e.preventDefault(); // Prevent navigation if already on data-package
                    return;
                  }
                }}
                className={`flex items-center p-2 rounded-lg ${
                  isActive 
                    ? 'bg-selectedColor text-selectedTextColor' 
                    : 'text-textSecondary hover:text-white'
                } text-sm`}
              >
                <Icon 
                  className={`w-5 h-5 mr-2 ${
                    isActive 
                      ? 'fill-current text-selectedTextColor' 
                      : `fill-current ${iconColor}`
                  }`} 
                />
                {text}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default Sidebar; 
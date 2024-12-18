import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
import useSocket from '../hooks/useSocket';

function Sidebar() {
  const location = useLocation();
  const [takServerInstalled, setTakServerInstalled] = useState(false);
  
  const { isConnected } = useSocket('/takserver-status', {
    eventHandlers: {
      takserver_status: (status) => {
        setTakServerInstalled(status.isInstalled);
      },
      onConnect: (socket) => {
        console.log('Connected to TAK server status service');
        socket.emit('check_status');
      }
    }
  });

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
    <nav className="w-64 bg-card p-6 text-foreground border-r border-border">
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
                    : 'text-textSecondary hover:foreground'
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
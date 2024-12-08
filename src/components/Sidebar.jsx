import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon,
  AdjustmentsHorizontalIcon,
  MapPinIcon,
  WrenchScrewdriverIcon,
  CircleStackIcon,  
  ArrowsRightLeftIcon,
  ServerIcon
} from '@heroicons/react/24/outline';

function Sidebar() {
  const location = useLocation();
  
  const navItems = [
    { 
      path: '/', 
      icon: HomeIcon, 
      text: 'Dashboard',
      iconColor: 'text-orange-500'
    },
    { 
      path: '/services', 
      icon: AdjustmentsHorizontalIcon, 
      text: 'Services',
      iconColor: 'text-purple-500'
    },
    { 
      path: '/takserver', 
      icon: WrenchScrewdriverIcon, 
      text: 'TAK Server Manager',
      iconColor: 'text-blue-500'
    },
    { 
      path: '/data-package', 
      icon: CircleStackIcon, 
      text: 'Data Package Configuration',
      iconColor: 'text-pink-500'
    },
    { 
      path: '/transfer', 
      icon: ArrowsRightLeftIcon, 
      text: 'Rapid Transfer',
      iconColor: 'text-yellow-500'
    }
  ];

  return (
    <nav className="w-64 bg-cardBg p-6 text-textPrimary border-r border-accentBoarder">
      <ul>
        {navItems.map(({ path, icon: Icon, text, iconColor }) => {
          const isActive = location.pathname === path;
          return (
            <li key={path} className="mb-2">
              <Link
                to={path}
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
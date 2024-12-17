import React from 'react';
import { useLocation } from 'react-router-dom';

function TitleBar() {
  const location = useLocation();
  
  const getTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard';
      case '/services':
        return 'Services';
      case '/takserver':
        return 'TAK Server Manager';
      case '/installers':
        return 'Installers/Setup';
      case '/data-package':
        return 'Data Package Configuration';
      case '/transfer':
        return 'Rapid Transfer';
      case '/cert-manager':
        return 'Certificate Manager';
      default:
        return 'System Monitor';
    }
  };

  return (
    <div className="bg-card p-4 shadow-lg border-b border-accentBoarder w-full fixed top-0 left-64 right-0 z-50">
      <h1 className="text-lg font-bold text-foreground pl-6">{getTitle()}</h1>
    </div>
  );
}

export default TitleBar; 
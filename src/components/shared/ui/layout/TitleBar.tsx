import React from 'react';
import { useLocation } from 'react-router-dom';

const TitleBar: React.FC = () => {
  const location = useLocation();
  
  const getTitle = (): string => {
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
    <div className="mt-2 rounded-lg bg-sidebar p-4 border border-border flex-none mr-2">
      <h1 className="text-lg font-bold text-foreground">{getTitle()}</h1>
    </div>
  );
};

export default TitleBar; 
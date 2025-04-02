import React from 'react';

export const BackgroundWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative min-h-screen bg-background overflow-hidden">
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className="w-[400px] h-[400px] flex items-center justify-center">
        <img 
          src="/tak.svg" 
          alt="" 
          className="w-full h-full object-contain animate-pulse"
        />
      </div>
    </div>
    <div className="relative z-10 min-h-screen">
      {children}
    </div>
  </div>
); 
import React, { useState, useEffect, useRef } from 'react';

function CustomScrollbar({ children, className = '' }) {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = () => {
      setIsScrolling(true);
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1000);
    };

    container.addEventListener('wheel', handleWheel);
    container.addEventListener('touchmove', handleWheel);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchmove', handleWheel);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`
        ${className}
        scrollbar-custom
        overflow-y-auto
        h-full
        [&::-webkit-scrollbar]:w-2
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-track]:rounded-lg
        [&::-webkit-scrollbar-thumb]:bg-accentBoarder
        [&::-webkit-scrollbar-thumb]:rounded-lg
        [&::-webkit-scrollbar-thumb]:min-h-[40px]
        [&::-webkit-scrollbar-thumb]:border-2
        [&::-webkit-scrollbar-thumb]:border-transparent
        [&::-webkit-scrollbar-thumb]:bg-clip-padding
        [&::-webkit-scrollbar]:transition-opacity
        [&::-webkit-scrollbar]:duration-300
        ${isScrolling ? '[&::-webkit-scrollbar]:opacity-100' : '[&::-webkit-scrollbar]:opacity-0'}
      `}
    >
      {children}
    </div>
  );
}

export default CustomScrollbar; 
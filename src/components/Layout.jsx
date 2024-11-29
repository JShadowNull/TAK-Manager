import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TitleBar from './TitleBar';
import CustomScrollbar from './CustomScrollbar';

function Layout() {
  return (
    <div className="flex h-screen bg-primaryBg">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TitleBar />
        <div className="flex-1 relative">
          <CustomScrollbar className="absolute inset-0 p-10 text-lg">
            <Outlet />
          </CustomScrollbar>
        </div>
      </div>
    </div>
  );
}

export default Layout; 
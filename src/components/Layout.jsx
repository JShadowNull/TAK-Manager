import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TitleBar from './TitleBar';
import CustomScrollbar from './CustomScrollbar';

function Layout() {
  return (
    <div className="flex h-screen bg-primaryBg">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full">
        <TitleBar />
        <main className="flex-1 overflow-hidden">
          <div className="h-full relative">
            <CustomScrollbar>
              <div className="p-8">
                <Outlet />
              </div>
            </CustomScrollbar>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout; 
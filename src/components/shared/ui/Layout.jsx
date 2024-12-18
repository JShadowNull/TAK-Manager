import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './shadcn/sidebar/app-sidebar';
import { SidebarProvider } from './shadcn/sidebar';
import TitleBar from './TitleBar';
import CustomScrollbar from './CustomScrollbar';

function Layout() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex-none">
        <SidebarProvider defaultOpen={true}>
          <AppSidebar />
        </SidebarProvider>
      </div>

      <div className="flex-1 flex flex-col">
        <TitleBar />
        <main className="flex-1 overflow-hidden">
          <CustomScrollbar>
            <div className="pl-4 pr-6 pt-6 pb-2">
              <Outlet />
            </div>
          </CustomScrollbar>
        </main>
      </div>
    </div>
  );
}

export default Layout;
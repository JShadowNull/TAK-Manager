import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from '../shadcn/sidebar/app-sidebar';
import { SidebarProvider } from '../shadcn/sidebar/sidebar';
import CustomScrollbar from './CustomScrollbar';

const Layout: React.FC = () => {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen bg-background relative">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <main className="flex-1 overflow-hidden mt-[56px] xl:mt-0">
            <CustomScrollbar>
              <div className="px-4 py-4 xl:px-6 xl:py-6">
                <Outlet />
              </div>
            </CustomScrollbar>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout; 
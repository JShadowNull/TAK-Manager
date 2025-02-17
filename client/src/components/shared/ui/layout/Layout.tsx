import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from '../shadcn/sidebar/app-sidebar';
import { SidebarProvider } from '../shadcn/sidebar/sidebar';
import { ScrollArea } from '@/components/shared/ui/shadcn/scroll-area';
import { Toaster } from "@/components/shared/ui/shadcn/toast/toaster"

const Layout: React.FC = () => {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-0">
          <main className="flex-1 h-screen">
            <ScrollArea className="h-full">
              <div className="mt-[56px] p-4 xl:mt-0 xl:pt-2 xl:pb-2 xl:pr-6">
                <Outlet />
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
};

export default Layout; 
import { useState, useEffect, createContext, useContext } from "react"
import { useLocation, Link } from "react-router-dom"
import {
  Home,
  Wrench,
  Key,
  Database,
  Menu,
  Settings,
} from "lucide-react"
import { ModeToggle } from "@/components/shared/ui/shadcn/mode-toggle"
import { Sheet, SheetContent } from "@/components/shared/ui/shadcn/sheet"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,
} from "@/components/shared/ui/shadcn/sidebar/sidebar"

interface ServerState {
  isInstalled: boolean;
  isRunning: boolean;
  isRestarting: boolean;
  version: string;
  error?: string;
}

interface TakServerContextType {
  serverState: ServerState;
  setServerState: React.Dispatch<React.SetStateAction<ServerState>>;
}

export const TakServerContext = createContext<TakServerContextType | undefined>(undefined);

export const useTakServer = () => {
  const context = useContext(TakServerContext);
  if (context === undefined) {
    throw new Error('useTakServer must be used within a TakServerProvider');
  }
  return context;
};

export function TakServerProvider({ children }: { children: React.ReactNode }) {
  const [serverState, setServerState] = useState<ServerState>(() => {
    // Try to get initial state from localStorage
    const savedState = localStorage.getItem('takServerState')
    if (savedState) {
      try {
        return JSON.parse(savedState)
      } catch (error) {
        // Removed console.error
      }
    }
    // Default state if nothing in localStorage
    return {
      isInstalled: false,
      isRunning: false,
      isRestarting: false,
      version: 'Not Installed'
    }
  });

  // Update localStorage whenever serverState changes
  useEffect(() => {
    localStorage.setItem('takServerState', JSON.stringify(serverState));
    window.dispatchEvent(new Event('takServerStateChange'));
  }, [serverState]);

  // Fetch status on mount and setup SSE
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/takserver/takserver-status');
        if (!response.ok) {
          throw new Error(`Failed to fetch status: ${response.statusText}`);
        }
        const data = await response.json();
        setServerState(data);
      } catch (error) {
        setServerState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Failed to fetch server status' 
        }));
      }
    };

    // Initial fetch
    fetchStatus();

    // Setup SSE with reconnection logic
    const serverStatus = new EventSource('/api/takserver/server-status-stream');

    // Handle connection open
    serverStatus.onopen = () => {
      // Connection opened
    };

    // Handle errors and reconnection
    serverStatus.onerror = () => {
      // The browser will automatically try to reconnect
    };

    // Handle server status events
    serverStatus.addEventListener('server-status', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle both direct status updates and operation events
        if (data.type === 'status') {
          const statusData = data.data;
          if (statusData && typeof statusData.isInstalled !== 'undefined') {
            setServerState(prev => ({
              ...prev,
              ...statusData,
              // Maintain restarting state until server is confirmed running
              isRestarting: statusData.isRunning ? false : prev.isRestarting
            }));
          }
        } else if (data.type === 'operation') {
          // Fetch latest status after operation completes
          if (data.status === 'complete' || data.status === 'error') {
            fetchStatus();
          }
        }
      } catch (error) {
        // Error parsing event data
      }
    });

    // Cleanup on unmount
    return () => {
      serverStatus.close();
    };
  }, []);

  return (
    <TakServerContext.Provider value={{ serverState, setServerState }}>
      {children}
    </TakServerContext.Provider>
  );
}

const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    iconColor: "text-orange-500",
    alwaysShow: true,
  },
  {
    title: "TAK Server Manager",
    url: "/takserver",
    icon: Wrench,
    iconColor: "text-blue-500",
    alwaysShow: true,
  },
  {
    title: "Certificate Manager",
    url: "/cert-manager",
    icon: Key,
    iconColor: "text-yellow-500",
    alwaysShow: false,
    showWhen: (takServerInstalled: boolean) => takServerInstalled,
  },
  {
    title: "Data Package Configuration",
    url: "/data-package",
    icon: Database,
    iconColor: "text-pink-500",
    alwaysShow: false,
    showWhen: (takServerInstalled: boolean) => takServerInstalled,
  },
  {
    title: "Advanced Features",
    url: "/advanced-features",
    icon: Settings,
    iconColor: "text-purple-500",
    alwaysShow: false,
    showWhen: (takServerInstalled: boolean) => takServerInstalled,
  },
]

export function AppSidebar() {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const { serverState } = useTakServer();

  const getTitle = () => {
    const currentItem = items.find(item => item.url === location.pathname)
    return currentItem?.title || "Dashboard"
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Mobile Header */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xs border-b border-border">
        <div className="relative flex items-center h-14">
          <div className="absolute left-4">
            {!isOpen && (
              <button 
                onClick={() => setIsOpen(true)}
                className="p-2 hover:bg-accent rounded-md"
              >
                <Menu className="h-6 w-6" />
              </button>
            )}
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            <h1 className="text-lg font-bold text-foreground">{getTitle()}</h1>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          side="left" 
          className="fixed inset-0 w-full p-0 border-0"
        >
          <div className="flex flex-col h-full bg-background">
            <SidebarHeader className="relative flex items-center justify-center h-14 border-b border-border">
              <h1 className="text-lg font-bold text-foreground">{getTitle()}</h1>
            </SidebarHeader>
            <SidebarContent className="px-2">
              <SidebarGroup>
                <SidebarGroupLabel className="px-2">TAK Manager</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items
                      .filter((item) => item.alwaysShow || item.showWhen?.(serverState.isInstalled))
                      .map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <Link
                            to={item.url}
                            onClick={() => setIsOpen(false)}
                            className="w-full"
                          >
                            <SidebarMenuButton
                              className={
                                location.pathname === item.url
                                  ? "bg-accent text-accent-foreground w-full h-12"
                                  : "text-muted-foreground hover:text-foreground w-full h-12"
                              }
                            >
                              <item.icon
                                className={`h-5 w-5 mr-3 ${
                                  location.pathname === item.url
                                    ? "text-accent-foreground"
                                    : item.iconColor
                                }`}
                              />
                              <span className="text-base">{item.title}</span>
                            </SidebarMenuButton>
                          </Link>
                        </SidebarMenuItem>
                      ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="mt-auto border-t border-border p-6">
              <div className="flex items-center justify-center w-full">
                <ModeToggle />
              </div>
            </SidebarFooter>
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Desktop Sidebar */}
      <div className="hidden xl:block">
        <Sidebar 
          variant="floating" 
          collapsible="icon"
          className="w-[18rem]!"
        >
          <SidebarHeader className="flex items-center justify-between p-4 border-b border-border">
            <h1 className="text-lg font-bold text-foreground">{getTitle()}</h1>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>TAK Manager</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items
                    .filter((item) => item.alwaysShow || item.showWhen?.(serverState.isInstalled))
                    .map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <Link
                          to={item.url}
                          className="w-full"
                        >
                          <SidebarMenuButton
                            className={
                              location.pathname === item.url
                                ? "bg-accent text-accent-foreground w-full"
                                : "text-muted-foreground hover:text-foreground w-full"
                            }
                          >
                            <item.icon
                              className={`h-4 w-4 mr-2 ${
                                location.pathname === item.url
                                  ? "text-accent-foreground"
                                  : item.iconColor
                              }`}
                            />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="flex items-center justify-center p-4 border-t border-border">
            <div className="flex items-center justify-center w-full">
              <ModeToggle />
            </div>
          </SidebarFooter>
        </Sidebar>
      </div>
    </div>
  )
}

import { useState, useEffect } from "react"
import { useLocation, Link } from "react-router-dom"
import {
  Home,
  Wrench,
  Key,
  Database,
  ArrowLeftRight,
  Menu,
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
    title: "Rapid Transfer",
    url: "/transfer",
    icon: ArrowLeftRight,
    iconColor: "text-yellow-500",
    alwaysShow: true,
  },
]

export function AppSidebar() {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [takServerInstalled, setTakServerInstalled] = useState(false)

  // Listen for changes to TAK server state
  useEffect(() => {
    const updateTakServerState = () => {
      const savedState = localStorage.getItem('takServerState')
      if (savedState) {
        try {
          const state = JSON.parse(savedState)
          setTakServerInstalled(state.isInstalled === true)
        } catch (error) {
          console.error('Error parsing TAK server state:', error)
          setTakServerInstalled(false)
        }
      } else {
        setTakServerInstalled(false)
      }
    }

    // Initial state
    updateTakServerState()

    // Listen for storage changes and custom event
    window.addEventListener('storage', updateTakServerState)
    window.addEventListener('takServerStateChange', updateTakServerState)
    
    // Cleanup
    return () => {
      window.removeEventListener('storage', updateTakServerState)
      window.removeEventListener('takServerStateChange', updateTakServerState)
    }
  }, [])

  const getTitle = () => {
    const currentItem = items.find(item => item.url === location.pathname)
    return currentItem?.title || "Dashboard"
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
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
                      .filter((item) => item.alwaysShow || item.showWhen?.(takServerInstalled))
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
          className="!w-[16rem]"
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
                    .filter((item) => item.alwaysShow || item.showWhen?.(takServerInstalled))
                    .map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <Link
                          to={item.url}
                          onClick={(e) => {
                            if (
                              location.pathname === item.url &&
                              item.url === "/data-package"
                            ) {
                              e.preventDefault()
                              return
                            }
                          }}
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
    </>
  )
}

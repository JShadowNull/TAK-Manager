import { useState } from "react"
import { useLocation, Link } from "react-router-dom"
import {
  Home,
  Settings,
  Wrench,
  Key,
  Database,
  ArrowLeftRight,
} from "lucide-react"
import useSocket from "@/components/shared/hooks/useSocket"
import { ModeToggle } from "@/components/shared/ui/shadcn/mode-toggle"

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
    title: "Services",
    url: "/services",
    icon: Settings,
    iconColor: "text-purple-500",
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
  const [takServerInstalled, setTakServerInstalled] = useState(false)

  const { isConnected } = useSocket('/takserver-status', {
    eventHandlers: {
      takserver_status: (status: { isInstalled: boolean }) => {
        setTakServerInstalled(status.isInstalled)
      },
      onConnect: (socket: any) => {
        console.log('Connected to TAK server status service')
        socket.emit('check_status')
      }
    }
  })

  return (
    <Sidebar variant="floating" collapsible="icon" className="!w-[16rem]">
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
      <SidebarFooter className="flex items-center justify-center p-4">
        <div className="flex items-center justify-center w-full">
          <ModeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

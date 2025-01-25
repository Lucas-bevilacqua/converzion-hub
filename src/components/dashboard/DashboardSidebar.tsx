import { Home, MessageSquare, Crown, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/auth/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface DashboardSidebarProps {
  onSectionChange: (section: string) => void
  activeSection: string
}

export function DashboardSidebar({ onSectionChange, activeSection }: DashboardSidebarProps) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { toast } = useToast()
  const isMobile = useIsMobile()

  console.log("DashboardSidebar - Mobile:", isMobile, "Active Section:", activeSection)

  const handleSignOut = async () => {
    try {
      await signOut()
      toast({
        title: "Desconectado com sucesso",
        description: "Você foi desconectado da sua conta.",
      })
      navigate("/login")
    } catch (error) {
      console.error("Error signing out:", error)
      toast({
        variant: "destructive",
        title: "Erro ao desconectar",
        description: "Ocorreu um erro ao tentar desconectar. Tente novamente.",
      })
    }
  }

  const menuItems = [
    {
      title: "Visão Geral",
      icon: Home,
      id: "overview"
    },
    {
      title: "Instâncias WhatsApp",
      icon: MessageSquare,
      id: "instances"
    },
    {
      title: "Assinatura",
      icon: Crown,
      id: "subscription"
    }
  ]

  return (
    <Sidebar 
      variant={isMobile ? "floating" : "sidebar"} 
      collapsible="offcanvas"
      className="bg-white/50 backdrop-blur-sm border-r border-border/50"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-foreground/70">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    onClick={() => onSectionChange(item.id)}
                    data-active={activeSection === item.id}
                    className="hover:bg-primary/10 data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={handleSignOut}
                  className="hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
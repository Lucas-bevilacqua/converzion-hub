import { Home, MessageSquare, Bot, Crown, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/auth/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
      title: "Configurações IA",
      icon: Bot,
      id: "ai-settings"
    },
    {
      title: "Assinatura",
      icon: Crown,
      id: "subscription"
    }
  ]

  return (
    <Sidebar variant={isMobile ? "floating" : "sidebar"} collapsible="offcanvas">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    onClick={() => onSectionChange(item.id)}
                    data-active={activeSection === item.id}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSignOut}>
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
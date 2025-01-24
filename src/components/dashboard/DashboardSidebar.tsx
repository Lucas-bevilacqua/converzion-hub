import { Brain, MessageSquare, ChartColumn, Settings2, Zap, Users, Shield, Bot } from "lucide-react";
import { useAuth } from "@/contexts/auth/AuthContext";
import { useState } from "react";
import { 
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from "@/components/ui/sidebar";

export function DashboardSidebar({ onSectionChange, activeSection }: { onSectionChange: (section: string) => void; activeSection: string; }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleSectionChange = (section: string) => {
    onSectionChange(section);
    setIsOpen(false);
  };

  return (
    <Sidebar defaultOpen={!isOpen}>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => handleSectionChange("overview")}
              isActive={activeSection === "overview"}
              icon={<Bot className="h-5 w-5" />}
            >
              Visão Geral
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => handleSectionChange("instances")}
              isActive={activeSection === "instances"}
              icon={<MessageSquare className="h-5 w-5" />}
            >
              Instâncias
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => handleSectionChange("metrics")}
              isActive={activeSection === "metrics"}
              icon={<ChartColumn className="h-5 w-5" />}
            >
              Métricas
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => handleSectionChange("settings")}
              isActive={activeSection === "settings"}
              icon={<Settings2 className="h-5 w-5" />}
            >
              Configurações
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => handleSectionChange("subscription")}
              isActive={activeSection === "subscription"}
              icon={<Zap className="h-5 w-5" />}
            >
              Assinatura
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => handleSectionChange("users")}
              isActive={activeSection === "users"}
              icon={<Users className="h-5 w-5" />}
            >
              Usuários
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => handleSectionChange("security")}
              isActive={activeSection === "security"}
              icon={<Shield className="h-5 w-5" />}
            >
              Segurança
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
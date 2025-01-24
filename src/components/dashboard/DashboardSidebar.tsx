import { Brain, MessageSquare, ChartColumn, Settings2, Zap, Users, Shield, Bot } from "lucide-react";
import { useAuth } from "@/contexts/auth/AuthContext";
import { useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { SidebarItem } from "@/components/ui/sidebar/SidebarItem";

export function DashboardSidebar({ onSectionChange, activeSection }: { onSectionChange: (section: string) => void; activeSection: string; }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleSectionChange = (section: string) => {
    onSectionChange(section);
    setIsOpen(false);
  };

  return (
    <Sidebar open={isOpen} onOpenChange={setIsOpen}>
      <SidebarItem
        icon={<Bot className="h-5 w-5" />}
        onClick={() => handleSectionChange("overview")}
        active={activeSection === "overview"}
      >
        Visão Geral
      </SidebarItem>
      <SidebarItem
        icon={<MessageSquare className="h-5 w-5" />}
        onClick={() => handleSectionChange("instances")}
        active={activeSection === "instances"}
      >
        Instâncias
      </SidebarItem>
      <SidebarItem
        icon={<ChartColumn className="h-5 w-5" />}
        onClick={() => handleSectionChange("metrics")}
        active={activeSection === "metrics"}
      >
        Métricas
      </SidebarItem>
      <SidebarItem
        icon={<Settings2 className="h-5 w-5" />}
        onClick={() => handleSectionChange("settings")}
        active={activeSection === "settings"}
      >
        Configurações
      </SidebarItem>
      <SidebarItem
        icon={<Zap className="h-5 w-5" />}
        onClick={() => handleSectionChange("subscription")}
        active={activeSection === "subscription"}
      >
        Assinatura
      </SidebarItem>
      <SidebarItem
        icon={<Users className="h-5 w-5" />}
        onClick={() => handleSectionChange("users")}
        active={activeSection === "users"}
      >
        Usuários
      </SidebarItem>
      <SidebarItem
        icon={<Shield className="h-5 w-5" />}
        onClick={() => handleSectionChange("security")}
        active={activeSection === "security"}
      >
        Segurança
      </SidebarItem>
    </Sidebar>
  );
}

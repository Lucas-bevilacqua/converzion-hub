import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Header = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const menuItems = [
    { label: "Home", path: "/" },
    { label: "Preços", path: "/pricing" },
    { label: "Dashboard", path: "/dashboard" },
  ];

  const renderDesktopMenu = () => (
    <nav className="hidden md:flex items-center gap-6">
      {menuItems.map((item) => (
        <Button
          key={item.path}
          variant="ghost"
          onClick={() => navigate(item.path)}
          className="text-sm font-medium transition-colors hover:text-primary"
        >
          {item.label}
        </Button>
      ))}
      <Button
        onClick={() => navigate("/login")}
        variant="outline"
        className="ml-4"
      >
        Login
      </Button>
      <Button
        onClick={() => navigate("/register")}
        className="bg-primary hover:bg-primary-600"
      >
        Começar Agora
      </Button>
    </nav>
  );

  const renderMobileMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {menuItems.map((item) => (
          <DropdownMenuItem
            key={item.path}
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => navigate("/login")}>
          Login
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/register")}>
          Começar Agora
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-xl font-bold"
          >
            Converzion
          </Button>
        </div>
        {isMobile ? renderMobileMenu() : renderDesktopMenu()}
      </div>
    </header>
  );
};
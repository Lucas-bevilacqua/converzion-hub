import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, ChartBar } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const stats = [
    {
      title: "Total de Conversas",
      value: "150",
      icon: Activity,
      description: "Últimos 30 dias",
    },
    {
      title: "Usuários Ativos",
      value: "32",
      icon: Users,
      description: "Neste momento",
    },
    {
      title: "Taxa de Conversão",
      value: "8.5%",
      icon: ChartBar,
      description: "Média mensal",
    },
  ];

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Bot, Zap, BarChart3, Settings2 } from "lucide-react";

const features = [
  {
    title: "Atendimento Inteligente",
    description: "Automatize seu atendimento com IA avançada",
    icon: Bot,
  },
  {
    title: "Integração WhatsApp",
    description: "Conecte-se diretamente com seus clientes",
    icon: Zap,
  },
  {
    title: "Análise de Dados",
    description: "Métricas detalhadas do seu atendimento",
    icon: BarChart3,
  },
  {
    title: "Personalização Total",
    description: "Configure a IA de acordo com seu negócio",
    icon: Settings2,
  },
];

export const FeaturesSection = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-white to-primary-50">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-primary-950">
          Por que escolher a Converzion?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <Card 
              key={feature.title} 
              className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 bg-white/50 backdrop-blur-sm"
            >
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                <CardDescription className="text-gray-600">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
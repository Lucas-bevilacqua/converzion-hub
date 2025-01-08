import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Bot, MessageSquare, BarChart3, Settings2 } from "lucide-react";

const features = [
  {
    title: "Atendimento Inteligente",
    description: "Automatize seu atendimento com IA avançada que entende o contexto e responde como um humano",
    icon: Bot,
  },
  {
    title: "Integração WhatsApp",
    description: "Conecte-se diretamente com seus clientes através do WhatsApp Business API oficial",
    icon: MessageSquare,
  },
  {
    title: "Análise de Dados",
    description: "Acompanhe métricas detalhadas do seu atendimento e tome decisões baseadas em dados",
    icon: BarChart3,
  },
  {
    title: "Personalização Total",
    description: "Configure a IA de acordo com seu negócio, tom de voz e regras de atendimento",
    icon: Settings2,
  },
];

export const FeaturesSection = () => {
  return (
    <section className="py-24 bg-white">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-6">
            Por que escolher a Converzion?
          </h2>
          <p className="text-gray-600 text-lg">
            Nossa plataforma combina o poder da IA com a praticidade do WhatsApp
            para revolucionar seu atendimento ao cliente
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary-50 flex items-center justify-center mb-4">
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
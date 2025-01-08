import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Bot, MessageSquare, BarChart3, Settings2, Brain, Zap, Shield, Users } from "lucide-react";

const features = [
  {
    title: "IA Avançada",
    description: "Respostas contextualizadas e naturais com GPT-4, entendendo perfeitamente as necessidades dos seus clientes",
    icon: Brain,
    color: "bg-purple-50 text-purple-600",
  },
  {
    title: "WhatsApp Business API",
    description: "Integração oficial com a API do WhatsApp Business, garantindo segurança e confiabilidade nas conversas",
    icon: MessageSquare,
    color: "bg-green-50 text-green-600",
  },
  {
    title: "Analytics Detalhado",
    description: "Métricas completas de atendimento, conversão e satisfação para otimizar sua estratégia",
    icon: BarChart3,
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "Personalização Total",
    description: "Configure a IA de acordo com seu negócio, tom de voz e regras específicas de atendimento",
    icon: Settings2,
    color: "bg-orange-50 text-orange-600",
  },
  {
    title: "Respostas Instantâneas",
    description: "Atendimento 24/7 com respostas imediatas, aumentando a satisfação dos clientes",
    icon: Zap,
    color: "bg-yellow-50 text-yellow-600",
  },
  {
    title: "Multi-atendentes",
    description: "Gerencie múltiplos atendentes virtuais para diferentes setores ou necessidades",
    icon: Users,
    color: "bg-pink-50 text-pink-600",
  },
  {
    title: "Segurança Avançada",
    description: "Proteção de dados e conformidade com LGPD para garantir a privacidade das conversas",
    icon: Shield,
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    title: "IA Treinável",
    description: "Sistema que aprende com as interações e melhora continuamente o atendimento",
    icon: Bot,
    color: "bg-red-50 text-red-600",
  },
];

export const FeaturesSection = () => {
  return (
    <section className="py-24 bg-white">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            Tecnologia de Ponta para seu Negócio
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed">
            Nossa plataforma combina inteligência artificial avançada com a praticidade
            do WhatsApp para revolucionar seu atendimento e impulsionar suas vendas
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <Card 
              key={feature.title} 
              className="border-none shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              <CardHeader>
                <div className={`h-12 w-12 rounded-lg ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-6 w-6" />
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
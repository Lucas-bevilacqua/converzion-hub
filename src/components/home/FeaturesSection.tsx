import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Bot, MessageSquare, BarChart3, Settings2, Brain, Zap, Shield, Users } from "lucide-react";

const features = [
  {
    title: "IA de Última Geração",
    description: "Tecnologia avançada que entende o contexto e personaliza respostas para cada cliente, garantindo interações naturais e eficientes.",
    icon: Brain,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "WhatsApp Business API",
    description: "Integração oficial e segura com a API do WhatsApp Business, mantendo sua conta verificada e protegida.",
    icon: MessageSquare,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "Analytics em Tempo Real",
    description: "Acompanhe métricas detalhadas de atendimento, taxa de conversão e satisfação dos clientes para otimizar resultados.",
    icon: BarChart3,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "Personalização Total",
    description: "Configure a IA com o tom de voz da sua marca e regras específicas do seu negócio para um atendimento único.",
    icon: Settings2,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "Disponibilidade 24/7",
    description: "Atendimento ininterrupto todos os dias, garantindo que nenhuma oportunidade de venda seja perdida.",
    icon: Zap,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "Multi-atendentes",
    description: "Gerencie múltiplos atendentes virtuais para diferentes setores e necessidades do seu negócio.",
    icon: Users,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "Segurança Avançada",
    description: "Proteção total dos seus dados com criptografia de ponta a ponta e conformidade com LGPD.",
    icon: Shield,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "IA Evolutiva",
    description: "Sistema que aprende continuamente com as interações, melhorando o atendimento ao longo do tempo.",
    icon: Bot,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
];

export const FeaturesSection = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-[#1A1F2C] to-[#2A2F3C]">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold mb-6 text-white">
            Tecnologia de Ponta para seus{" "}
            <span className="bg-gradient-to-r from-[#9b87f5] to-[#b8a2ff] bg-clip-text text-transparent">
              Resultados
            </span>
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed">
            Uma plataforma completa que combina inteligência artificial com WhatsApp
            para automatizar seu atendimento e aumentar suas vendas
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <Card 
              key={feature.title} 
              className="border-none bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group hover:-translate-y-1"
            >
              <CardHeader>
                <div className={`h-12 w-12 rounded-lg ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl mb-2 text-white">{feature.title}</CardTitle>
                <CardDescription className="text-gray-400">
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
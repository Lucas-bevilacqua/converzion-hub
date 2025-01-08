import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Bot, MessageSquare, BarChart3, Settings2, Brain, Zap, Shield, Users } from "lucide-react";

const features = [
  {
    title: "Vendas Automáticas",
    description: "Nossa IA identifica oportunidades e fecha vendas automaticamente, convertendo leads em clientes 24 horas por dia.",
    icon: Brain,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "WhatsApp Oficial",
    description: "Integração segura e verificada com WhatsApp Business API, mantendo sua conta protegida e profissional.",
    icon: MessageSquare,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "Métricas em Tempo Real",
    description: "Acompanhe vendas, conversões e desempenho em tempo real. Tome decisões baseadas em dados concretos.",
    icon: BarChart3,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "Personalização Total",
    description: "IA treinada com o DNA do seu negócio, garantindo atendimento personalizado e alinhado com sua marca.",
    icon: Settings2,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "Escala Ilimitada",
    description: "Atenda milhares de clientes simultaneamente sem perder qualidade ou aumentar custos.",
    icon: Zap,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "Multicanal Integrado",
    description: "Gerencie todos seus canais de atendimento em um só lugar, com respostas consistentes e profissionais.",
    icon: Users,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "100% Seguro",
    description: "Seus dados e conversas protegidos com criptografia de ponta a ponta e conformidade total com LGPD.",
    icon: Shield,
    color: "bg-[#9b87f5]/10 text-[#9b87f5]",
  },
  {
    title: "Resultados Comprovados",
    description: "Aumento médio de 40% nas vendas e redução de 80% nos custos de atendimento dos nossos clientes.",
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
            Tecnologia que{" "}
            <span className="bg-gradient-to-r from-[#9b87f5] to-[#b8a2ff] bg-clip-text text-transparent">
              Multiplica Resultados
            </span>
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed">
            Automatize seu atendimento e transforme cada conversa em uma oportunidade de venda, 
            24 horas por dia, 7 dias por semana
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
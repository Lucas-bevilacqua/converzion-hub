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
    title: "IA Avançada GPT-4",
    description: "Respostas contextualizadas e naturais que realmente entendem seus clientes. Aumente suas vendas com atendimento personalizado em escala.",
    icon: Brain,
    color: "bg-purple-50 text-purple-600",
  },
  {
    title: "WhatsApp Business API",
    description: "Integração oficial e segura com o WhatsApp Business. Mantenha sua conta verificada e protegida, garantindo confiabilidade nas conversas.",
    icon: MessageSquare,
    color: "bg-green-50 text-green-600",
  },
  {
    title: "Analytics Completo",
    description: "Acompanhe em tempo real suas métricas de atendimento, taxa de conversão e satisfação dos clientes. Tome decisões baseadas em dados.",
    icon: BarChart3,
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "100% Personalizável",
    description: "Adapte a IA ao seu negócio com prompts personalizados, tom de voz da sua marca e regras específicas de atendimento.",
    icon: Settings2,
    color: "bg-orange-50 text-orange-600",
  },
  {
    title: "Atendimento 24/7",
    description: "Nunca mais perca uma venda. Responda seus clientes instantaneamente, 24 horas por dia, 7 dias por semana, sem atrasos.",
    icon: Zap,
    color: "bg-yellow-50 text-yellow-600",
  },
  {
    title: "Multi-atendentes",
    description: "Gerencie múltiplos atendentes virtuais para diferentes setores ou necessidades do seu negócio com total controle.",
    icon: Users,
    color: "bg-pink-50 text-pink-600",
  },
  {
    title: "Segurança Máxima",
    description: "Seus dados e conversas protegidos com criptografia de ponta a ponta. Total conformidade com LGPD e padrões internacionais.",
    icon: Shield,
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    title: "IA que Aprende",
    description: "Sistema que evolui continuamente com as interações, melhorando o atendimento e as taxas de conversão ao longo do tempo.",
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
            Tecnologia de Ponta para Maximizar seus Resultados
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed">
            Uma plataforma completa que combina inteligência artificial avançada com o WhatsApp
            para automatizar seu atendimento e multiplicar suas vendas
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
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
    description: "Atendimento humanizado e personalizado que realmente entende seus clientes. Aumente suas vendas com respostas contextualizadas e naturais.",
    icon: Brain,
    color: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400",
  },
  {
    title: "WhatsApp Business API",
    description: "Integração oficial e segura com o WhatsApp Business. Mantenha sua conta verificada e protegida, garantindo máxima confiabilidade.",
    icon: MessageSquare,
    color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
  },
  {
    title: "Analytics em Tempo Real",
    description: "Acompanhe métricas de atendimento, taxa de conversão e satisfação dos clientes. Tome decisões estratégicas baseadas em dados.",
    icon: BarChart3,
    color: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  },
  {
    title: "Totalmente Personalizável",
    description: "Configure a IA com o tom de voz da sua marca, prompts personalizados e regras específicas para seu negócio.",
    icon: Settings2,
    color: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
  },
  {
    title: "Atendimento 24/7",
    description: "Nunca mais perca uma venda. Responda seus clientes instantaneamente, 24 horas por dia, 7 dias por semana.",
    icon: Zap,
    color: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  },
  {
    title: "Multi-atendentes",
    description: "Gerencie múltiplos atendentes virtuais para diferentes setores ou necessidades do seu negócio com total controle.",
    icon: Users,
    color: "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400",
  },
  {
    title: "Segurança Máxima",
    description: "Seus dados e conversas protegidos com criptografia de ponta a ponta. Total conformidade com LGPD e padrões internacionais.",
    icon: Shield,
    color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
  },
  {
    title: "IA que Evolui",
    description: "Sistema que aprende continuamente com as interações, melhorando o atendimento e as taxas de conversão ao longo do tempo.",
    icon: Bot,
    color: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  },
];

export const FeaturesSection = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
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
              className="border-none shadow-lg hover:shadow-xl transition-all duration-300 group hover:-translate-y-1"
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
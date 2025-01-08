import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, DollarSign, Zap } from "lucide-react";

const benefits = [
  {
    title: "Economia de Tempo e Dinheiro",
    description:
      "Reduza custos operacionais em até 60% automatizando o atendimento inicial",
    icon: DollarSign,
    items: [
      "Redução de custos operacionais",
      "Automação de tarefas repetitivas",
      "Escalabilidade sem custos adicionais",
    ],
  },
  {
    title: "Atendimento 24/7",
    description:
      "Nunca mais perca uma oportunidade de venda com atendimento automático",
    icon: Clock,
    items: [
      "Disponibilidade total",
      "Respostas instantâneas",
      "Qualificação automática de leads",
    ],
  },
  {
    title: "Integração Rápida",
    description: "Configure em minutos e comece a usar imediatamente",
    icon: Zap,
    items: [
      "Setup em 5 minutos",
      "Treinamento incluído",
      "Suporte técnico dedicado",
    ],
  },
];

export const BenefitsSection = () => {
  return (
    <section className="py-24 bg-white">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-primary-950">
          Por que escolher a Converzion?
        </h2>
        <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
          Transforme seu atendimento com tecnologia de ponta e veja seus resultados multiplicarem
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefits.map((benefit) => (
            <Card
              key={benefit.title}
              className="border-none shadow-lg hover:shadow-xl transition-all"
            >
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-primary-950">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 mb-6">{benefit.description}</p>
                <ul className="space-y-3">
                  {benefit.items.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
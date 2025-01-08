import { Users2, MessageSquare, TrendingUp, Clock } from "lucide-react";

const metrics = [
  {
    title: "+2000",
    description: "Empresas Atendidas",
    icon: Users2,
  },
  {
    title: "+1M",
    description: "Mensagens Processadas",
    icon: MessageSquare,
  },
  {
    title: "45%",
    description: "Aumento em Conversão",
    icon: TrendingUp,
  },
  {
    title: "24/7",
    description: "Disponibilidade",
    icon: Clock,
  },
];

export const MetricsSection = () => {
  return (
    <section className="py-16 bg-primary-50">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {metrics.map((metric) => (
            <div
              key={metric.title}
              className="text-center p-6 rounded-lg bg-white/50 backdrop-blur-sm hover:shadow-lg transition-all"
            >
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <metric.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-primary-950 mb-2">
                {metric.title}
              </h3>
              <p className="text-gray-600">{metric.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
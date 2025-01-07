import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const features = [
  {
    title: "Atendimento Inteligente",
    description: "Automatize seu atendimento com IA avançada",
  },
  {
    title: "Integração WhatsApp",
    description: "Conecte-se diretamente com seus clientes",
  },
  {
    title: "Análise de Dados",
    description: "Métricas detalhadas do seu atendimento",
  },
  {
    title: "Personalização Total",
    description: "Configure a IA de acordo com seu negócio",
  },
];

export const FeaturesSection = () => {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container">
        <h2 className="text-3xl font-bold text-center mb-12">
          Por que escolher a Converzion?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";

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

const plans = [
  {
    name: "Starter",
    price: "4,97",
    description: "Perfeito para começar",
    features: [
      "1 Instância",
      "5.000 Interações de IA",
      "Suporte por email",
      "Integração básica com HubSpot",
      "Modelo de IA: GPT-4",
      "Análises básicas",
    ],
  },
  {
    name: "Professional",
    price: "9,97",
    description: "Para negócios em crescimento",
    features: [
      "3 Instâncias",
      "15.000 Interações de IA",
      "Suporte prioritário",
      "Modelo de IA: GPT-4",
      "Análises avançadas",
      "Treinamento de IA",
    ],
  },
  {
    name: "Enterprise",
    price: "Personalizado",
    description: "Para grandes empresas",
    features: [
      "Instâncias ilimitadas",
      "Interações ilimitadas",
      "Suporte 24/7",
      "Modelo de IA personalizado",
      "Análises personalizadas",
      "Acesso à API",
      "Integrações customizadas",
      "Suporte dedicado",
    ],
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="pt-32 pb-16 px-4">
          <div className="container">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                Transforme seu Atendimento com{" "}
                <span className="text-primary">Inteligência Artificial</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Automatize seu WhatsApp com IA avançada e ofereça atendimento
                24/7 para seus clientes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => navigate("/register")}
                  className="bg-primary hover:bg-primary-600"
                >
                  Começar Gratuitamente
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/contact")}
                >
                  Falar com Especialista
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
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

        {/* Pricing Section */}
        <section className="py-16">
          <div className="container">
            <h2 className="text-3xl font-bold text-center mb-12">
              Planos que cabem no seu bolso
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <Card
                  key={plan.name}
                  className="relative hover:shadow-xl transition-shadow duration-300"
                >
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-3xl font-bold">
                        {plan.price === "Personalizado" ? (
                          "Personalizado"
                        ) : (
                          <>
                            R$ {plan.price}
                            <span className="text-sm font-normal">/mês</span>
                          </>
                        )}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full mt-6"
                      onClick={() => navigate("/register")}
                    >
                      {plan.price === "Personalizado"
                        ? "Falar com Vendas"
                        : "Começar Agora"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
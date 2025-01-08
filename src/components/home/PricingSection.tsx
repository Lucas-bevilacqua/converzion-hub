import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Starter Plan",
    price: "497,00",
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
    name: "Professional Plan",
    price: "997,00",
    description: "Para negócios em crescimento",
    popular: true,
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

export const PricingSection = () => {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { toast } = useToast();

  const handleSubscribe = async (plan: typeof plans[0]) => {
    if (plan.price === "Personalizado") {
      navigate("/contact");
      return;
    }

    if (!user) {
      toast({
        title: "Login necessário",
        description: "Faça login para assinar um plano",
      });
      navigate("/login");
      return;
    }

    try {
      console.log("Creating checkout session for plan:", plan.name);
      const response = await fetch(
        "https://vodexhppkasbulogmcqb.functions.supabase.co/stripe-checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ 
            planName: plan.name,
            priceAmount: plan.price
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("Checkout error:", error);
        throw new Error(error.message || "Failed to create checkout session");
      }

      const { url } = await response.json();
      if (url) {
        console.log("Redirecting to checkout URL:", url);
        window.location.href = url;
      }
    } catch (error) {
      console.error("Erro ao criar sessão de checkout:", error);
      toast({
        title: "Erro",
        description: "Não foi possível processar sua assinatura",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="py-24 bg-gradient-to-b from-primary-50 to-white">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-primary-950">
          Planos que cabem no seu bolso
        </h2>
        <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
          Escolha o plano ideal para o seu negócio e comece a transformar seu atendimento hoje mesmo
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative hover:shadow-xl transition-shadow duration-300 ${
                plan.popular ? 'border-primary shadow-lg scale-105' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white text-sm px-3 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="h-4 w-4" />
                    Mais Popular
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-primary-950">
                    {plan.price === "Personalizado" ? (
                      "Personalizado"
                    ) : (
                      <>
                        R$ {plan.price}
                        <span className="text-sm font-normal text-gray-600">/mês</span>
                      </>
                    )}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full mt-8 h-12 rounded-full ${
                    plan.popular
                      ? 'bg-primary hover:bg-primary-600'
                      : 'bg-primary/90 hover:bg-primary'
                  }`}
                  onClick={() => handleSubscribe(plan)}
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
  );
};
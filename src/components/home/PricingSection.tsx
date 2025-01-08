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
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "4,97",
    priceId: "price_1QbuUiKkjJ7tububpw8Vpsrp_test", // Updated to test mode price ID
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
    priceId: "price_1QbuUvKkjJ7tububiklS9tAc_test", // Updated to test mode price ID
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

export const PricingSection = () => {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { toast } = useToast();

  const handleSubscribe = async (priceId?: string) => {
    if (!priceId) {
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
      const response = await fetch(
        "https://vodexhppkasbulogmcqb.functions.supabase.co/stripe-checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ priceId }),
        }
      );

      const { url } = await response.json();
      if (url) {
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
                  onClick={() => handleSubscribe(plan.priceId)}
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
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
    features: [
      "3 Instâncias",
      "15.000 Interações de IA",
      "Suporte prioritário",
      "Modelo de IA: GPT-4",
      "Análises avançadas",
      "Treinamento de IA",
    ],
    highlighted: true,
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
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubscribe = async (plan: typeof plans[0]) => {
    console.log("Handling subscription for plan:", plan.name);
    
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
      const { data: { session } } = await supabase.auth.getSession();
      
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
            priceId: plan.name === "Professional Plan" 
              ? "price_1QbuUiKkjJ7tububpw8Vpsrp" 
              : "price_1QbuUiKkjJ7tububpw8Vpsrp"
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
    <section className="py-24 bg-gradient-to-b from-[#F5F7FA] to-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      <div className="container relative">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-[#0056D2] to-[#00C896] bg-clip-text text-transparent">
            Planos que cabem no seu bolso
          </h2>
          <p className="text-[#333333]/80 text-lg">
            Escolha o plano ideal para o seu negócio
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl bg-white p-8 shadow-lg transition-all duration-300 hover:shadow-xl border border-gray-100 ${
                plan.highlighted
                  ? "md:-mt-8 md:scale-105 ring-2 ring-[#0056D2]"
                  : ""
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#0056D2] text-white px-4 py-1 rounded-full text-sm font-medium">
                  Mais Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold text-[#333333] mb-2">
                  {plan.name}
                </h3>
                <p className="text-[#333333]/60 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  {plan.price === "Personalizado" ? (
                    <span className="text-3xl font-bold text-[#333333]">
                      Personalizado
                    </span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold">R$</span>
                      <span className="text-4xl font-bold text-[#333333]">
                        {plan.price}
                      </span>
                      <span className="text-[#333333]/60">/mês</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <div className="rounded-full p-1 bg-[#00C896]/10">
                      <Check className="h-4 w-4 text-[#00C896]" />
                    </div>
                    <span className="text-[#333333]/80 text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => handleSubscribe(plan)}
                className={`w-full ${
                  plan.highlighted
                    ? "bg-[#0056D2] hover:bg-[#0056D2]/90"
                    : "bg-[#00C896] hover:bg-[#00C896]/90"
                } text-white font-medium py-6`}
                size="lg"
              >
                {plan.price === "Personalizado"
                  ? "Falar com Vendas"
                  : "Começar Agora"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
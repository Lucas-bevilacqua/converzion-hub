import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

const benefits = [
  "7 dias grátis sem compromisso",
  "Setup em 5 minutos",
  "Suporte especializado",
  "Cancele quando quiser",
  "Treinamento incluído",
  "ROI garantido",
];

export const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 relative overflow-hidden bg-gradient-to-br from-[#9b87f5] via-[#7E69AB] to-[#8B5CF6]">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20" />
      <div className="container relative">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-6">
            Comece a{" "}
            <span className="bg-gradient-to-r from-[#E5DEFF] to-white bg-clip-text text-transparent">
              Vender Mais Hoje
            </span>
          </h2>
          <p className="text-white/90 text-lg mb-8 font-medium">
            Junte-se a centenas de empresas que já multiplicaram suas vendas com atendimento automático inteligente
          </p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-12">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <div className="flex-shrink-0 h-5 w-5 rounded-full bg-[#E5DEFF]/20 flex items-center justify-center">
                  <Check className="h-3 w-3 text-[#E5DEFF]" />
                </div>
                <span className="text-white/90 text-sm font-medium">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="bg-[#0EA5E9] hover:bg-[#0EA5E9]/90 text-white text-lg gap-2 h-14 px-8 shadow-lg hover:shadow-xl transition-all duration-300 group font-semibold"
            >
              Começar Agora <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <p className="text-white/70 text-sm">
              Teste grátis por 7 dias, sem cartão de crédito
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
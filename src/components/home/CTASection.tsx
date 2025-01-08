import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

const benefits = [
  "7 dias grátis sem compromisso",
  "Configuração em menos de 5 minutos",
  "Suporte técnico especializado",
  "Cancele quando quiser",
  "Treinamento incluído",
  "Atualizações constantes",
];

export const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-gradient-to-br from-primary-900 to-primary-800 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-white/[0.05] -z-10" />
      <div className="container relative">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-6">
            Transforme Seu Atendimento Hoje
          </h2>
          <p className="text-primary-100 text-lg mb-8">
            Junte-se a centenas de empresas que já multiplicaram suas vendas com atendimento automatizado inteligente
          </p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-12">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <div className="flex-shrink-0 h-5 w-5 rounded-full bg-primary-700/50 flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-300" />
                </div>
                <span className="text-white text-sm">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="bg-white text-primary-900 hover:bg-primary-50 text-lg gap-2 h-14 px-8 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Começar Gratuitamente <ArrowRight className="h-5 w-5" />
            </Button>
            <p className="text-primary-200 text-sm">
              Não é necessário cartão de crédito
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
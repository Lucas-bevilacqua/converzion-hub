import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

const benefits = [
  "7 dias grátis sem compromisso",
  "Configuração em menos de 5 minutos",
  "Suporte técnico especializado",
  "Cancele quando quiser",
];

export const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-primary-900">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-6">
            Comece a automatizar seu WhatsApp hoje
          </h2>
          <p className="text-primary-100 text-lg mb-8">
            Junte-se a centenas de empresas que já transformaram seu atendimento com IA
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-12">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary-300" />
                <span className="text-white">{benefit}</span>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            onClick={() => navigate("/register")}
            className="bg-white text-primary-900 hover:bg-primary-50 text-lg gap-2"
          >
            Começar Gratuitamente <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
};
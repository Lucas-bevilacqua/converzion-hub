import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bot, Shield, Zap } from "lucide-react";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="pt-32 pb-24 px-4 bg-gradient-to-br from-[#1A1F2C] to-[#2A2F3C] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      <div className="container relative">
        <div className="text-center max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-primary-200 text-sm mb-6">
            <Zap className="h-4 w-4" />
            Aumente suas vendas com atendimento inteligente
          </span>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 text-white">
            Transforme Atendimentos em{" "}
            <span className="bg-gradient-to-r from-[#9b87f5] to-[#b8a2ff] bg-clip-text text-transparent">
              Vendas Automáticas
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Liberte sua equipe e multiplique seus resultados com atendimento automático 24/7. 
            Nossa IA avançada entende seus clientes e fecha vendas enquanto você descansa.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="bg-[#9b87f5] hover:bg-[#8b77e5] text-white text-lg gap-2 h-14 px-8 shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              Teste Grátis por 7 Dias{" "}
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/contact")}
              className="text-white border-white/20 hover:bg-white/10 backdrop-blur-sm text-lg h-14 px-8"
            >
              Ver Demonstração
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 rounded-full bg-[#9b87f5]/20 backdrop-blur-sm">
                <Bot className="h-5 w-5 text-[#9b87f5]" />
              </div>
              <span className="text-gray-300">Vendas Automáticas 24/7</span>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 rounded-full bg-[#9b87f5]/20 backdrop-blur-sm">
                <Shield className="h-5 w-5 text-[#9b87f5]" />
              </div>
              <span className="text-gray-300">Resultados Garantidos</span>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 rounded-full bg-[#9b87f5]/20 backdrop-blur-sm">
                <Zap className="h-5 w-5 text-[#9b87f5]" />
              </div>
              <span className="text-gray-300">Setup em 5 Minutos</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
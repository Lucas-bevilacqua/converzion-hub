import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bot, Shield, Zap } from "lucide-react";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="pt-32 pb-24 px-4 bg-gradient-to-b from-[#F5F7FA] to-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      <div className="container relative">
        <div className="text-center max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0056D2]/10 text-[#0056D2] text-sm mb-6 font-medium animate-float">
            <Zap className="h-4 w-4" />
            Aumente suas vendas com atendimento inteligente
          </span>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 text-[#333333] leading-tight">
            Transforme Atendimentos em{" "}
            <span className="bg-gradient-to-r from-[#0056D2] to-[#00C896] bg-clip-text text-transparent">
              Vendas Automáticas
            </span>
          </h1>
          
          <p className="text-xl text-[#333333]/80 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">
            Liberte sua equipe e multiplique seus resultados com atendimento automático 24/7. 
            Nossa IA avançada entende seus clientes e fecha vendas enquanto você descansa.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white text-lg gap-2 h-14 px-8 shadow-lg hover:shadow-xl transition-all duration-300 group font-semibold"
            >
              Teste Grátis por 7 Dias{" "}
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/contact")}
              className="text-[#333333] border-[#333333]/20 hover:bg-[#333333]/5 text-lg h-14 px-8 font-medium"
            >
              Ver Demonstração
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center gap-3 justify-center bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all">
              <div className="p-2 rounded-full bg-[#00C896]/20">
                <Bot className="h-5 w-5 text-[#00C896]" />
              </div>
              <span className="text-[#333333] font-medium">Vendas Automáticas 24/7</span>
            </div>
            <div className="flex items-center gap-3 justify-center bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all">
              <div className="p-2 rounded-full bg-[#00C896]/20">
                <Shield className="h-5 w-5 text-[#00C896]" />
              </div>
              <span className="text-[#333333] font-medium">Resultados Garantidos</span>
            </div>
            <div className="flex items-center gap-3 justify-center bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all">
              <div className="p-2 rounded-full bg-[#00C896]/20">
                <Zap className="h-5 w-5 text-[#00C896]" />
              </div>
              <span className="text-[#333333] font-medium">Setup em 5 Minutos</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
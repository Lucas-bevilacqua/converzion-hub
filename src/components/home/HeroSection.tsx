import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageSquare, Shield, Zap } from "lucide-react";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="pt-32 pb-24 px-4 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      <div className="container relative">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 text-white animate-fade-in">
            Automatize seu WhatsApp e{" "}
            <span className="bg-gradient-to-r from-primary-200 to-primary-100 bg-clip-text text-transparent">
              Multiplique suas Vendas
            </span>
          </h1>
          
          <p className="text-xl text-primary-100 mb-12 max-w-3xl mx-auto leading-relaxed">
            Tenha um assistente virtual inteligente que trabalha 24 horas por dia,
            respondendo seus clientes instantaneamente e aumentando suas conversões.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="bg-white text-primary-900 hover:bg-primary-50 text-lg gap-2 h-14 px-8 shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              Começar Agora{" "}
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/contact")}
              className="text-white border-white/20 hover:bg-white/10 backdrop-blur-sm text-lg h-14 px-8"
            >
              Falar com Especialista
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 rounded-full bg-primary-800/50 backdrop-blur-sm">
                <Zap className="h-5 w-5 text-primary-200" />
              </div>
              <span className="text-primary-100">Respostas Instantâneas</span>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 rounded-full bg-primary-800/50 backdrop-blur-sm">
                <Shield className="h-5 w-5 text-primary-200" />
              </div>
              <span className="text-primary-100">Máxima Segurança</span>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 rounded-full bg-primary-800/50 backdrop-blur-sm">
                <MessageSquare className="h-5 w-5 text-primary-200" />
              </div>
              <span className="text-primary-100">Suporte Especializado</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
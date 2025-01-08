import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageSquare, Shield, Zap } from "lucide-react";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="pt-32 pb-16 px-4 bg-gradient-to-b from-primary-50 to-white">
      <div className="container">
        <div className="text-center max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="px-3 py-1 text-sm font-medium bg-primary-100 text-primary-800 rounded-full">
              Novo
            </span>
            <span className="text-sm text-gray-600">
              Inteligência Artificial GPT-4 integrada
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            Revolucione seu Atendimento no WhatsApp com IA
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Automatize suas conversas no WhatsApp com inteligência artificial avançada. 
            Atenda mais clientes, venda mais e economize tempo com respostas automáticas 24/7.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="bg-primary hover:bg-primary-600 text-lg gap-2"
            >
              Começar Gratuitamente <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/contact")}
              className="text-lg"
            >
              Falar com Especialista
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="flex items-center gap-3 justify-center">
              <Zap className="h-6 w-6 text-primary" />
              <span className="text-gray-600">Resposta em segundos</span>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-gray-600">Dados 100% seguros</span>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <MessageSquare className="h-6 w-6 text-primary" />
              <span className="text-gray-600">Suporte especializado</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
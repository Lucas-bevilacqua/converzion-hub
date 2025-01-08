import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageSquare, Shield, Zap, Check } from "lucide-react";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="pt-32 pb-24 px-4 bg-gradient-to-b from-primary-50/50 to-white relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-black/[0.02] -z-10" />
      <div className="container relative">
        <div className="text-center max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-primary-100 text-primary-800">
              <Zap className="mr-1 h-3 w-3" /> Novo
            </span>
            <span className="text-sm text-gray-600">
              Potencializado por GPT-4
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent animate-fade-in">
            Transforme seu WhatsApp em uma <br className="hidden md:block" />
            Máquina de Vendas Automática
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Atenda centenas de clientes simultaneamente com respostas personalizadas e inteligentes.
            Aumente suas vendas em até 300% enquanto reduz custos operacionais.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="bg-primary hover:bg-primary-600 text-lg gap-2 h-14 px-8 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Teste Grátis por 7 Dias <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/contact")}
              className="text-lg h-14 px-8 hover:bg-gray-50"
            >
              Ver Demonstração
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 rounded-full bg-primary-50">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <span className="text-gray-600">Respostas em 2 segundos</span>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 rounded-full bg-primary-50">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <span className="text-gray-600">Dados criptografados</span>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 rounded-full bg-primary-50">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <span className="text-gray-600">Suporte 24/7</span>
            </div>
          </div>

          <div className="mt-20 pt-10 border-t">
            <p className="text-sm text-gray-500 mb-6">Empresas que já multiplicaram suas vendas com a Converzion</p>
            <div className="flex flex-wrap justify-center gap-8 opacity-70">
              {/* Placeholder logos - replace with actual client logos */}
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
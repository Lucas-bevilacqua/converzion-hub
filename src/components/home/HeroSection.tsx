import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageSquareText, Shield, CheckCircle2 } from "lucide-react";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative pt-32 pb-16 px-4 overflow-hidden bg-gradient-to-b from-primary-50 to-white">
      <div className="container relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full mb-8">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">Tecnologia confiável e segura</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-primary-950 to-primary-700">
            Multiplique suas Vendas com{" "}
            <span className="text-primary">Atendimento Inteligente</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Automatize seu WhatsApp com IA avançada e ofereça atendimento 24/7 para seus clientes. 
            Aumente suas conversões e reduza custos operacionais.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="bg-primary hover:bg-primary-600 text-white px-8 h-12 rounded-full"
            >
              Começar Gratuitamente
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/contact")}
              className="border-primary text-primary hover:bg-primary-50 px-8 h-12 rounded-full"
            >
              Falar com Especialista
              <MessageSquareText className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>14 dias grátis</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>Sem necessidade de cartão</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>Cancelamento flexível</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </div>
    </section>
  );
};
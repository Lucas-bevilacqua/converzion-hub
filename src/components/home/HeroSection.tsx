import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="pt-32 pb-16 px-4">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Transforme seu Atendimento com{" "}
            <span className="text-primary">Inteligência Artificial</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Automatize seu WhatsApp com IA avançada e ofereça atendimento 24/7
            para seus clientes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/register")}
              className="bg-primary hover:bg-primary-600"
            >
              Começar Gratuitamente
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/contact")}
            >
              Falar com Especialista
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
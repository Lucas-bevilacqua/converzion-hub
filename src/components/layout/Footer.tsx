import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const Footer = () => {
  const navigate = useNavigate();
  
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">Converzion</h3>
            <p className="text-sm text-gray-500">
              Transforme seu atendimento com IA
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-4">Produto</h4>
            <ul className="space-y-2">
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/pricing")}
                >
                  Preços
                </Button>
              </li>
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/features")}
                >
                  Funcionalidades
                </Button>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-4">Suporte</h4>
            <ul className="space-y-2">
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/contact")}
                >
                  Contato
                </Button>
              </li>
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/docs")}
                >
                  Documentação
                </Button>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/privacy")}
                >
                  Privacidade
                </Button>
              </li>
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/terms")}
                >
                  Termos
                </Button>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Converzion. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};
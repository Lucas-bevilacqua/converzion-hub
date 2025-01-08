import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const Footer = () => {
  const navigate = useNavigate();
  
  return (
    <footer className="bg-gradient-to-br from-[#9b87f5]/5 to-white border-t border-[#E5DEFF]">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-[#7E69AB] mb-4">Converzion</h3>
            <p className="text-sm text-[#7E69AB]/70">
              Transforme seu atendimento com IA
            </p>
          </div>
          <div>
            <h4 className="font-medium text-[#7E69AB] mb-4">Produto</h4>
            <ul className="space-y-2">
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/pricing")}
                  className="text-[#7E69AB]/70 hover:text-[#9b87f5]"
                >
                  Preços
                </Button>
              </li>
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/features")}
                  className="text-[#7E69AB]/70 hover:text-[#9b87f5]"
                >
                  Funcionalidades
                </Button>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-[#7E69AB] mb-4">Suporte</h4>
            <ul className="space-y-2">
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/contact")}
                  className="text-[#7E69AB]/70 hover:text-[#9b87f5]"
                >
                  Contato
                </Button>
              </li>
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/docs")}
                  className="text-[#7E69AB]/70 hover:text-[#9b87f5]"
                >
                  Documentação
                </Button>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-[#7E69AB] mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/privacy")}
                  className="text-[#7E69AB]/70 hover:text-[#9b87f5]"
                >
                  Privacidade
                </Button>
              </li>
              <li>
                <Button
                  variant="link"
                  onClick={() => navigate("/terms")}
                  className="text-[#7E69AB]/70 hover:text-[#9b87f5]"
                >
                  Termos
                </Button>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t border-[#E5DEFF] text-center text-sm text-[#7E69AB]/70">
          © {new Date().getFullYear()} Converzion. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};
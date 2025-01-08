import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateForm = () => {
    if (!email || !password || !fullName) {
      toast({
        title: "Erro de validação",
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      });
      return false;
    }

    if (password.length < 6) {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      console.log("Starting signup process...");
      await signUp(email, password, fullName);
      console.log("Signup successful");
      toast({
        title: "Conta criada com sucesso!",
        description: "Verifique seu email para confirmar sua conta.",
      });
      navigate("/login");
    } catch (error: any) {
      console.error("Signup error:", error);
      let errorMessage = "Erro ao criar conta";
      
      if (error.message) {
        if (error.message.includes("Invalid API key")) {
          errorMessage = "Erro de configuração do servidor. Por favor, tente novamente mais tarde.";
        } else if (error.message.includes("weak_password")) {
          errorMessage = "A senha deve ter pelo menos 6 caracteres.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Erro ao criar conta",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Criar Conta</CardTitle>
          <CardDescription>
            Registre-se para começar a usar a Converzion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="fullName">Nome Completo</label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password">Senha</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-sm text-muted-foreground">
                A senha deve ter pelo menos 6 caracteres
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando conta..." : "Criar Conta"}
            </Button>
            <div className="text-center">
              <Button
                variant="link"
                onClick={() => navigate("/login")}
                type="button"
              >
                Já tem uma conta? Faça login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
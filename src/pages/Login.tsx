import { useState, useEffect } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LockKeyhole, Mail, Shield, CheckCircle, Building2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (session) {
      console.log("User already logged in, redirecting to dashboard");
      navigate("/dashboard");
    }
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      console.log("Attempting sign in...");
      await signIn(email, password);
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Erro ao fazer login";
      
      try {
        const errorBody = JSON.parse(error.message);
        if (errorBody.code === "invalid_credentials") {
          errorMessage = "Email ou senha inválidos. Por favor, verifique suas credenciais.";
        }
      } catch {
        errorMessage = error.message || "Erro ao fazer login. Por favor, tente novamente.";
      }
      
      setError(errorMessage);
      toast({
        title: "Erro ao fazer login",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-primary-50/50 to-white">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Bem-vindo de volta
          </h1>
          <p className="mt-2 text-gray-600">
            Entre para acessar sua conta e transformar seu atendimento
          </p>
        </div>

        <div className="flex justify-center space-x-6 py-8">
          <div className="text-center">
            <Building2 className="mx-auto h-6 w-6 text-primary mb-2" />
            <p className="text-sm text-gray-600">+500 empresas</p>
          </div>
          <div className="text-center">
            <CheckCircle className="mx-auto h-6 w-6 text-primary mb-2" />
            <p className="text-sm text-gray-600">97% satisfação</p>
          </div>
          <div className="text-center">
            <Shield className="mx-auto h-6 w-6 text-primary mb-2" />
            <p className="text-sm text-gray-600">Dados seguros</p>
          </div>
        </div>
        
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Senha
                </label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-600 text-white py-6" 
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>

              <div className="mt-6 text-center space-y-4">
                <Button
                  variant="link"
                  onClick={() => navigate("/register")}
                  type="button"
                  className="text-sm text-gray-600 hover:text-primary"
                >
                  Ainda não tem uma conta? Registre-se gratuitamente
                </Button>
                
                <p className="text-xs text-gray-500">
                  Ao fazer login você concorda com nossos{" "}
                  <Button variant="link" className="text-xs p-0 h-auto" onClick={() => navigate("/terms")}>
                    Termos de Uso
                  </Button>{" "}
                  e{" "}
                  <Button variant="link" className="text-xs p-0 h-auto" onClick={() => navigate("/privacy")}>
                    Política de Privacidade
                  </Button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center space-y-4">
          <div className="flex items-center justify-center space-x-4">
            <img src="/placeholder.svg" alt="Cliente 1" className="w-8 h-8 rounded-full" />
            <img src="/placeholder.svg" alt="Cliente 2" className="w-8 h-8 rounded-full" />
            <img src="/placeholder.svg" alt="Cliente 3" className="w-8 h-8 rounded-full" />
          </div>
          <p className="text-sm text-gray-600">
            "A Converzion transformou completamente nosso atendimento"
          </p>
          <p className="text-xs text-gray-500">
            João Silva, CEO da TechCorp
          </p>
        </div>
      </div>
    </div>
  );
}
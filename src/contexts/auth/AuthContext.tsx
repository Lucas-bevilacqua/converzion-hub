import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContextType } from "./types";
import { parseAuthError } from "./utils";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("Inicializando estado de autenticação...");
    
    // Função para recuperar e atualizar a sessão
    const getInitialSession = async () => {
      try {
        console.log("Buscando sessão inicial...");
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Erro ao buscar sessão inicial:", error);
          throw error;
        }

        console.log("Sessão inicial:", initialSession ? "Encontrada" : "Não encontrada");
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (error) {
        console.error("Erro ao inicializar sessão:", error);
      } finally {
        setLoading(false);
      }
    };

    // Inicializa a sessão
    getInitialSession();

    // Configura o listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("Mudança no estado de autenticação:", event);
      console.log("Nova sessão:", currentSession ? "Presente" : "Ausente");

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      if (event === 'TOKEN_REFRESHED') {
        console.log("Token atualizado com sucesso");
      }

      if (event === 'SIGNED_OUT') {
        console.log("Usuário desconectado, limpando dados locais");
        localStorage.clear();
        sessionStorage.clear();
      }
    });

    return () => {
      console.log("Limpando subscription de auth");
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log("Tentando fazer login...");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Erro no login:", error);
        const errorMessage = parseAuthError(error);
        throw new Error(errorMessage);
      }

      if (!data?.user) {
        throw new Error("Erro ao fazer login");
      }

      console.log("Login realizado com sucesso");
    } catch (error) {
      console.error("Erro no bloco catch do login:", error);
      if (error instanceof Error) {
        throw error;
      }
      const errorMessage = parseAuthError(error as any);
      throw new Error(errorMessage);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    console.log("Tentando criar conta...");
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        console.error("Erro no cadastro:", error);
        const errorMessage = parseAuthError(error);
        throw new Error(errorMessage);
      }

      if (!data?.user) {
        throw new Error("Erro ao criar conta");
      }

      console.log("Conta criada com sucesso");
    } catch (error) {
      console.error("Erro no bloco catch do cadastro:", error);
      if (error instanceof Error) {
        throw error;
      }
      const errorMessage = parseAuthError(error as any);
      throw new Error(errorMessage);
    }
  };

  const signOut = async () => {
    console.log("Iniciando processo de logout...");
    
    try {
      // Primeiro limpa o estado local
      setSession(null);
      setUser(null);
      
      // Limpa storages locais
      localStorage.clear();
      sessionStorage.clear();
      
      // Tenta fazer logout no Supabase com escopo local
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      
      if (error) {
        console.error("Erro no logout:", error);
        // Não lança erro para erros de validação JWT
        if (!error.message.includes("JWT") && 
            !error.message.includes("User not found") && 
            error.status !== 403) {
          throw error;
        }
        console.log("Erro não crítico no logout:", error.message);
      }
      
      console.log("Logout realizado com sucesso");
    } catch (error) {
      console.error("Erro no bloco catch do logout:", error);
      // Só lança erro para erros críticos
      if (error instanceof Error && 
          !error.message.includes("JWT") && 
          !error.message.includes("User not found") &&
          !error.message.includes("403")) {
        throw new Error("Erro ao fazer logout");
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{ session, user, signIn, signUp, signOut, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
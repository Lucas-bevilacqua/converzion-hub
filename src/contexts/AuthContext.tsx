import { createContext, useContext, useEffect, useState } from "react";
import { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("Initializing auth state...");
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Session retrieved:", session ? "Session found" : "No session");
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed:", _event);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthError = (error: AuthError | Error) => {
    console.error("Auth error:", error);
    
    if ('message' in error) {
      if (error.message.includes("Invalid login credentials")) {
        throw new Error("Email ou senha inválidos");
      }
      if (error.message.includes("Email not confirmed")) {
        throw new Error("Por favor, confirme seu email antes de fazer login");
      }
      if (error.message.includes("User not found")) {
        throw new Error("Usuário não encontrado");
      }
    }
    
    throw new Error("Erro ao autenticar. Por favor, tente novamente.");
  };

  const signIn = async (email: string, password: string) => {
    console.log("Attempting sign in...");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        handleAuthError(error);
      }

      if (!data?.user) {
        throw new Error("Erro ao fazer login");
      }

      console.log("Sign in successful");
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      handleAuthError(error as AuthError);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    console.log("Attempting sign up...");
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
        handleAuthError(error);
      }

      if (!data?.user) {
        throw new Error("Erro ao criar conta");
      }

      console.log("Sign up successful");
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      handleAuthError(error as AuthError);
    }
  };

  const signOut = async () => {
    console.log("Attempting sign out...");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        handleAuthError(error);
      }
      console.log("Sign out successful");
    } catch (error) {
      handleAuthError(error as AuthError);
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
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

  const parseAuthError = (error: AuthError | Error) => {
    console.log("Parsing auth error:", error);
    
    try {
      if ('error' in error && typeof error.error === 'string') {
        const errorBody = JSON.parse(error.error);
        if (errorBody.code === "invalid_credentials") {
          return "Email ou senha inválidos";
        }
      }
      
      if ('message' in error) {
        const message = error.message;
        if (typeof message === 'string') {
          if (message.includes("Invalid login credentials")) {
            return "Email ou senha inválidos";
          }
          if (message.includes("Email not confirmed")) {
            return "Por favor, confirme seu email antes de fazer login";
          }
          if (message.includes("User not found")) {
            return "Usuário não encontrado";
          }
          try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.code === "invalid_credentials") {
              return "Email ou senha inválidos";
            }
          } catch (e) {
            // If message is not JSON, use it as is
          }
        }
      }
    } catch (e) {
      console.error("Error parsing auth error:", e);
    }
    
    return "Erro ao autenticar. Por favor, tente novamente.";
  };

  const signIn = async (email: string, password: string) => {
    console.log("Attempting sign in...");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        const errorMessage = parseAuthError(error);
        throw new Error(errorMessage);
      }

      if (!data?.user) {
        throw new Error("Erro ao fazer login");
      }

      console.log("Sign in successful");
    } catch (error) {
      console.error("Sign in catch block error:", error);
      if (error instanceof Error) {
        throw error;
      }
      const errorMessage = parseAuthError(error as AuthError);
      throw new Error(errorMessage);
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
        console.error("Sign up error:", error);
        const errorMessage = parseAuthError(error);
        throw new Error(errorMessage);
      }

      if (!data?.user) {
        throw new Error("Erro ao criar conta");
      }

      console.log("Sign up successful");
    } catch (error) {
      console.error("Sign up catch block error:", error);
      if (error instanceof Error) {
        throw error;
      }
      const errorMessage = parseAuthError(error as AuthError);
      throw new Error(errorMessage);
    }
  };

  const signOut = async () => {
    console.log("Attempting sign out...");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
        const errorMessage = parseAuthError(error);
        throw new Error(errorMessage);
      }
      console.log("Sign out successful");
    } catch (error) {
      console.error("Sign out catch block error:", error);
      const errorMessage = parseAuthError(error as AuthError);
      throw new Error(errorMessage);
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
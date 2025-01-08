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
      const errorMessage = parseAuthError(error as any);
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
      const errorMessage = parseAuthError(error as any);
      throw new Error(errorMessage);
    }
  };

  const signOut = async () => {
    console.log("Attempting sign out...");
    
    // First clear local state
    setSession(null);
    setUser(null);
    
    try {
      // Attempt to clear Supabase session
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      
      if (error) {
        console.error("Sign out error:", error);
        // Don't throw for non-critical errors
        if (error.message.includes("User not found") || 
            error.status === 403 || 
            error.message.includes("JWT")) {
          console.log("Non-critical sign out error:", error.message);
          return;
        }
        throw error;
      }
      
      console.log("Sign out successful");
    } catch (error) {
      console.error("Sign out catch block error:", error);
      // Only throw for critical errors
      if (error instanceof Error && 
          !error.message.includes("User not found") && 
          !error.message.includes("403") &&
          !error.message.includes("JWT")) {
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
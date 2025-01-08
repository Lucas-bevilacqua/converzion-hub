import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { parseAuthError } from "@/utils/auth/errorHandling";
import { createOrUpdateProfile } from "@/utils/auth/profileManagement";

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
    let mounted = true;

    const handleSession = async (session: Session | null) => {
      if (!mounted) return;

      console.log("Handling session:", session ? "Session exists" : "No session");
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          console.log("Creating/updating profile for user:", session.user.id);
          await createOrUpdateProfile(session.user);
        } catch (error) {
          console.error("Error creating/updating profile:", error);
        }
      }
      
      setLoading(false);
    };

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);
      await handleSession(session);
    });

    return () => {
      console.log("Cleaning up auth subscription");
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log("Attempting sign in for email:", email);
    setLoading(true);
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
        console.error("No user data returned after successful sign in");
        throw new Error("Erro ao fazer login");
      }

      console.log("Sign in successful for user:", data.user.id);
    } catch (error) {
      console.error("Sign in catch block error:", error);
      setLoading(false);
      if (error instanceof Error) {
        throw error;
      }
      const errorMessage = parseAuthError(error as any);
      throw new Error(errorMessage);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    console.log("Attempting sign up for email:", email);
    setLoading(true);
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
        console.error("No user data returned after successful sign up");
        throw new Error("Erro ao criar conta");
      }

      console.log("Sign up successful for user:", data.user.id);
    } catch (error) {
      console.error("Sign up catch block error:", error);
      setLoading(false);
      if (error instanceof Error) {
        throw error;
      }
      const errorMessage = parseAuthError(error as any);
      throw new Error(errorMessage);
    }
  };

  const signOut = async () => {
    console.log("Attempting sign out...");
    setLoading(true);
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
      const errorMessage = parseAuthError(error as any);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
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
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
    let mounted = true;

    async function initializeAuth() {
      try {
        console.log("Initializing auth state...");
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (initialSession?.user) {
          console.log("Initial session found for user:", initialSession.user.id);
          setSession(initialSession);
          setUser(initialSession.user);
          try {
            await createOrUpdateProfile(initialSession.user);
          } catch (error) {
            console.error("Error in profile creation:", error);
          }
        } else {
          console.log("No initial session found");
          setSession(null);
          setUser(null);
        }
      } catch (error) {
        console.error("Error in initial auth check:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log("Auth state changed:", event);
        
        if (!mounted) return;

        try {
          if (currentSession?.user) {
            console.log("Session update for user:", currentSession.user.id);
            setSession(currentSession);
            setUser(currentSession.user);
            await createOrUpdateProfile(currentSession.user);
          } else {
            console.log("No session in auth state change");
            setSession(null);
            setUser(null);
          }
        } catch (error) {
          console.error("Error in auth state change:", error);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (error) {
      const errorMessage = parseAuthError(error as any);
      throw new Error(errorMessage);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      const errorMessage = parseAuthError(error as any);
      throw new Error(errorMessage);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      const errorMessage = parseAuthError(error as any);
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
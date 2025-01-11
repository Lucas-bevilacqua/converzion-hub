import { useState } from "react"
import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa } from "@supabase/auth-ui-shared"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Login() {
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)

  // Listen for auth state changes to handle errors
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session)
    
    if (event === 'SIGNED_IN') {
      console.log('User signed in successfully')
      setError(null)
    }
  })

  // Custom error handler for auth errors
  const handleAuthError = (error: any) => {
    console.error('Auth error:', error)
    let message = 'An error occurred during authentication'
    
    if (error.error?.message === 'Invalid login credentials') {
      message = 'Invalid email or password. Please check your credentials and try again.'
    } else if (error.message) {
      message = error.message
    }
    
    setError(message)
    toast({
      title: "Authentication Error",
      description: message,
      variant: "destructive",
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 rounded-md">
              {error}
            </div>
          )}
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'rgb(var(--primary))',
                    brandAccent: 'rgb(var(--primary))',
                  },
                },
              },
            }}
            providers={[]}
            onError={handleAuthError}
          />
        </CardContent>
      </Card>
    </div>
  )
}
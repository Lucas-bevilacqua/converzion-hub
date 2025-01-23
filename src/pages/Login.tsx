import { useState, useEffect } from "react"
import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa } from "@supabase/auth-ui-shared"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useNavigate } from "react-router-dom"

export default function Login() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Verificar sessão existente ao montar
    const checkSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('Erro ao verificar sessão:', sessionError)
        setError(sessionError.message)
        return
      }

      if (session) {
        console.log('Sessão ativa encontrada, redirecionando para dashboard')
        navigate('/dashboard')
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Estado de autenticação alterado:', event, session)
      
      if (event === 'SIGNED_IN') {
        console.log('Usuário logado com sucesso')
        setError(null)
        navigate('/dashboard')
      }
      
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token atualizado com sucesso')
        setError(null)
      }

      if (event === 'SIGNED_OUT') {
        console.log('Usuário desconectado')
        setError(null)
        // Limpar dados de autenticação armazenados
        localStorage.removeItem('supabase.auth.token')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Bem-vindo de volta</CardTitle>
          <CardDescription>
            Entre na sua conta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'rgb(16, 185, 129)',
                    brandAccent: 'rgb(5, 150, 105)',
                    brandButtonText: 'white',
                    defaultButtonBackground: 'white',
                    defaultButtonBackgroundHover: 'rgb(243, 244, 246)',
                    defaultButtonBorder: 'rgb(209, 213, 219)',
                    defaultButtonText: 'rgb(17, 24, 39)',
                    dividerBackground: 'rgb(229, 231, 235)',
                    inputBackground: 'white',
                    inputBorder: 'rgb(209, 213, 219)',
                    inputBorderHover: 'rgb(16, 185, 129)',
                    inputBorderFocus: 'rgb(16, 185, 129)',
                    inputText: 'rgb(17, 24, 39)',
                    inputLabelText: 'rgb(107, 114, 128)',
                    inputPlaceholder: 'rgb(107, 114, 128)',
                  },
                },
              },
              className: {
                button: 'rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
                container: 'space-y-4',
                label: 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                input: 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              },
            }}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email',
                  password_label: 'Senha',
                  email_input_placeholder: 'Seu email',
                  password_input_placeholder: 'Sua senha',
                  button_label: 'Entrar',
                  loading_button_label: 'Entrando...',
                  social_provider_text: 'Entrar com {{provider}}',
                  link_text: 'Já tem uma conta? Entre',
                },
                sign_up: {
                  email_label: 'Email',
                  password_label: 'Senha',
                  email_input_placeholder: 'Seu email',
                  password_input_placeholder: 'Sua senha',
                  button_label: 'Criar conta',
                  loading_button_label: 'Criando conta...',
                  social_provider_text: 'Criar conta com {{provider}}',
                  link_text: 'Não tem uma conta? Cadastre-se',
                },
                forgotten_password: {
                  email_label: 'Email',
                  password_label: 'Senha',
                  email_input_placeholder: 'Seu email',
                  button_label: 'Recuperar senha',
                  loading_button_label: 'Enviando instruções...',
                  link_text: 'Esqueceu sua senha?',
                },
              },
            }}
            providers={[]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
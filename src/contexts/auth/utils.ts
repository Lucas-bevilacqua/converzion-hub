import { AuthError } from "@supabase/supabase-js";

export const parseAuthError = (error: AuthError | Error) => {
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
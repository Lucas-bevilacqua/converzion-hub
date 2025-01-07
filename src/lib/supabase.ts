import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vodexhppkasbulogmcqb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZGV4aHBwa2FzYnVsb2dtY3FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4NTc2MDAsImV4cCI6MjAyNTQzMzYwMH0.vXZyXKZzV5QrGZFB5TPglwMbNWjfcZu7Vz9z4kzUWQY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "pkce"
  }
});

// Add console logs to help with debugging
console.log("Supabase client initialized with URL:", supabaseUrl);
export type AISettings = {
  id: string;
  user_id: string | null;
  system_prompt: string | null;
  temperature: number | null;
  created_at: string;
  updated_at: string;
}
export type EvolutionInstance = {
  id: string;
  user_id: string | null;
  name: string;
  status: string | null;
  connection_status: string | null;
  phone_number: string | null;
  qr_code: string | null;
  system_prompt: string | null;
  last_qr_update: string | null;
  created_at: string;
  updated_at: string;
}
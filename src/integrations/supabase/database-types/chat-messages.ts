export interface ChatMessage {
  id: string
  instance_id: string
  user_id: string
  sender_type: 'user' | 'assistant' | 'follow_up'
  content: string
  created_at: string
  updated_at: string
  whatsapp_message_id?: string | null
}
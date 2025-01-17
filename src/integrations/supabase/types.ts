export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_settings: {
        Row: {
          created_at: string
          id: string
          system_prompt: string | null
          temperature: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          instance_id: string
          sender_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          instance_id: string
          sender_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          instance_id?: string
          sender_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_instances: {
        Row: {
          connection_status: string | null
          created_at: string
          id: string
          last_qr_update: string | null
          name: string
          phone_number: string | null
          qr_code: string | null
          status: string | null
          system_prompt: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          connection_status?: string | null
          created_at?: string
          id?: string
          last_qr_update?: string | null
          name: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          system_prompt?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          connection_status?: string | null
          created_at?: string
          id?: string
          last_qr_update?: string | null
          name?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          system_prompt?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolution_instances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_configurations: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string
          objective: Database["public"]["Enums"]["instance_objective"] | null
          settings: Json | null
          tools_config: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_id: string
          objective?: Database["public"]["Enums"]["instance_objective"] | null
          settings?: Json | null
          tools_config?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string
          objective?: Database["public"]["Enums"]["instance_objective"] | null
          settings?: Json | null
          tools_config?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instance_configurations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_follow_ups: {
        Row: {
          created_at: string
          delay_minutes: number | null
          follow_up_type: Database["public"]["Enums"]["follow_up_type"] | null
          id: string
          instance_id: string
          is_active: boolean | null
          schedule_days: number[] | null
          schedule_end_time: string | null
          schedule_start_time: string | null
          settings: Json | null
          template_message: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delay_minutes?: number | null
          follow_up_type?: Database["public"]["Enums"]["follow_up_type"] | null
          id?: string
          instance_id: string
          is_active?: boolean | null
          schedule_days?: number[] | null
          schedule_end_time?: string | null
          schedule_start_time?: string | null
          settings?: Json | null
          template_message?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delay_minutes?: number | null
          follow_up_type?: Database["public"]["Enums"]["follow_up_type"] | null
          id?: string
          instance_id?: string
          is_active?: boolean | null
          schedule_days?: number[] | null
          schedule_end_time?: string | null
          schedule_start_time?: string | null
          settings?: Json | null
          template_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_follow_ups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_metrics: {
        Row: {
          connection_time_minutes: number | null
          created_at: string | null
          id: string
          instance_id: string
          messages_sent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connection_time_minutes?: number | null
          created_at?: string | null
          id?: string
          instance_id: string
          messages_sent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connection_time_minutes?: number | null
          created_at?: string | null
          id?: string
          instance_id?: string
          messages_sent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_metrics_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_tools: {
        Row: {
          api_credentials: Json | null
          created_at: string
          id: string
          instance_id: string
          is_active: boolean | null
          settings: Json | null
          setup_guide: Json | null
          tool_type: Database["public"]["Enums"]["tool_type"]
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          api_credentials?: Json | null
          created_at?: string
          id?: string
          instance_id: string
          is_active?: boolean | null
          settings?: Json | null
          setup_guide?: Json | null
          tool_type: Database["public"]["Enums"]["tool_type"]
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_credentials?: Json | null
          created_at?: string
          id?: string
          instance_id?: string
          is_active?: boolean | null
          settings?: Json | null
          setup_guide?: Json | null
          tool_type?: Database["public"]["Enums"]["tool_type"]
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instance_tools_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_webhooks: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          is_active: boolean | null
          updated_at: string
          webhook_type: Database["public"]["Enums"]["webhook_type"]
          webhook_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          is_active?: boolean | null
          updated_at?: string
          webhook_type?: Database["public"]["Enums"]["webhook_type"]
          webhook_url: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          is_active?: boolean | null
          updated_at?: string
          webhook_type?: Database["public"]["Enums"]["webhook_type"]
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_webhooks_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_admin: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      Users_clientes: {
        Row: {
          ConversationId: string | null
          created_at: string
          id: number
          NomeClientes: string | null
          NomeDaEmpresa: string | null
          TelefoneClientes: string | null
        }
        Insert: {
          ConversationId?: string | null
          created_at?: string
          id?: number
          NomeClientes?: string | null
          NomeDaEmpresa?: string | null
          TelefoneClientes?: string | null
        }
        Update: {
          ConversationId?: string | null
          created_at?: string
          id?: number
          NomeClientes?: string | null
          NomeDaEmpresa?: string | null
          TelefoneClientes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Users_clientes_NomeDaEmpresa_fkey"
            columns: ["NomeDaEmpresa"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      follow_up_type: "automatic" | "ai_generated" | "template"
      instance_objective:
        | "sales"
        | "support"
        | "scheduling"
        | "education"
        | "custom"
      subscription_status: "active" | "canceled" | "past_due" | "trial"
      tool_type: "calendar" | "crm" | "payment" | "custom" | "n8n"
      webhook_type: "n8n" | "zapier" | "make"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

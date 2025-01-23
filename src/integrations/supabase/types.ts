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
      ai_follow_up_job_logs: {
        Row: {
          details: Json | null
          execution_time: string | null
          id: number
          status: string | null
        }
        Insert: {
          details?: Json | null
          execution_time?: string | null
          id?: number
          status?: string | null
        }
        Update: {
          details?: Json | null
          execution_time?: string | null
          id?: number
          status?: string | null
        }
        Relationships: []
      }
      ai_follow_up_logs: {
        Row: {
          details: Json | null
          execution_time: string | null
          id: number
          status: string | null
        }
        Insert: {
          details?: Json | null
          execution_time?: string | null
          id?: number
          status?: string | null
        }
        Update: {
          details?: Json | null
          execution_time?: string | null
          id?: number
          status?: string | null
        }
        Relationships: []
      }
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
          whatsapp_message_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          instance_id: string
          sender_type: string
          updated_at?: string
          user_id: string
          whatsapp_message_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          instance_id?: string
          sender_type?: string
          updated_at?: string
          user_id?: string
          whatsapp_message_id?: string | null
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
      cron_execution_logs: {
        Row: {
          execution_time: string | null
          id: number
          job_name: string | null
          response: Json | null
          status: string | null
        }
        Insert: {
          execution_time?: string | null
          id?: number
          job_name?: string | null
          response?: Json | null
          status?: string | null
        }
        Update: {
          execution_time?: string | null
          id?: number
          job_name?: string | null
          response?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      cron_job_logs: {
        Row: {
          created_at: string | null
          details: string | null
          id: number
          job_name: string
          status: string
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: number
          job_name: string
          status: string
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: number
          job_name?: string
          status?: string
        }
        Relationships: []
      }
      cron_logs: {
        Row: {
          details: string | null
          details_json: Json | null
          execution_time: string | null
          id: number
          job_name: string | null
          status: string | null
        }
        Insert: {
          details?: string | null
          details_json?: Json | null
          execution_time?: string | null
          id?: number
          job_name?: string | null
          status?: string | null
        }
        Update: {
          details?: string | null
          details_json?: Json | null
          execution_time?: string | null
          id?: number
          job_name?: string | null
          status?: string | null
        }
        Relationships: []
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
      follow_up_executions: {
        Row: {
          details: Json | null
          execution_time: string | null
          id: string
          next_run_time: string | null
          next_scheduled_run: string | null
          status: string | null
        }
        Insert: {
          details?: Json | null
          execution_time?: string | null
          id?: string
          next_run_time?: string | null
          next_scheduled_run?: string | null
          status?: string | null
        }
        Update: {
          details?: Json | null
          execution_time?: string | null
          id?: string
          next_run_time?: string | null
          next_scheduled_run?: string | null
          status?: string | null
        }
        Relationships: []
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
          execution_count: number | null
          follow_up_type: Database["public"]["Enums"]["follow_up_type"] | null
          id: string
          instance_id: string
          is_active: boolean | null
          last_execution_time: string | null
          manual_messages: Json | null
          max_attempts: number | null
          next_execution_time: string | null
          settings: Json | null
          stop_on_keyword: string[] | null
          stop_on_reply: boolean | null
          system_prompt: string | null
          template_message: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delay_minutes?: number | null
          execution_count?: number | null
          follow_up_type?: Database["public"]["Enums"]["follow_up_type"] | null
          id?: string
          instance_id: string
          is_active?: boolean | null
          last_execution_time?: string | null
          manual_messages?: Json | null
          max_attempts?: number | null
          next_execution_time?: string | null
          settings?: Json | null
          stop_on_keyword?: string[] | null
          stop_on_reply?: boolean | null
          system_prompt?: string | null
          template_message?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delay_minutes?: number | null
          execution_count?: number | null
          follow_up_type?: Database["public"]["Enums"]["follow_up_type"] | null
          id?: string
          instance_id?: string
          is_active?: boolean | null
          last_execution_time?: string | null
          manual_messages?: Json | null
          max_attempts?: number | null
          next_execution_time?: string | null
          settings?: Json | null
          stop_on_keyword?: string[] | null
          stop_on_reply?: boolean | null
          system_prompt?: string | null
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
          average_response_time_seconds: number | null
          common_questions: Json | null
          connection_time_minutes: number | null
          created_at: string | null
          id: string
          instance_id: string
          messages_received: number | null
          messages_sent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          average_response_time_seconds?: number | null
          common_questions?: Json | null
          connection_time_minutes?: number | null
          created_at?: string | null
          id?: string
          instance_id: string
          messages_received?: number | null
          messages_sent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          average_response_time_seconds?: number | null
          common_questions?: Json | null
          connection_time_minutes?: number | null
          created_at?: string | null
          id?: string
          instance_id?: string
          messages_received?: number | null
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
          langchain_config: Json | null
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
          langchain_config?: Json | null
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
          langchain_config?: Json | null
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
      secure_configurations: {
        Row: {
          config_key: string
          config_value: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string | null
          updated_at?: string | null
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
      users_clientes: {
        Row: {
          conversationid: string | null
          created_at: string
          id: number
          last_message_time: string | null
          nomeclientes: string | null
          nomedaempresa: string | null
          telefoneclientes: string | null
        }
        Insert: {
          conversationid?: string | null
          created_at?: string
          id?: never
          last_message_time?: string | null
          nomeclientes?: string | null
          nomedaempresa?: string | null
          telefoneclientes?: string | null
        }
        Update: {
          conversationid?: string | null
          created_at?: string
          id?: never
          last_message_time?: string | null
          nomeclientes?: string | null
          nomedaempresa?: string | null
          telefoneclientes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_clientes_nomedaempresa_fkey"
            columns: ["nomedaempresa"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      Users_clientes: {
        Row: {
          ConversationId: string | null
          created_at: string
          id: number
          last_message_time: string | null
          NomeClientes: string | null
          NomeDaEmpresa: string | null
          TelefoneClientes: string | null
        }
        Insert: {
          ConversationId?: string | null
          created_at?: string
          id?: number
          last_message_time?: string | null
          NomeClientes?: string | null
          NomeDaEmpresa?: string | null
          TelefoneClientes?: string | null
        }
        Update: {
          ConversationId?: string | null
          created_at?: string
          id?: number
          last_message_time?: string | null
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
      bytea_to_text: {
        Args: {
          data: string
        }
        Returns: string
      }
      check_follow_up_job_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          job_name: string
          last_run: string
          status: string
          details: string
        }[]
      }
      comprehensive_endpoint_test: {
        Args: Record<PropertyKey, never>
        Returns: {
          test_stage: string
          diagnostic_info: string
        }[]
      }
      diagnose_follow_up_system: {
        Args: Record<PropertyKey, never>
        Returns: {
          check_name: string
          status: string
          details: Json
        }[]
      }
      diagnose_service_key: {
        Args: Record<PropertyKey, never>
        Returns: {
          check_name: string
          check_result: string
        }[]
      }
      direct_endpoint_test: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      execute_ai_follow_up: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      execute_follow_up_contacts_real: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      execute_follow_up_cron: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      execute_follow_up_job: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_persistent_service_key: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_service_key: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      http: {
        Args: {
          request: Database["public"]["CompositeTypes"]["http_request"]
        }
        Returns: unknown
      }
      http_delete:
        | {
            Args: {
              uri: string
            }
            Returns: unknown
          }
        | {
            Args: {
              uri: string
              content: string
              content_type: string
            }
            Returns: unknown
          }
      http_get:
        | {
            Args: {
              uri: string
            }
            Returns: unknown
          }
        | {
            Args: {
              uri: string
              data: Json
            }
            Returns: unknown
          }
      http_head: {
        Args: {
          uri: string
        }
        Returns: unknown
      }
      http_header: {
        Args: {
          field: string
          value: string
        }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: {
          uri: string
          content: string
          content_type: string
        }
        Returns: unknown
      }
      http_post:
        | {
            Args: {
              uri: string
              content: string
              content_type: string
            }
            Returns: unknown
          }
        | {
            Args: {
              uri: string
              data: Json
            }
            Returns: unknown
          }
      http_put: {
        Args: {
          uri: string
          content: string
          content_type: string
        }
        Returns: unknown
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: {
          curlopt: string
          value: string
        }
        Returns: boolean
      }
      invoke_follow_up: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      log_comprehensive_test: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      log_endpoint_test_result: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      log_follow_up_job_execution: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      process_ai_follow_up: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      process_follow_up_contacts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      process_follow_up_job: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      process_follow_up_test: {
        Args: Record<PropertyKey, never>
        Returns: {
          test_name: string
          result: string
          details: Json
        }[]
      }
      schedule_follow_up_contacts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      set_persistent_service_key: {
        Args: {
          p_service_key: string
        }
        Returns: boolean
      }
      set_service_key: {
        Args: {
          service_key: string
        }
        Returns: undefined
      }
      set_supabase_service_key: {
        Args: {
          service_key: string
        }
        Returns: undefined
      }
      setup_follow_up_contacts_job: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      setup_follow_up_cron: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      simulate_http_request: {
        Args: {
          p_url: string
          p_method?: string
          p_headers?: Json
          p_body?: Json
        }
        Returns: {
          status_code: number
          response_body: string
          error_message: string
        }[]
      }
      test_follow_up_endpoint: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      test_follow_up_endpoint_fallback: {
        Args: Record<PropertyKey, never>
        Returns: {
          test_description: string
          http_status_code: number
          response_text: string
          error_text: string
        }[]
      }
      test_follow_up_service_key: {
        Args: Record<PropertyKey, never>
        Returns: {
          check_name: string
          status: string
          details: Json
        }[]
      }
      test_follow_up_system: {
        Args: Record<PropertyKey, never>
        Returns: {
          check_name: string
          status: string
          details: Json
        }[]
      }
      test_service_key_config: {
        Args: Record<PropertyKey, never>
        Returns: {
          config_name: string
          key_exists: boolean
          key_value: string
        }[]
      }
      test_service_key_configuration: {
        Args: Record<PropertyKey, never>
        Returns: {
          config_status: string
          key_exists: boolean
          key_value: string
        }[]
      }
      text_to_bytea: {
        Args: {
          data: string
        }
        Returns: string
      }
      urlencode:
        | {
            Args: {
              data: Json
            }
            Returns: string
          }
        | {
            Args: {
              string: string
            }
            Returns: string
          }
        | {
            Args: {
              string: string
            }
            Returns: string
          }
      validate_url: {
        Args: {
          url: string
        }
        Returns: boolean
      }
      verify_cron_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          jobname: string
          schedule: string
          last_run: string
          next_run: string
          active: boolean
          last_success: string
        }[]
      }
    }
    Enums: {
      follow_up_type: "automatic" | "ai_generated" | "manual"
      instance_objective:
        | "sales"
        | "support"
        | "scheduling"
        | "education"
        | "custom"
      subscription_status: "active" | "canceled" | "past_due" | "trial"
      tool_type: "calendar" | "crm" | "payment" | "custom" | "n8n" | "langchain"
      webhook_type: "n8n" | "zapier" | "make"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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

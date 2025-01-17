export type ToolType = 'calendar' | 'crm' | 'payment' | 'custom' | 'n8n' | 'langchain';

export interface InstanceTool {
  id: string;
  instance_id: string;
  tool_type: ToolType;
  is_active: boolean;
  settings: {
    webhook_url?: string;
    api_credentials?: Record<string, any>;
    langchain_config?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    };
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
  webhook_url?: string;
  webhook_secret?: string;
}
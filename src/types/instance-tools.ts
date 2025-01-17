export type ToolType = 'calendar' | 'crm' | 'payment' | 'custom' | 'n8n' | 'langchain';

export interface InstanceTool {
  id: string;
  instance_id: string;
  tool_type: ToolType;
  is_active?: boolean;
  settings?: Record<string, any>;
  created_at: string;
  updated_at: string;
  setup_guide?: {
    steps: string[];
    documentation_url?: string;
  };
  api_credentials?: Record<string, any>;
  webhook_url?: string;
  webhook_secret?: string;
  langchain_config?: Record<string, any>;
}
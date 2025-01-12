export type ToolType = 'calendar' | 'crm' | 'payment' | 'custom';

export interface InstanceTool {
  id: string;
  instance_id: string;
  tool_type: ToolType;
  is_active: boolean;
  settings: {
    webhook_url?: string;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}
export type InstanceTool = {
  id: string;
  instance_id: string;
  tool_type: 'calendar' | 'crm' | 'payment' | 'custom';
  is_active: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}
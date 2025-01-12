export type InstanceConfiguration = {
  id: string;
  instance_id: string;
  objective: 'sales' | 'support' | 'scheduling' | 'education' | 'custom';
  settings: Record<string, any>;
  tools_config: Record<string, any>;
  created_at: string;
  updated_at: string;
}
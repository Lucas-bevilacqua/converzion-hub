export enum ToolType {
  CALENDAR = 'calendar',
  CRM = 'crm',
  LANGCHAIN = 'langchain',
  WEBHOOK = 'webhook'
}

export interface InstanceTool {
  id: string;
  instance_id: string;
  tool_type: ToolType;
  is_active: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  setup_guide?: {
    steps: string[];
    documentation_url: string | null;
  };
  api_credentials?: Record<string, string>;
  webhook_url?: string;
  webhook_secret?: string;
  langchain_config?: Record<string, any>;
}

export const TOOL_CONFIGS = {
  [ToolType.CALENDAR]: {
    icon: 'Calendar',
    label: 'Calendário',
    description: 'Integração com Google Calendar para agendamentos'
  },
  [ToolType.CRM]: {
    icon: 'Users',
    label: 'CRM',
    description: 'Integração com sistemas de CRM'
  },
  [ToolType.LANGCHAIN]: {
    icon: 'Brain',
    label: 'LangChain',
    description: 'Integração com LangChain para processamento de linguagem natural'
  },
  [ToolType.WEBHOOK]: {
    icon: 'Webhook',
    label: 'Webhook',
    description: 'Integração via webhooks personalizados'
  }
} as const;
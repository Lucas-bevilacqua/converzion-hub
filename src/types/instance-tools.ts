export enum ToolType {
  CALENDAR = 'calendar',
  CRM = 'crm',
  PAYMENT = 'payment',
  CUSTOM = 'custom',
  N8N = 'n8n',
  LANGCHAIN = 'langchain'
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
  [ToolType.N8N]: {
    icon: 'Webhook',
    label: 'n8n',
    description: 'Integração com n8n para automações'
  },
  [ToolType.PAYMENT]: {
    icon: 'CreditCard',
    label: 'Pagamento',
    description: 'Integração com sistemas de pagamento'
  },
  [ToolType.CUSTOM]: {
    icon: 'Settings',
    label: 'Personalizado',
    description: 'Integração personalizada'
  }
} as const;
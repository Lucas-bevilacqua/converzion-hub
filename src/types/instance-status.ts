export type InstanceConnectionStatus = 'connected' | 'disconnected' | 'pending';

export interface InstanceState {
  state: string;
  connected: boolean;
  instance?: {
    instance?: {
      state?: string;
    };
  };
  updateResult?: any;
  timestamp: string;
}

export interface InstanceStatusProps {
  instance: {
    connection_status?: string;
    status?: string;
  };
  stateData?: InstanceState | null;
  isLoading: boolean;
}
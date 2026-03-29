import 'dotenv/config';

export interface EdiPartnerConfig {
  id: string;
  name: string;
  customerId: string;
  sftpHost: string;
  sftpPort: number;
  sftpUsername: string;
  sftpPassword?: string;
  sftpPrivateKey?: string;
  sftpRemoteDir: string;
  sftpFilePattern: string;
  pollingEnabled: boolean;
  pollingInterval: number; // seconds
  pollingCron?: string;
  autoCreateOrders: boolean;
  autoAssignShipments: boolean;
}

export interface AppConfig {
  backendUrl: string;
  apiKey: string;
  pollConfigInterval: number; // seconds — how often to refresh partner list
  logLevel: string;
}

export function loadAppConfig(): AppConfig {
  const backendUrl = process.env.BACKEND_URL;
  const apiKey = process.env.API_KEY;

  if (!backendUrl) throw new Error('BACKEND_URL environment variable is required');
  if (!apiKey) throw new Error('API_KEY environment variable is required');

  return {
    backendUrl: backendUrl.replace(/\/$/, ''),
    apiKey,
    pollConfigInterval: parseInt(process.env.POLL_CONFIG_INTERVAL || '300', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

export async function fetchPartnerConfigs(config: AppConfig): Promise<EdiPartnerConfig[]> {
  const url = `${config.backendUrl}/api/v1/edi-partners?active=true&pollingEnabled=true`;

  const response = await fetch(url, {
    headers: {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch partner configs: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as { data?: EdiPartnerConfig[] };
  return result.data || [];
}

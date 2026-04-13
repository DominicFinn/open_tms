import 'dotenv/config';

export interface TradingPartnerConfig {
  id: string;
  name: string;
  entityType: string;
  customerId?: string;
  carrierId?: string;
  sftpHost: string;
  sftpPort: number;
  sftpUsername: string;
  sftpPassword?: string;
  sftpPrivateKey?: string;
  inboundDir: string;
  inboundFilePattern: string;
  pollingInterval: number;
  pollingCron?: string;
  senderId?: string;
  receiverId?: string;
  transactions: Array<{
    transactionType: string;
    direction: string;
    enabled: boolean;
    autoProcess: boolean;
    filePattern?: string;
  }>;
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

// Fetch TradingPartner configs from backend
export async function fetchTradingPartnerConfigs(config: AppConfig): Promise<TradingPartnerConfig[]> {
  const url = `${config.backendUrl}/api/v1/trading-partners?active=true`;

  const response = await fetch(url, {
    headers: {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    // Fall back to legacy endpoint if trading-partners endpoint doesn't exist yet
    return [];
  }

  const result = await response.json() as { data?: TradingPartnerConfig[] };
  // Only return partners with inbound enabled and SFTP configured
  return (result.data || []).filter(
    p => p.sftpHost && p.inboundDir
  );
}

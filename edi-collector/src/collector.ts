import SftpClient from 'ssh2-sftp-client';
import { AppConfig, EdiPartnerConfig, TradingPartnerConfig } from './config.js';
import { log } from './logger.js';

// Track files we've already processed per partner to avoid re-uploading
const seenFiles = new Map<string, Set<string>>();

function getSeenSet(partnerId: string): Set<string> {
  if (!seenFiles.has(partnerId)) {
    seenFiles.set(partnerId, new Set());
  }
  return seenFiles.get(partnerId)!;
}

function matchesPattern(fileName: string, pattern: string): boolean {
  const patterns = pattern.split(',').map(p => p.trim().toLowerCase());
  const lowerName = fileName.toLowerCase();
  return patterns.some(p => {
    // Convert glob to simple check: *.edi → ends with .edi
    if (p.startsWith('*.')) {
      return lowerName.endsWith(p.slice(1));
    }
    // Exact match
    return lowerName === p;
  });
}

/**
 * Universal inbound endpoint — handles ALL transaction types.
 * The backend detects the type, validates partner support, routes,
 * logs to EdiTransactionLog, and auto-generates 997 acks.
 */
const UNIVERSAL_INBOUND_ENDPOINT = '/api/v1/edi/inbound';

// ══════════════════════════════════════════════════════════════
// Legacy collector: works with old EdiPartner model
// ══════════════════════════════════════════════════════════════

export async function collectFromPartner(
  partner: EdiPartnerConfig,
  appConfig: AppConfig
): Promise<{ filesProcessed: number; errors: string[] }> {
  const sftp = new SftpClient();
  const seen = getSeenSet(partner.id);
  let filesProcessed = 0;
  const errors: string[] = [];

  try {
    log.info(`[${partner.name}] Connecting to ${partner.sftpHost}:${partner.sftpPort}...`);

    const connectConfig: SftpClient.ConnectOptions = {
      host: partner.sftpHost,
      port: partner.sftpPort,
      username: partner.sftpUsername,
      readyTimeout: 15000,
      retries: 2,
      retry_minTimeout: 2000,
    };

    if (partner.sftpPrivateKey) {
      connectConfig.privateKey = partner.sftpPrivateKey;
    } else if (partner.sftpPassword) {
      connectConfig.password = partner.sftpPassword;
    }

    await sftp.connect(connectConfig);
    log.info(`[${partner.name}] Connected. Listing ${partner.sftpRemoteDir}`);

    const listing = await sftp.list(partner.sftpRemoteDir);

    const matchingFiles = listing.filter(
      item => item.type === '-' && matchesPattern(item.name, partner.sftpFilePattern)
    );

    log.info(`[${partner.name}] Found ${matchingFiles.length} matching files, ${seen.size} already seen`);

    for (const file of matchingFiles) {
      const fileKey = `${file.name}:${file.size}:${file.modifyTime}`;

      if (seen.has(fileKey)) {
        continue;
      }

      try {
        const remotePath = `${partner.sftpRemoteDir.replace(/\/$/, '')}/${file.name}`;
        log.info(`[${partner.name}] Downloading ${file.name} (${file.size} bytes)`);

        const content = await sftp.get(remotePath);
        const ediContent = typeof content === 'string' ? content : content.toString('utf-8');

        // POST to backend
        const response = await fetch(`${appConfig.backendUrl}/api/v1/orders/import/edi`, {
          method: 'POST',
          headers: {
            'x-api-key': appConfig.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ediContent,
            partnerId: partner.id,
            customerId: partner.customerId,
            fileName: file.name,
            source: 'sftp',
            autoAssign: partner.autoAssignShipments,
          }),
        });

        const result = await response.json() as {
          data?: { ordersCreated?: number; fileId?: string };
          error?: string;
        };

        if (!response.ok) {
          // 409 = duplicate file, still mark as seen
          if (response.status === 409) {
            log.info(`[${partner.name}] ${file.name} already imported (duplicate)`);
            seen.add(fileKey);
            continue;
          }
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        seen.add(fileKey);
        filesProcessed++;
        log.info(
          `[${partner.name}] ${file.name} imported — ${result.data?.ordersCreated || 0} orders created (file: ${result.data?.fileId})`
        );
      } catch (err: any) {
        const msg = `Failed to process ${file.name}: ${err.message}`;
        log.error(`[${partner.name}] ${msg}`);
        errors.push(msg);
      }
    }
  } catch (err: any) {
    const msg = `SFTP connection failed: ${err.message}`;
    log.error(`[${partner.name}] ${msg}`);
    errors.push(msg);
  } finally {
    try {
      await sftp.end();
    } catch {
      // ignore close errors
    }
  }

  return { filesProcessed, errors };
}

// ══════════════════════════════════════════════════════════════
// New collector: works with TradingPartner model + transaction routing
// ══════════════════════════════════════════════════════════════

export async function collectFromTradingPartner(
  partner: TradingPartnerConfig,
  appConfig: AppConfig
): Promise<{ filesProcessed: number; errors: string[] }> {
  const sftp = new SftpClient();
  const seen = getSeenSet(partner.id);
  const failedFiles = new Set<string>(); // Track failed files separately for retry
  let filesProcessed = 0;
  const errors: string[] = [];

  // Check partner has any inbound types configured
  const inboundTypes = partner.transactions
    .filter(t => t.direction === 'inbound' && t.enabled)
    .map(t => t.transactionType);

  if (inboundTypes.length === 0) {
    log.info(`[${partner.name}] No inbound transaction types configured, skipping`);
    return { filesProcessed, errors };
  }

  try {
    log.info(`[${partner.name}] Connecting to ${partner.sftpHost}:${partner.sftpPort}... (types: ${inboundTypes.join(',')})`);

    const connectConfig: SftpClient.ConnectOptions = {
      host: partner.sftpHost,
      port: partner.sftpPort,
      username: partner.sftpUsername,
      readyTimeout: 15000,
      retries: 2,
      retry_minTimeout: 2000,
    };

    if (partner.sftpPrivateKey) {
      connectConfig.privateKey = partner.sftpPrivateKey;
    } else if (partner.sftpPassword) {
      connectConfig.password = partner.sftpPassword;
    }

    await sftp.connect(connectConfig);
    log.info(`[${partner.name}] Connected. Listing ${partner.inboundDir}`);

    const listing = await sftp.list(partner.inboundDir);

    const matchingFiles = listing.filter(
      item => item.type === '-' && matchesPattern(item.name, partner.inboundFilePattern)
    );

    log.info(`[${partner.name}] Found ${matchingFiles.length} matching files, ${seen.size} already seen`);

    for (const file of matchingFiles) {
      const fileKey = `${file.name}:${file.size}:${file.modifyTime}`;

      if (seen.has(fileKey)) continue;

      try {
        const remotePath = `${partner.inboundDir.replace(/\/$/, '')}/${file.name}`;
        log.info(`[${partner.name}] Downloading ${file.name} (${file.size} bytes)`);

        const content = await sftp.get(remotePath);
        const ediContent = typeof content === 'string' ? content : content.toString('utf-8');

        // Send to universal inbound endpoint — it handles type detection,
        // partner validation, routing, logging, and 997 auto-ack
        log.info(`[${partner.name}] Sending ${file.name} to universal inbound endpoint`);

        const response = await fetch(`${appConfig.backendUrl}${UNIVERSAL_INBOUND_ENDPOINT}`, {
          method: 'POST',
          headers: {
            'x-api-key': appConfig.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: ediContent,
            partnerId: partner.id,
            fileName: file.name,
            source: 'sftp',
          }),
        });

        const result = await response.json() as { data?: any; error?: string };

        if (!response.ok && response.status !== 409) {
          // Don't mark as seen on failure — retry on next poll
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        // Success or duplicate — mark as seen
        seen.add(fileKey);
        filesProcessed++;

        const txnType = result.data?.transactionType || 'unknown';
        const action = result.data?.action || 'processed';
        const ack = result.data?.ack997Sent ? ' (997 ack sent)' : '';
        log.info(`[${partner.name}] ${file.name} (${txnType}) ${action}${ack}`);

      } catch (err: any) {
        const msg = `Failed to process ${file.name}: ${err.message}`;
        log.error(`[${partner.name}] ${msg}`);
        errors.push(msg);
        // File NOT added to seen — will be retried on next poll cycle
      }
    }
  } catch (err: any) {
    const msg = `SFTP connection failed: ${err.message}`;
    log.error(`[${partner.name}] ${msg}`);
    errors.push(msg);
  } finally {
    try { await sftp.end(); } catch {}
  }

  return { filesProcessed, errors };
}

/** Clear seen-files cache for a partner (e.g., on config reload) */
export function clearSeenCache(partnerId?: string) {
  if (partnerId) {
    seenFiles.delete(partnerId);
  } else {
    seenFiles.clear();
  }
}

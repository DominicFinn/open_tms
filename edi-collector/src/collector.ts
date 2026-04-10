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
 * Detect X12 transaction type from EDI content.
 * Looks for ST*{type}* segment.
 */
function detectTransactionType(content: string): string | null {
  const match = content.match(/ST\*(\d{3})\*/);
  if (match) return match[1];

  // Fallback: check GS functional identifier
  const gsMatch = content.match(/GS\*([A-Z]{2})\*/);
  if (gsMatch) {
    const gsMap: Record<string, string> = {
      'PO': '850', 'SH': '856', 'SM': '204', 'GF': '990',
      'QM': '214', 'IM': '210', 'FA': '997',
    };
    return gsMap[gsMatch[1]] || null;
  }
  return null;
}

/**
 * Route map: transaction type → backend endpoint
 */
const TRANSACTION_ROUTES: Record<string, string> = {
  '850': '/api/v1/orders/import/edi',
  '990': '/api/v1/edi/tender/990',
  // Future:
  // '214': '/api/v1/edi/214/inbound',
  // '210': '/api/v1/edi/210/inbound',
};

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
  let filesProcessed = 0;
  const errors: string[] = [];

  // Get inbound transaction types this partner supports
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

    // Match files against the partner's inbound pattern
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

        // Detect transaction type from content
        const txnType = detectTransactionType(ediContent);

        if (!txnType) {
          log.warn(`[${partner.name}] Could not detect transaction type in ${file.name}, skipping`);
          seen.add(fileKey); // Don't retry unrecognized files
          continue;
        }

        // Check if this partner is configured for this transaction type
        if (!inboundTypes.includes(txnType)) {
          log.warn(`[${partner.name}] ${file.name} is type ${txnType} but partner only supports inbound: ${inboundTypes.join(',')}`);
          seen.add(fileKey);
          continue;
        }

        // Route to the correct backend endpoint
        const endpoint = TRANSACTION_ROUTES[txnType];
        if (!endpoint) {
          log.warn(`[${partner.name}] No route configured for transaction type ${txnType}`);
          seen.add(fileKey);
          continue;
        }

        log.info(`[${partner.name}] Routing ${file.name} (type ${txnType}) to ${endpoint}`);

        // Build request body based on transaction type
        let body: any;
        if (txnType === '850') {
          body = {
            ediContent,
            partnerId: partner.id,
            customerId: partner.customerId,
            fileName: file.name,
            source: 'sftp',
          };
        } else if (txnType === '990') {
          body = { content: ediContent };
        } else {
          body = { content: ediContent, partnerId: partner.id, fileName: file.name };
        }

        const response = await fetch(`${appConfig.backendUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'x-api-key': appConfig.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const result = await response.json() as { data?: any; error?: string };

        if (!response.ok && response.status !== 409) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        seen.add(fileKey);
        filesProcessed++;

        if (txnType === '850') {
          log.info(`[${partner.name}] ${file.name} (850) imported — ${result.data?.ordersCreated || 0} orders created`);
        } else if (txnType === '990') {
          log.info(`[${partner.name}] ${file.name} (990) processed — action: ${result.data?.action || 'unknown'}`);
        } else {
          log.info(`[${partner.name}] ${file.name} (${txnType}) processed`);
        }
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

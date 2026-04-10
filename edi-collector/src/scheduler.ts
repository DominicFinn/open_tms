import cron from 'node-cron';
import { AppConfig, EdiPartnerConfig, TradingPartnerConfig, fetchPartnerConfigs, fetchTradingPartnerConfigs } from './config.js';
import { collectFromPartner, collectFromTradingPartner, clearSeenCache } from './collector.js';
import { log } from './logger.js';

interface PartnerJob {
  partnerId: string;
  partnerName: string;
  cronTask?: cron.ScheduledTask;
  intervalTimer?: ReturnType<typeof setInterval>;
  running: boolean;
}

const activeJobs = new Map<string, PartnerJob>();

async function runCollection(partner: EdiPartnerConfig, appConfig: AppConfig, job: PartnerJob) {
  if (job.running) {
    log.warn(`[${partner.name}] Previous collection still running, skipping this cycle`);
    return;
  }

  job.running = true;
  try {
    const result = await collectFromPartner(partner, appConfig);
    if (result.filesProcessed > 0) {
      log.info(`[${partner.name}] Cycle complete: ${result.filesProcessed} files processed`);
    }
    if (result.errors.length > 0) {
      log.warn(`[${partner.name}] Cycle had ${result.errors.length} error(s)`);
    }
  } catch (err: any) {
    log.error(`[${partner.name}] Collection cycle failed: ${err.message}`);
  } finally {
    job.running = false;
  }
}

function schedulePartner(partner: EdiPartnerConfig, appConfig: AppConfig) {
  // Stop existing job for this partner if any
  stopPartnerJob(partner.id);

  const job: PartnerJob = {
    partnerId: partner.id,
    partnerName: partner.name,
    running: false,
  };

  if (partner.pollingCron && cron.validate(partner.pollingCron)) {
    log.info(`[${partner.name}] Scheduling with cron: ${partner.pollingCron}`);
    job.cronTask = cron.schedule(partner.pollingCron, () => {
      runCollection(partner, appConfig, job);
    });
  } else {
    const intervalMs = partner.pollingInterval * 1000;
    log.info(`[${partner.name}] Scheduling every ${partner.pollingInterval}s`);
    // Run immediately on first schedule
    runCollection(partner, appConfig, job);
    job.intervalTimer = setInterval(() => {
      runCollection(partner, appConfig, job);
    }, intervalMs);
  }

  activeJobs.set(partner.id, job);
}

function stopPartnerJob(partnerId: string) {
  const job = activeJobs.get(partnerId);
  if (!job) return;

  if (job.cronTask) {
    job.cronTask.stop();
  }
  if (job.intervalTimer) {
    clearInterval(job.intervalTimer);
  }
  activeJobs.delete(partnerId);
  log.info(`[${job.partnerName}] Job stopped`);
}

// Schedule a TradingPartner (new model — routes by transaction type)
function scheduleTradingPartner(partner: TradingPartnerConfig, appConfig: AppConfig) {
  const jobId = `tp-${partner.id}`;
  stopPartnerJob(jobId);

  const job: PartnerJob = {
    partnerId: jobId,
    partnerName: partner.name,
    running: false,
  };

  const run = () => {
    if (job.running) {
      log.warn(`[${partner.name}] Previous collection still running, skipping`);
      return;
    }
    job.running = true;
    collectFromTradingPartner(partner, appConfig)
      .then(result => {
        if (result.filesProcessed > 0) log.info(`[${partner.name}] Cycle: ${result.filesProcessed} files`);
        if (result.errors.length > 0) log.warn(`[${partner.name}] Cycle: ${result.errors.length} error(s)`);
      })
      .catch(err => log.error(`[${partner.name}] Cycle failed: ${err.message}`))
      .finally(() => { job.running = false; });
  };

  if (partner.pollingCron && cron.validate(partner.pollingCron)) {
    log.info(`[${partner.name}] (TradingPartner) Scheduling cron: ${partner.pollingCron}`);
    job.cronTask = cron.schedule(partner.pollingCron, run);
  } else {
    const intervalMs = partner.pollingInterval * 1000;
    log.info(`[${partner.name}] (TradingPartner) Scheduling every ${partner.pollingInterval}s`);
    run(); // Run immediately
    job.intervalTimer = setInterval(run, intervalMs);
  }

  activeJobs.set(jobId, job);
}

export async function refreshSchedule(appConfig: AppConfig) {
  log.info('Refreshing partner configurations...');

  const allActiveIds = new Set<string>();

  // 1. Fetch TradingPartner configs (new model)
  try {
    const tradingPartners = await fetchTradingPartnerConfigs(appConfig);
    log.info(`Fetched ${tradingPartners.length} TradingPartner(s) with inbound enabled`);

    for (const tp of tradingPartners) {
      if (!tp.sftpHost || !tp.sftpUsername) {
        log.warn(`[${tp.name}] Missing SFTP credentials, skipping`);
        continue;
      }
      const jobId = `tp-${tp.id}`;
      allActiveIds.add(jobId);
      scheduleTradingPartner(tp, appConfig);
    }
  } catch (err: any) {
    log.warn(`Failed to fetch TradingPartner configs (may not exist yet): ${err.message}`);
  }

  // 2. Fetch legacy EdiPartner configs (backward compatibility)
  try {
    const partners = await fetchPartnerConfigs(appConfig);
    log.info(`Fetched ${partners.length} legacy EdiPartner(s)`);

    for (const partner of partners) {
      if (!partner.sftpHost || !partner.sftpUsername) {
        log.warn(`[${partner.name}] Missing SFTP credentials, skipping`);
        continue;
      }
      allActiveIds.add(partner.id);
      schedulePartner(partner, appConfig);
    }
  } catch (err: any) {
    log.error(`Failed to fetch legacy partner configs: ${err.message}`);
  }

  // 3. Stop jobs for partners no longer active
  for (const [jobId] of activeJobs) {
    if (!allActiveIds.has(jobId)) {
      stopPartnerJob(jobId);
      clearSeenCache(jobId);
    }
  }
}

export function stopAll() {
  for (const [partnerId] of activeJobs) {
    stopPartnerJob(partnerId);
  }
  clearSeenCache();
  log.info('All jobs stopped');
}

export function getActiveJobCount(): number {
  return activeJobs.size;
}

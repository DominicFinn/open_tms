import cron from 'node-cron';
import { AppConfig, TradingPartnerConfig, fetchTradingPartnerConfigs } from './config.js';
import { collectFromTradingPartner, clearSeenCache } from './collector.js';
import { log } from './logger.js';

interface PartnerJob {
  partnerId: string;
  partnerName: string;
  cronTask?: cron.ScheduledTask;
  intervalTimer?: ReturnType<typeof setInterval>;
  running: boolean;
}

const activeJobs = new Map<string, PartnerJob>();

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
    log.info(`[${partner.name}] Scheduling cron: ${partner.pollingCron}`);
    job.cronTask = cron.schedule(partner.pollingCron, run);
  } else {
    const intervalMs = partner.pollingInterval * 1000;
    log.info(`[${partner.name}] Scheduling every ${partner.pollingInterval}s`);
    run(); // Run immediately
    job.intervalTimer = setInterval(run, intervalMs);
  }

  activeJobs.set(jobId, job);
}

export async function refreshSchedule(appConfig: AppConfig) {
  log.info('Refreshing partner configurations...');

  const allActiveIds = new Set<string>();

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
    log.error(`Failed to fetch TradingPartner configs: ${err.message}`);
  }

  // Stop jobs for partners no longer active
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


import cron from 'node-cron';
import { AppConfig, EdiPartnerConfig, fetchPartnerConfigs } from './config.js';
import { collectFromPartner, clearSeenCache } from './collector.js';
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

export async function refreshSchedule(appConfig: AppConfig) {
  log.info('Refreshing partner configurations...');

  let partners: EdiPartnerConfig[];
  try {
    partners = await fetchPartnerConfigs(appConfig);
  } catch (err: any) {
    log.error(`Failed to fetch partner configs: ${err.message}`);
    return;
  }

  log.info(`Fetched ${partners.length} active polling partner(s)`);

  const activePartnerIds = new Set(partners.map(p => p.id));

  // Stop jobs for partners that are no longer active/polling
  for (const [partnerId] of activeJobs) {
    if (!activePartnerIds.has(partnerId)) {
      stopPartnerJob(partnerId);
      clearSeenCache(partnerId);
    }
  }

  // Schedule or re-schedule each active partner
  for (const partner of partners) {
    if (!partner.sftpHost || !partner.sftpUsername) {
      log.warn(`[${partner.name}] Missing SFTP credentials, skipping`);
      continue;
    }
    schedulePartner(partner, appConfig);
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

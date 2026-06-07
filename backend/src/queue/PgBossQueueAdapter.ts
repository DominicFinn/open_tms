import { PgBoss } from 'pg-boss';
import { IQueueAdapter, QueueMessage, QueueStats, QueueJob, SubscribeAdapterOptions } from './IQueueAdapter.js';
import { QUEUES } from './events.js';

const DEFAULT_POLL_INTERVAL_SECONDS = 2;
const DEFAULT_CONCURRENCY = 2;

const DEAD_LETTER_SUFFIX = '.dead';

const QUEUE_DEFAULTS = {
  retryLimit: 3,
  retryBackoff: true,
  retryDelay: 30,
  expireInSeconds: 900,
  deleteAfterSeconds: 604800, // 7 days
};

export class PgBossQueueAdapter implements IQueueAdapter {
  private boss: PgBoss;
  private databaseUrl: string;

  constructor(databaseUrl: string) {
    this.databaseUrl = databaseUrl;
    this.boss = new PgBoss(databaseUrl);

    this.boss.on('error', (error: Error) => {
      console.error('[Queue] pg-boss error:', error.message);
    });
  }

  async start(): Promise<void> {
    await this.boss.start();

    // Create dead letter queues for each main queue
    const queueNames = Object.values(QUEUES);
    for (const name of queueNames) {
      const dlq = name + DEAD_LETTER_SUFFIX;
      await this.boss.createQueue(dlq, {
        retryLimit: 0,
        deleteAfterSeconds: 2592000, // 30 days retention for DLQ
      }).catch(() => {});
    }

    console.log('[Queue] pg-boss started');
  }

  async stop(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: 10000 });
    console.log('[Queue] pg-boss stopped');
  }

  async publish(queueName: string, message: QueueMessage): Promise<string> {
    await this.boss.createQueue(queueName, {
      ...QUEUE_DEFAULTS,
      deadLetter: queueName + DEAD_LETTER_SUFFIX,
    }).catch(() => {});

    const jobId = await this.boss.send(queueName, {
      ...message,
      metadata: {
        ...message.metadata,
        timestamp: message.metadata?.timestamp || new Date().toISOString(),
      },
    });

    if (!jobId) {
      throw new Error(`Failed to publish message to ${queueName}`);
    }

    return jobId;
  }

  async subscribe(
    queueName: string,
    handler: (message: QueueMessage) => Promise<void>,
    options?: SubscribeAdapterOptions,
  ): Promise<void> {
    await this.boss.createQueue(queueName, {
      ...QUEUE_DEFAULTS,
      deadLetter: queueName + DEAD_LETTER_SUFFIX,
    }).catch(() => {});

    // Default to a 2-second poll: with ~20 subscribers a 0.5s default would
    // be ~40 polling round-trips per second even when the queues are empty.
    // Latency-sensitive subscribers (read-model projections that back
    // "POST then navigate to list" UX) can opt back into faster polling
    // via SubscribeOptions.pollingIntervalSeconds.
    const pollingIntervalSeconds = options?.pollingIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;
    const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;

    await this.boss.work(
      queueName,
      {
        localConcurrency: concurrency,
        pollingIntervalSeconds,
      },
      async (jobs: any[]) => {
        for (const job of jobs) {
          try {
            await handler(job.data as QueueMessage);
          } catch (err: any) {
            console.error(`[Queue] Worker error on ${queueName}:`, err.message);
            throw err;
          }
        }
      }
    );

    console.log(
      `[Queue] Worker subscribed to ${queueName} ` +
      `(concurrency=${concurrency}, poll=${pollingIntervalSeconds}s)`
    );
  }

  async getQueueStats(queueName: string): Promise<QueueStats> {
    try {
      const stats = await this.boss.getQueueStats(queueName);
      // Get DLQ count separately
      let failedCount = 0;
      try {
        const dlqStats = await this.boss.getQueueStats(queueName + DEAD_LETTER_SUFFIX);
        failedCount = dlqStats.totalCount || 0;
      } catch {
        // DLQ may not exist yet
      }

      return {
        name: queueName,
        queued: stats.queuedCount || 0,
        active: stats.activeCount || 0,
        deferred: stats.deferredCount || 0,
        failed: failedCount,
        total: stats.totalCount || 0,
        deadLetterQueue: queueName + DEAD_LETTER_SUFFIX,
        createdAt: stats.createdOn ? new Date(stats.createdOn).toISOString() : undefined,
      };
    } catch {
      return {
        name: queueName,
        queued: 0,
        active: 0,
        deferred: 0,
        failed: 0,
        total: 0,
      };
    }
  }

  async getAllQueueStats(): Promise<QueueStats[]> {
    const queueNames = Object.values(QUEUES);
    return Promise.all(queueNames.map(name => this.getQueueStats(name)));
  }

  async peekJobs(queueName: string, state: 'queued' | 'active' | 'failed', limit: number = 20): Promise<QueueJob[]> {
    // Delegate to the non-destructive implementation
    return this.peekJobsDirect(queueName, state, limit);
  }

  async purgeQueue(queueName: string): Promise<number> {
    try {
      // Purge the dead letter queue
      const dlq = queueName + DEAD_LETTER_SUFFIX;
      const beforeStats = await this.boss.getQueueStats(dlq).catch(() => null);
      const count = beforeStats?.totalCount || 0;
      if (count > 0) {
        await this.boss.deleteQueuedJobs(dlq);
      }
      return count;
    } catch {
      return 0;
    }
  }

  async retryFailedJobs(queueName: string): Promise<number> {
    // Move jobs from DLQ back to the main queue by fetching and republishing
    const dlq = queueName + DEAD_LETTER_SUFFIX;
    let retriedCount = 0;

    try {
      const dlqStats = await this.boss.getQueueStats(dlq).catch(() => null);
      if (!dlqStats || dlqStats.totalCount === 0) return 0;

      // Fetch jobs from DLQ and republish to main queue
      const jobs = await this.boss.fetch(dlq, { batchSize: 100 } as any);
      if (!jobs) return 0;

      for (const job of jobs) {
        await this.boss.send(queueName, job.data as object);
        await this.boss.complete(dlq, job.id);
        retriedCount++;
      }
    } catch (err: any) {
      console.error(`[Queue] Failed to retry DLQ jobs for ${queueName}:`, err.message);
    }

    return retriedCount;
  }

  // Direct SQL access for peeking without consuming jobs
  async peekJobsDirect(queueName: string, state: 'queued' | 'active' | 'failed', limit: number = 20): Promise<QueueJob[]> {
    // Use pg-boss's underlying connection to peek at jobs without consuming them
    const targetQueue = state === 'failed' ? queueName + DEAD_LETTER_SUFFIX : queueName;
    const pgState = state === 'queued' ? 'created' : state === 'active' ? 'active' : 'created'; // DLQ jobs are in 'created' state

    try {
      const jobs = await this.boss.findJobs(targetQueue, {
        queued: state === 'queued' || state === 'failed',
      });

      return jobs.slice(0, limit).map((job: any) => ({
        id: job.id,
        queue: targetQueue,
        state: job.state || pgState,
        data: job.data,
        retryCount: job.retryCount || 0,
        retryLimit: job.retryLimit || 0,
        createdAt: job.createdOn ? new Date(job.createdOn).toISOString() : new Date().toISOString(),
        startedAt: job.startedOn ? new Date(job.startedOn).toISOString() : null,
        completedAt: job.completedOn ? new Date(job.completedOn).toISOString() : null,
        errorMessage: job.output ? JSON.stringify(job.output) : null,
      }));
    } catch {
      return [];
    }
  }
}

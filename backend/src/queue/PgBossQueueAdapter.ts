import { PgBoss } from 'pg-boss';
import { IQueueAdapter, QueueMessage } from './IQueueAdapter.js';

export class PgBossQueueAdapter implements IQueueAdapter {
  private boss: PgBoss;

  constructor(databaseUrl: string) {
    this.boss = new PgBoss(databaseUrl);

    this.boss.on('error', (error: Error) => {
      console.error('[Queue] pg-boss error:', error.message);
    });
  }

  async start(): Promise<void> {
    await this.boss.start();
    console.log('[Queue] pg-boss started');
  }

  async stop(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: 10000 });
    console.log('[Queue] pg-boss stopped');
  }

  async publish(queueName: string, message: QueueMessage): Promise<string> {
    // Ensure queue exists with retry settings
    await this.boss.createQueue(queueName, {
      retryLimit: 3,
      retryBackoff: true,
      retryDelay: 30,
      expireInSeconds: 900,
      deleteAfterSeconds: 604800, // 7 days
    }).catch(() => {
      // Queue may already exist, that's fine
    });

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
    handler: (message: QueueMessage) => Promise<void>
  ): Promise<void> {
    // Ensure queue exists
    await this.boss.createQueue(queueName, {
      retryLimit: 3,
      retryBackoff: true,
      retryDelay: 30,
      expireInSeconds: 900,
      deleteAfterSeconds: 604800,
    }).catch(() => {
      // Queue may already exist
    });

    await this.boss.work(
      queueName,
      { localConcurrency: 2 },
      async (jobs: any[]) => {
        for (const job of jobs) {
          try {
            await handler(job.data as QueueMessage);
          } catch (err: any) {
            console.error(`[Queue] Worker error on ${queueName}:`, err.message);
            throw err; // pg-boss handles retry
          }
        }
      }
    );

    console.log(`[Queue] Worker subscribed to ${queueName}`);
  }
}

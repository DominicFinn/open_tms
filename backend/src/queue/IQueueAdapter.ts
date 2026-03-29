export interface QueueMessage<T = any> {
  id?: string;
  type: string;
  payload: T;
  metadata?: {
    retryCount?: number;
    sourceId?: string;
    timestamp?: string;
  };
}

export interface QueueStats {
  name: string;
  queued: number;
  active: number;
  deferred: number;
  failed: number;
  total: number;
  deadLetterQueue?: string;
  createdAt?: string;
}

export interface QueueJob {
  id: string;
  queue: string;
  state: string;
  data: any;
  retryCount: number;
  retryLimit: number;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
}

export interface IQueueAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  publish(queueName: string, message: QueueMessage): Promise<string>;
  subscribe(queueName: string, handler: (message: QueueMessage) => Promise<void>): Promise<void>;

  // Monitoring
  getQueueStats(queueName: string): Promise<QueueStats>;
  getAllQueueStats(): Promise<QueueStats[]>;
  peekJobs(queueName: string, state: 'queued' | 'active' | 'failed', limit?: number): Promise<QueueJob[]>;

  // Dead letter / management
  purgeQueue(queueName: string): Promise<number>;
  retryFailedJobs(queueName: string): Promise<number>;
}

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

export interface IQueueAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  publish(queueName: string, message: QueueMessage): Promise<string>;
  subscribe(queueName: string, handler: (message: QueueMessage) => Promise<void>): Promise<void>;
}

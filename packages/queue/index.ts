export * from 'bullmq';

export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6385', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const RECORD_QUEUE_NAME = 'record-stream';
export const PROCESS_QUEUE_NAME = 'process-media';

export interface RecordStreamJobData {
  uid: string;
  username: string;
  aliasStreamKey: string | null;
  streamId: string;
}

export interface ProcessMediaJobData {
  streamId: string;
  rawFilePath: string;
  modelUsername: string;
}

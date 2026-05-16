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
  /** Reserved for future direct HLS capture bypass. Not yet consumed by recorder. */
  aliasStreamKey: string | null;
  streamId: string;
}

export interface ProcessMediaJobData {
  streamId: string;
  modelUsername: string;
}

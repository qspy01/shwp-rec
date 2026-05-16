export * from 'bullmq';

import { env } from '@shwp-rec/config';

export const REDIS_CONFIG = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
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

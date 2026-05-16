export enum StreamStatus {
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

export interface ModelDto {
  id: string;
  username: string;
}

export interface StreamDto {
  id: string;
  modelUsername: string;
  duration: number | null;
  resolution: string | null;
  thumbnailKey: string | null;
  s3Key: string | null;
  createdAt: string;
  status: StreamStatus;
}

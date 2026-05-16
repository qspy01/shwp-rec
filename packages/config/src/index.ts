import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6385),
  REDIS_PASSWORD: z.string().optional(),
  MINIO_ENDPOINT: z.string().default('http://localhost:9005'),
  MINIO_ACCESS_KEY: z.string().default('admin'),
  MINIO_SECRET_KEY: z.string().default('password123'),
  MINIO_BUCKET: z.string().default('vods'),
  CAPTURE_DIR: z.string().default('/tmp/shwp/captures'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  MAX_FFMPEG_CONCURRENCY: z.coerce.number().int().positive().default(2),
  NODE_ENV: z.enum(['production', 'development', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const errors = result.error.flatten().fieldErrors;
  console.error('[Config] Invalid environment variables:');
  for (const [key, messages] of Object.entries(errors)) {
    console.error(`  ${key}: ${messages?.join(', ')}`);
  }
  console.error('\nCheck your .env file and ensure all required variables are set.');
  process.exit(1);
}

export const env: Env = result.data;

export { createLogger } from './logger';
export type { Logger } from './logger';

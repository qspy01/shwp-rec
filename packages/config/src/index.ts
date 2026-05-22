import 'dotenv/config';
import { envSchema } from './schema';

export { envSchema } from './schema';
export type { Env } from './schema';

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

export const env = result.data;

export { createLogger } from './logger';
export type { Logger } from './logger';

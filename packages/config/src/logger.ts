import pino from 'pino';

export function createLogger(service: string) {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      err: pino.stdSerializers.err,
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;

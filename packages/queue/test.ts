import { Queue } from 'bullmq';
import { REDIS_CONFIG, PROCESS_QUEUE_NAME } from './index';

const processQueue = new Queue(PROCESS_QUEUE_NAME, { connection: REDIS_CONFIG });

async function run() {
  await processQueue.add('process', {
    streamId: '1e1752e1-6010-4fad-b6aa-04cf20996c1d',
    rawFilePath: '/tmp/shwp/captures/1e1752e1-6010-4fad-b6aa-04cf20996c1d.raw.mp4',
    modelUsername: 'anotherlove_',
  }, {
    jobId: 'test-job-1',
  });
  console.log('Enqueued test job');
  process.exit(0);
}

run();

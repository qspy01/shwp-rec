import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const published = await prisma.stream.count({ where: { status: 'PUBLISHED' }});
  const recording = await prisma.stream.count({ where: { status: 'RECORDING' }});
  const processing = await prisma.stream.count({ where: { status: 'PROCESSING' }});
  const failed = await prisma.stream.count({ where: { status: 'FAILED' }});
  
  console.log(`DB Stats - PUBLISHED: ${published}, RECORDING: ${recording}, PROCESSING: ${processing}, FAILED: ${failed}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

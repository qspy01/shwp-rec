import { prisma } from '@shwp-rec/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function VideoPage({ params }: { params: { id: string } }) {
  const id = (await params).id;
  const stream = await prisma.stream.findUnique({
    where: { id },
    include: { model: true },
  });

  if (!stream || !stream.s3Key) {
    return <div style={{ padding: '2rem' }}>Video not found.</div>;
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <Link href="/" style={{ color: 'blue', textDecoration: 'underline' }}>&larr; Back to Gallery</Link>
      <h1 style={{ marginTop: '1rem' }}>{stream.model.username} VOD</h1>
      <p style={{ color: '#666' }}>Recorded on: {stream.createdAt.toLocaleDateString()}</p>
      
      <div style={{ marginTop: '2rem', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
        <video 
          controls 
          style={{ width: '100%', display: 'block' }} 
          poster={`/api/media/${stream.thumbnailKey}`}
        >
          <source src={`/api/media/${stream.s3Key}`} type="video/mp4" />
          Your browser does not support HTML video.
        </video>
      </div>
    </main>
  );
}

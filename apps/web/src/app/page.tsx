import { prisma } from '@shwp-rec/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const streams = await prisma.stream.findMany({
    where: { status: 'PUBLISHED' },
    include: { model: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Automated VOD Platform</h1>
      <Link href="/admin/queues" style={{ color: 'blue', textDecoration: 'underline' }}>View Admin Queue Dashboard</Link>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        {streams.map(stream => (
          <div key={stream.id} style={{ border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '180px', backgroundColor: '#eee', backgroundImage: stream.thumbnailKey ? `url(/api/media/${stream.thumbnailKey})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div style={{ padding: '1rem' }}>
              <h2>{stream.model.username}</h2>
              <p>Duration: {stream.duration}s | Resolution: {stream.resolution}</p>
              <Link href={`/video/${stream.id}`}>
                <button style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>Watch Video</button>
              </Link>
            </div>
          </div>
        ))}
        {streams.length === 0 && <p style={{ marginTop: '2rem' }}>No published VODs yet. The scheduler will pick up online models shortly.</p>}
      </div>
    </main>
  );
}

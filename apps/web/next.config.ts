import type { NextConfig } from "next";

const schedulerUrl = process.env.SCHEDULER_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/admin/queues/:path*',
        destination: `${schedulerUrl}/admin/queues/:path*`,
      },
    ];
  },
};

export default nextConfig;

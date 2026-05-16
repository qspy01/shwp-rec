import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/admin/queues/:path*',
        destination: 'http://localhost:3001/admin/queues/:path*', // Proxy to Scheduler Express App
      },
    ];
  },
};

export default nextConfig;

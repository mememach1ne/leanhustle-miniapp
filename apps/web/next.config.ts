import type { NextConfig } from 'next';

const backendApiOrigin = process.env.BACKEND_API_ORIGIN ?? 'http://localhost:3002';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lean-poizon/shared'],
  async rewrites() {
    return [
      {
        source: '/backend-api/:path*',
        destination: `${backendApiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

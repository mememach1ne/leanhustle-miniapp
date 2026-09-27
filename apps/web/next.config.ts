import type { NextConfig } from 'next';

const backendApiOrigin = process.env.BACKEND_API_ORIGIN ?? 'http://localhost:3002';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lean-poizon/shared'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Mini App runs framed only inside Telegram's web clients; block
          // everyone else from framing the site (clickjacking).
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
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

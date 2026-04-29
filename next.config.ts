import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  generateEtags: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '-1' },
          { key: 'Surrogate-Control', value: 'no-store' },
        ],
      },
    ]
  },
}

export default nextConfig
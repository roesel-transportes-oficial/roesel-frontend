import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  generateEtags: false,
  async headers() {
    return [
      {
        // Aplica no-cache APENAS em páginas HTML, não em fetch/XHR
        source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '-1' },
        ],
        has: [
          {
            type: 'header',
            key: 'accept',
            value: '(.*text/html.*)',
          },
        ],
      },
    ]
  },
}

export default nextConfig
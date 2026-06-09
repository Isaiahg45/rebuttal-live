import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
value: "script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; default-src *; connect-src * wss://*.agora.io wss://*.sd-rtn.com; media-src *; worker-src blob:;",          },
        ],
      },
    ]
  },
}; 

export default nextConfig;

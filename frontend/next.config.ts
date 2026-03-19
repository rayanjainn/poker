import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: [
    "10.10.112.122",
    "localhost:3000",
    "192.168.29.56",
    "10.10.113.38",
    "poker-production-6b84.up.railway.app",
    "pokerray.up.railway.app",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://autorack.proxy.rlwy.net:56843/api/:path*",
      },
    ];
  },
};

export default nextConfig;

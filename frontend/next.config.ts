import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: [
    "10.10.112.122",
    "localhost:3000",
    "192.168.29.56",
    "10.10.113.38",
    "pokerray.up.railway.app",
  ],
};

export default nextConfig;

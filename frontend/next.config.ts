import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: [
    "localhost:3000",
    "https://poker-backend-etni.onrender.com",
  ],
};

export default nextConfig;

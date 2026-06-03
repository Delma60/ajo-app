import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['953a-105-127-8-42.ngrok-free.app'],
  serverExternalPackages: [
    "firebase-admin",
    "@firebase/app",
    "undici",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb'
    }
  },
};

export default nextConfig;

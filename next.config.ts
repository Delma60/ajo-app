import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: [
    "firebase-admin",
    "@firebase/app",
    "undici",
  ],
};

export default nextConfig;

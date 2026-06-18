import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "puppeteer",
    "puppeteer-core",
    "pdf-parse",
    "mammoth",
  ],
  images: {
    remotePatterns: [
      // ArtStation
      { protocol: "https", hostname: "**.cdnartstation.com" },
      { protocol: "https", hostname: "cdnb.artstation.com" },
      { protocol: "https", hostname: "cdna.artstation.com" },
      // GitHub
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Bilibili
      { protocol: "https", hostname: "i0.hdslb.com" },
      { protocol: "https", hostname: "i1.hdslb.com" },
      { protocol: "https", hostname: "i2.hdslb.com" },
      // Behance
      { protocol: "https", hostname: "mir-s3-cdn-cf.behance.net" },
      { protocol: "https", hostname: "**.behance.net" },
    ],
  },
  ...(process.env.NEXT_BUILD_STANDALONE === "true" ? { output: "standalone" as const } : {}),
};

export default nextConfig;

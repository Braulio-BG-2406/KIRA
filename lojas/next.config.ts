import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // fotos de produto sobem por server action
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;

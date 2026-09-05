import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // recharts and @base-ui/react each export hundreds of modules — this
    // makes the bundler only pull in what's actually imported instead of
    // the whole package (lucide-react is already auto-optimized by Next).
    optimizePackageImports: ["recharts", "@base-ui/react"],
  },
};

export default nextConfig;

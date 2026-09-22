import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined;

const nextConfig: NextConfig = {
  experimental: {
    // recharts and @base-ui/react each export hundreds of modules — this
    // makes the bundler only pull in what's actually imported instead of
    // the whole package (lucide-react is already auto-optimized by Next).
    optimizePackageImports: ["recharts", "@base-ui/react"],
  },
  images: {
    // Lets next/image actually optimize Content tool photos (signed
    // Supabase Storage URLs) instead of the `unoptimized` escape hatch
    // those <Image> usages had, which shipped full-size phone photos.
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname, pathname: "/storage/v1/object/sign/**" }]
      : [],
  },
};

export default nextConfig;

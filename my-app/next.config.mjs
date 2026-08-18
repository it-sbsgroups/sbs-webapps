/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // Produces a minimal .next/standalone/ bundle with only the deps this
  // app actually needs at runtime, traced from the build — the Docker
  // image copies just that instead of the full node_modules.
  output: "standalone",
  reactCompiler: true,
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "sbsgroups.co.in",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.sbsgroups.co.in",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // App Router (app/ directory)
  experimental: {
    appDir: true,
  },

  // We don't need Image Optimization on Azure for this internal app
  images: {
    unoptimized: true,
  },

  // Be lenient in CI/Azure builds (same as before so builds don't fail)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

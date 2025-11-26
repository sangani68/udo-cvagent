import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Make Next emit .next/standalone/server.js so your start script works
  output: "standalone",

  experimental: {
    // Allow Node-only packages to be required at runtime on the server.
    serverComponentsExternalPackages: ["word-extractor"],
  },

  webpack: (config, { isServer }) => {
    // ─────────────────────────────────────────────
    // Keep "word-extractor" external on the server
    // ─────────────────────────────────────────────
    if (isServer) {
      const original = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];

      config.externals = [
        (ctx, req, cb) => {
          if (req === "word-extractor") {
            return cb(null, "commonjs word-extractor");
          }
          return cb();
        },
        ...original,
      ];
    }

    // ─────────────────────────────────────────────
    // Alias "@" → project root
    // ─────────────────────────────────────────────
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(process.cwd()),
    };

    return config;
  },
};

export default nextConfig;

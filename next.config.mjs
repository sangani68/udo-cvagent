import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
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
          cb();
        },
        ...original,
      ];
    }

    // ─────────────────────────────────────────────
    // NEW: Alias "@" → project root for imports
    // So "@/lib/..." => "<project-root>/lib/..."
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow Node-only packages to be required at runtime on the server.
    serverComponentsExternalPackages: ['word-extractor'],
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Keep "word-extractor" external so Next doesn't try to bundle it.
      const original = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];

      config.externals = [
        (ctx, req, cb) => {
          if (req === 'word-extractor') return cb(null, 'commonjs word-extractor');
          cb();
        },
        ...original,
      ];
    }
    return config;
  },
};

export default nextConfig;

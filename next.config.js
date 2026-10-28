/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't bundle @cursor/sdk - it's only used server-side
  serverExternalPackages: ['@cursor/sdk'],
  webpack: (config) => {
    // Exclude .d.ts.map files from processing
    config.module.rules.push({
      test: /\.d\.ts\.map$/,
      use: 'ignore-loader',
    });
    return config;
  },
};

module.exports = nextConfig;

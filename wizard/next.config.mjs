/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Resend is only loaded on the gated LIVE path; keep it out of the client bundle.
  serverExternalPackages: ['resend'],
};

export default nextConfig;

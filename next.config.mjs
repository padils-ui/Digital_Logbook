/** @type {import('next').NextConfig} */
const withPWA = (await import('next-pwa')).default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Lumpuhkan PWA sepenuhnya dalam mod pembangunan supaya service worker
  // tidak pernah cache HTML/CSS yang basi semasa `npm run dev`.
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'coresg-normal.trae.ai' },
    ],
  },
};

export default withPWA(nextConfig);

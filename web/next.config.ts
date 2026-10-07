import path from 'node:path';
import type { NextConfig } from 'next';

// One codebase, two static sites. SITE picks which pages are built:
//   page.public.tsx  -> sarahanddamilare.dabioye.com (church wedding, admin)
//   page.invite.tsx  -> oluwabioye.dabioye.com (code entry, private invitations, gate)
//   *.shared.tsx     -> both
const site = process.env.SITE === 'invite' ? 'invite' : 'public';

const nextConfig: NextConfig = {
  output: 'export',
  distDir: `dist/${site}`,
  pageExtensions: [`${site}.tsx`, `${site}.ts`, 'shared.tsx', 'shared.ts'],
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_SITE: site },
  // The wedding details live in functions/src/config.js and are shared with the API, so resolve from the repo root.
  turbopack: { root: path.join(__dirname, '..') },
};

export default nextConfig;

// Builds both static sites into dist/public and dist/invite.
// Files in site-assets/<site>/ are copied into that site only (e.g. the traditional invitation card
// never ships on the public domain).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
// Run Next with this same Node binary: works even when npx isn't on the PATH (IDE tasks, nvm).
const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
// Next also starts `node` workers itself, so put this Node's folder first on the PATH.
const PATH = [path.dirname(process.execPath), process.env.PATH].filter(Boolean).join(path.delimiter);
const sites = process.argv.slice(2).length ? process.argv.slice(2) : ['public', 'invite'];

for (const site of sites) {
  rmSync(path.join(root, 'dist', site), { recursive: true, force: true });
  console.log(`\n▸ building ${site} site`);
  execFileSync(process.execPath, [next, 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, PATH, SITE: site } });
  const extra = path.join(root, 'site-assets', site);
  if (existsSync(extra)) cpSync(extra, path.join(root, 'dist', site), { recursive: true });
  // Build caches are not part of the site.
  rmSync(path.join(root, 'dist', site, 'cache'), { recursive: true, force: true });
}

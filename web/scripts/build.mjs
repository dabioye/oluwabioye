// Builds both static sites into dist/public and dist/invite.
// Files in site-assets/<site>/ are copied into that site only (e.g. the traditional invitation card
// never ships on the public domain).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const sites = process.argv.slice(2).length ? process.argv.slice(2) : ['public', 'invite'];

for (const site of sites) {
  rmSync(path.join(root, 'dist', site), { recursive: true, force: true });
  console.log(`\n▸ building ${site} site`);
  execFileSync('npx', ['next', 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, SITE: site } });
  const extra = path.join(root, 'site-assets', site);
  if (existsSync(extra)) cpSync(extra, path.join(root, 'dist', site), { recursive: true });
  // Build caches are not part of the site.
  rmSync(path.join(root, 'dist', site, 'cache'), { recursive: true, force: true });
}

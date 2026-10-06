// Hot-reloading development: two `next dev` servers (public on :4000, invite on :4001) behind the
// local Hosting stand-in on :3000 / :3001, which adds the API and the Firebase rewrites.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const web = path.dirname(path.dirname(new URL(import.meta.url).pathname));
// Run Next with this same Node binary: works even when npx isn't on the PATH (IDE tasks, nvm).
const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
// Next also starts `node` workers itself, so put this Node's folder first on the PATH.
const PATH = [path.dirname(process.execPath), process.env.PATH].filter(Boolean).join(path.delimiter);
const run = (args, extra = {}) => {
  const child = spawn(process.execPath, args, { cwd: web, stdio: 'inherit', env: { ...process.env, PATH, ...extra } });
  child.on('error', (e) => console.error(`could not start ${args.join(' ')}:`, e.message));
  return child;
};

const kids = [
  run([next, 'dev', '-p', '4000'], { SITE: 'public' }),
  run([next, 'dev', '-p', '4001'], { SITE: 'invite' }),
  run([path.join(web, 'scripts', 'serve.mjs'), '--dev']),
];
const stop = () => kids.forEach((k) => k.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

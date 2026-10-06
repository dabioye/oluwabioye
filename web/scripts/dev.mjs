// Hot-reloading development: two `next dev` servers (public on :4000, invite on :4001) behind the
// local Hosting stand-in on :3000 / :3001, which adds the API and the Firebase rewrites.
import { spawn } from 'node:child_process';
import path from 'node:path';

const web = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const env = { ...process.env };
const run = (cmd, args, extra = {}) => spawn(cmd, args, { cwd: web, stdio: 'inherit', env: { ...env, ...extra } });

const kids = [
  run('npx', ['next', 'dev', '-p', '4000'], { SITE: 'public' }),
  run('npx', ['next', 'dev', '-p', '4001'], { SITE: 'invite' }),
  run('node', ['scripts/serve.mjs', '--dev']),
];
const stop = () => kids.forEach((k) => k.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

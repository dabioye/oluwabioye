// Local stand-in for Firebase Hosting + the API function, driven by the real firebase.json:
//   public site → http://localhost:3000   invite site → http://localhost:3001
// Serves the static builds in dist/ (run `npm run build` first) and sends /api, /media and /calendar
// to the Express app in ../functions. Data goes to a JSON file (../data) unless STORE=firestore.
//
//   node scripts/serve.mjs                 serve the builds
//   node scripts/serve.mjs --dev           proxy pages to `next dev` servers instead (hot reload)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.dirname(here);
const repo = path.dirname(web);
const require = createRequire(import.meta.url);

const PUBLIC_PORT = Number(process.env.PUBLIC_PORT || 3000);
const INVITE_PORT = Number(process.env.INVITE_PORT || 3001);
const DEV = process.argv.includes('--dev');
process.env.STORE ||= 'json';
process.env.DATA_DIR ||= path.join(repo, 'data');
process.env.ADMIN_PASSWORD ??= 'dev-password';
process.env.CHECKIN_PIN ??= '1234';
process.env.BASE_URL ||= `http://localhost:${PUBLIC_PORT}`;
process.env.INVITE_URL ||= `http://localhost:${INVITE_PORT}`;
const api = require(path.join(repo, 'functions', 'server.js'));

const hosting = JSON.parse(fs.readFileSync(path.join(repo, 'firebase.json'), 'utf8')).hosting;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
};

// Firebase glob/param source → RegExp with named groups.
function matcher(source) {
  const re = source
    .split(/(\*\*|\*|:[a-zA-Z]+)/)
    .map((part) =>
      part === '**' ? '.*' : part === '*' ? '[^/]*' : part.startsWith(':') ? `(?<${part.slice(1)}>[^/]+)` : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('');
  return new RegExp(`^${re}$`);
}

function serveFile(res, file, status = 200, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', ...extraHeaders });
  fs.createReadStream(file).pipe(res);
}

function proxy(req, res, port) {
  const p = http.request({ host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  p.on('error', () => {
    res.writeHead(502);
    res.end(`next dev on :${port} is not running`);
  });
  req.pipe(p);
}

function site(cfg, port, devPort) {
  const root = path.join(repo, cfg.public);
  const rewrites = (cfg.rewrites || []).map((r) => ({ ...r, re: matcher(r.source) }));
  const redirects = (cfg.redirects || []).map((r) => ({ ...r, re: matcher(r.source) }));
  const headers = (cfg.headers || []).map((h) => ({ ...h, re: matcher(h.source) }));

  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const p = decodeURIComponent(url.pathname);
    const extra = Object.fromEntries(headers.filter((h) => h.re.test(p)).flatMap((h) => h.headers.map((x) => [x.key, x.value])));

    for (const r of redirects) {
      const m = r.re.exec(p);
      if (!m) continue;
      // Locally the invite site lives on another port, not oluwabioye.dabioye.com.
      let to = r.destination.replace(/:([a-zA-Z]+)/g, (_, k) => m.groups?.[k] ?? `:${k}`);
      to = to.replace('https://oluwabioye.dabioye.com', process.env.INVITE_URL);
      res.writeHead(r.type || 301, { Location: to });
      return res.end();
    }

    // 1. A static file that exists wins (Hosting serves files before rewrites).
    if (!DEV) {
      const candidates = [p, cfg.cleanUrls ? `${p}.html` : null, path.join(p, 'index.html')].filter(Boolean);
      for (const c of candidates) {
        const f = path.join(root, c);
        if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile()) return serveFile(res, f, 200, extra);
      }
    }
    // 2. Rewrites: to the function, or to another file.
    for (const r of rewrites) {
      if (!r.re.test(p)) continue;
      if (r.function) {
        req.headers['x-forwarded-host'] = req.headers.host?.split(':')[0];
        return api(req, res);
      }
      if (DEV) return proxy(Object.assign(req, { url: r.destination.replace(/\.html$/, '') + url.search }), res, devPort);
      return serveFile(res, path.join(root, r.destination), 200, extra);
    }
    if (DEV) return proxy(req, res, devPort);
    // 3. Not found.
    const nf = path.join(root, '404.html');
    if (fs.existsSync(nf)) return serveFile(res, nf, 404, extra);
    res.writeHead(404);
    res.end('Not found');
  });
}

const byTarget = Object.fromEntries(hosting.map((h) => [h.target, h]));
site(byTarget.public, PUBLIC_PORT, 4000).listen(PUBLIC_PORT, () =>
  console.log(`public site  http://localhost:${PUBLIC_PORT}   (admin: /admin, password: ${process.env.ADMIN_PASSWORD})`),
);
site(byTarget.invite, INVITE_PORT, 4001).listen(INVITE_PORT, () =>
  console.log(`invite site  http://localhost:${INVITE_PORT}   (gate: /checkin, PIN: ${process.env.CHECKIN_PIN})`),
);
if (DEV) console.log('dev mode: pages come from `next dev` on :4000 (public) and :4001 (invite)');

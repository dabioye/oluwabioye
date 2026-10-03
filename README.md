# Sarah & Damilare · Wedding site and invitation desk

| URL | Who | What |
| --- | --- | --- |
| `/` | **Public** | Church wedding website: 10 AM ceremony at RCCG Garden of Peace, directions, add-to-calendar, story, colours, link to your **Joy gift registry**, contacts. No traditional-wedding details and no RSVP appear here. |
| `/i/CODE` | **Private**, only people you send a link to | Traditional wedding & reception invitation with the guest's name, RSVP, QR **access card** and **driver meal card**. Not linked anywhere, `noindex`, blocked in `robots.txt`, unguessable 6-character codes. |
| `/admin` | You two + planners | Invitation desk: traditional guest list, WhatsApp sending, sent → opened → RSVP → arrived tracking, CSV import/export. (The church RSVP list stays empty while the public RSVP is off: `churchRsvp.open` in `config.js`.) |
| `/checkin` | Ushers | Gate check-in for the traditional wedding: scan QR or search name. Ushers can't see the guest list. |

## Two domains

| Domain | Shows |
| --- | --- |
| `sarahanddamilare.dabioye.com` (`BASE_URL`) | Public church-wedding site (no RSVP), `/admin` |
| `oluwabioye.dabioye.com` (`INVITE_URL`) | Only personal invitations `/i/CODE`, access-card QR `/c/CODE` and the gate `/checkin`. Its front page just says "strictly by invitation". |

One Firebase Hosting site serves both: the app looks at the domain of each request. Invitation links on the public domain redirect to the invite domain. If `INVITE_URL` is not set, everything runs on one domain (handy for `*.web.app` and local dev).

## Hosting on Firebase (project `sarahanddamilare`, Blaze plan)

Day to day you don't deploy by hand: **every push to `main` is tested and deployed by GitHub Actions** (see below). You can also start a deploy from GitHub → Actions → "Test and deploy to Firebase" → **Run workflow**.

### Secrets (already set; change them like this)

The site reads three secrets from Secret Manager. To change one (for example the admin password), run it from a computer logged in with `firebase login`, then redeploy:

```bash
firebase functions:secrets:set ADMIN_PASSWORD --project sarahanddamilare   # /admin
firebase functions:secrets:set CHECKIN_PIN    --project sarahanddamilare   # ushers at /checkin
firebase functions:secrets:set SESSION_SECRET --project sarahanddamilare   # any long random string
firebase functions:secrets:access ADMIN_PASSWORD --project sarahanddamilare  # show the current value
```

Or in the browser: Google Cloud console → Security → **Secret Manager** → pick the secret → **New version**, then re-run the GitHub workflow.

### Custom domains (DNS at Namecheap)

Firebase console → Hosting → **Add custom domain**, once for `sarahanddamilare.dabioye.com` and once for `oluwabioye.dabioye.com`. Both go on the same Hosting site; the app picks the public or invite-only pages from the domain.

In Namecheap → Domain List → `dabioye.com` → **Manage** → **Advanced DNS**, add the records Firebase shows (usually an **A** record and a **TXT** record per subdomain, sometimes an `_acme-challenge` record). In the **Host** field type only the part before the domain (`sarahanddamilare`, `oluwabioye`, `_acme-challenge.oluwabioye`), not the full name. Delete any old record for the same host first. Back in Firebase click **Verify**; SSL is issued automatically, usually within an hour (up to 24 h).

### Auto-deploy from GitHub

`.github/workflows/deploy.yml` runs the tests on every push to `main` and deploys when the repo has a `FIREBASE_SERVICE_ACCOUNT` secret (it does). To set it up again, e.g. for a new project:

1. Google Cloud console → IAM & Admin → **Service accounts** → create `github-deploy` with these roles:
   **Firebase Admin**, **Cloud Functions Admin**, **Cloud Run Admin**, **Service Account User**, **Secret Manager Admin**, **Artifact Registry Administrator**, **Service Usage Consumer**.
2. As a project owner, enable the **Cloud Billing API** once (the deploy account may not enable it itself):
   https://console.cloud.google.com/apis/library/cloudbilling.googleapis.com?project=sarahanddamilare
3. Service account → **Keys** → Add key → JSON. Paste the whole file into GitHub → repo Settings → Secrets and variables → Actions → **New repository secret** `FIREBASE_SERVICE_ACCOUNT`. Then delete the downloaded file.
4. Optional repo variables `BASE_URL` / `INVITE_URL` override the two domains.

Without the secret, the workflow still runs the tests and skips the deploy.

### Deploying from your own computer (fallback)

Needs **Node 22** (the Firebase CLI loads the code with your local Node; Node 20 fails with `ERR_REQUIRE_ESM`) and **firebase-tools 15**:

```bash
# Node 22 via nvm (works on Intel and Apple Silicon Macs)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash   # then open a new terminal
nvm install 22
npm install -g firebase-tools@15
firebase login --reauth

cd functions && npm ci && cp .env.example .env && cd ..
firebase deploy --only hosting,functions,firestore --project sarahanddamilare
```

Troubleshooting:
- `Authentication Error` → `firebase login --reauth`.
- `An unexpected error has occurred` → look at the end of `firebase-debug.log`. `ConnectTimeoutError` there means a slow or filtered network: try `export NODE_OPTIONS="--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=2000"`, another network, or just run the GitHub workflow instead.
- `Permissions denied enabling <service>` → open the link it prints as a project owner and click **Enable**.

### Cost and notes
- Blaze is required for Cloud Functions. At this traffic it stays in the free allowance; set a $1 budget alert.
- Photos uploaded in the admin are stored in Firestore (resized in the browser to under 1 MB) and served from `/media/…` with a one-year CDN cache. No Storage bucket is needed.
- The session cookie is named `__session` because Firebase Hosting drops all other cookies.
- Firestore rules deny all browser access; only the function reads and writes.

## Editing the website without code

Sign in at `/admin` → **Edit website**. From your phone you can:
- upload the couple photo, gallery photos and story photos (resized automatically)
- replace the church and traditional invitation cards
- write Our Story (moments with dates, text and photos; reorder or delete)
- set the Joy registry link and message, RSVP deadline (shown on private invitations), notes for church guests
- turn the wax-seal opening on or off

Changes go live within about 15 seconds. `functions/src/config.js` still holds the fixed details (names, venues, times) and the defaults.

## Local development

```bash
cd functions && npm install
cp .env.local.example .env.local
npm run dev                   # http://localhost:3000, data in ./data/guests.json
npm test                      # end-to-end smoke test (JSON store)
npm run test:firestore        # same test against the Firestore emulator
firebase emulators:start      # full Hosting + Functions + Firestore locally
```

The app also still runs on any plain Node host (`STORE=json node server.js`).

## Editing details

Everything is in `functions/src/config.js`: families, events, venues, map links, RSVP date, contacts, story, **registryUrl** (your withjoy.com link), public notes, guest notes for the private invite, and the WhatsApp message. The weekday is calculated from `date`.

## Invitation card name slot

On private invitations each guest's name is written into the traditional card. If you upload a new card design, leave that space empty; adjust `invitationArt.nameSlot` in `config.js` if the name sits too high or low.

## Sending traditional invitations

1. Import your list (`guest-template.csv` shows the columns) or add guests one by one.
2. Filter **Not sent** and tap **Send next on WhatsApp**. The message reminds guests the link is personal.
3. For printed cards, set *Send via → Printed card* and tick **Card given**.
4. Chase **Sent, not opened** and **Opened, no reply** before the RSVP date.

## On the day

Give ushers `/checkin` and the PIN. Green = welcome, amber = card already used, red = not on the list or declined.

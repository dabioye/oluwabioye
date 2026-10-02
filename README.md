# Sarah & Damilare · Wedding site and invitation desk

| URL | Who | What |
| --- | --- | --- |
| `/` | **Public** | Church wedding website: 10 AM ceremony at RCCG Garden of Peace, directions, add-to-calendar, story, colours, open **church RSVP**, link to your **Joy gift registry**, contacts. No traditional-wedding details appear here. |
| `/i/CODE` | **Private**, only people you send a link to | Traditional wedding & reception invitation with the guest's name, RSVP, QR **access card** and **driver meal card**. Not linked anywhere, `noindex`, blocked in `robots.txt`, unguessable 6-character codes. |
| `/admin` | You two + planners | Invitation desk: traditional guest list, WhatsApp sending, sent → opened → RSVP → arrived tracking, CSV import/export, **church RSVP list** with headcount and export. |
| `/checkin` | Ushers | Gate check-in for the traditional wedding: scan QR or search name. Ushers can't see the guest list. |

## Two domains

| Domain | Shows |
| --- | --- |
| `sarahanddamilare.dabioye.com` (`BASE_URL`) | Public church-wedding site, church RSVP, `/admin` |
| `oluwabioye.dabioye.com` (`INVITE_URL`) | Only personal invitations `/i/CODE`, access-card QR `/c/CODE` and the gate `/checkin`. Its front page just says "strictly by invitation". |

One Firebase Hosting site serves both: the app looks at the domain of each request. Invitation links on the public domain redirect to the invite domain. If `INVITE_URL` is not set, everything runs on one domain (handy for `*.web.app` and local dev).

## Hosting on Firebase (project `sarahanddamilare`, Blaze plan)

One-time setup:

```bash
npm i -g firebase-tools && firebase login
cd functions && npm ci && cp .env.example .env && cd ..
firebase functions:secrets:set ADMIN_PASSWORD     # /admin
firebase functions:secrets:set CHECKIN_PIN        # ushers at /checkin
firebase functions:secrets:set SESSION_SECRET     # any long random string
firebase deploy --only hosting,functions,firestore
```

Custom domains: Firebase console → Hosting → **Add custom domain**, once for `sarahanddamilare.dabioye.com` and once for `oluwabioye.dabioye.com`. Add the DNS records it shows at your DNS provider. SSL is issued automatically, usually within an hour (up to 24 h).

### Auto-deploy from GitHub (optional)

`.github/workflows/deploy.yml` runs the tests on every push to `main` and deploys if the repo has a `FIREBASE_SERVICE_ACCOUNT` secret:

1. Google Cloud console → IAM → Service accounts → create `github-deploy` with roles **Firebase Admin**, **Cloud Functions Admin**, **Cloud Run Admin**, **Service Account User**, **Secret Manager Viewer**, **Artifact Registry Administrator**.
2. Create a JSON key for it and paste the whole JSON into GitHub → repo Settings → Secrets and variables → Actions → **New repository secret** `FIREBASE_SERVICE_ACCOUNT`.
3. Optional repo variables `BASE_URL` / `INVITE_URL` override the two domains.

Without the secret, the workflow still runs the tests and skips the deploy.

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
- set the Joy registry link and message, RSVP deadline, notes for church guests
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

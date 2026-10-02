# Sarah & Damilare · Wedding site and invitation desk

| URL | Who | What |
| --- | --- | --- |
| `/` | **Public** | Church wedding website: 10 AM ceremony at RCCG Garden of Peace, directions, add-to-calendar, story, colours, open **church RSVP**, link to your **Joy gift registry**, contacts. No traditional-wedding details appear here. |
| `/i/CODE` | **Private**, only people you send a link to | Traditional wedding & reception invitation with the guest's name, RSVP, QR **access card** and **driver meal card**. Not linked anywhere, `noindex`, blocked in `robots.txt`, unguessable 6-character codes. |
| `/admin` | You two + planners | Invitation desk: traditional guest list, WhatsApp sending, sent → opened → RSVP → arrived tracking, CSV import/export, **church RSVP list** with headcount and export. |
| `/checkin` | Ushers | Gate check-in for the traditional wedding: scan QR or search name. Ushers can't see the guest list. |

## Hosting on Firebase

Firebase Hosting serves `public/` and forwards everything else to one Cloud Function (`functions/`) running the Express app. Data lives in Firestore.

**Plan:** Cloud Functions needs the **Blaze (pay-as-you-go)** plan. At wedding-site traffic you'll stay inside the free allowance (about 2 million function calls a month and 50,000 Firestore reads a day are free), so expect ₦0 or a few cents. The admin page refreshes every minute while open, and each refresh reads every guest, so close the tab when you are done. Set a budget alert of $1 to be safe.

### One-time setup

```bash
npm i -g firebase-tools
firebase login
# In the Firebase console: create a project, upgrade to Blaze, create a Firestore database (europe-west1 recommended).
cd wedding-site
# put your project id in .firebaserc
cd functions && npm install && cp .env.example .env && cd ..
firebase functions:secrets:set ADMIN_PASSWORD     # for /admin
firebase functions:secrets:set CHECKIN_PIN        # for ushers at /checkin
firebase functions:secrets:set SESSION_SECRET     # any long random string
firebase deploy --only hosting,functions,firestore
```

### Custom domain

Firebase console → Hosting → **Add custom domain** → `sarahanddamilare.dabioye.com`. Add the records it shows at your DNS provider for dabioye.com. The SSL certificate is issued automatically (can take up to 24 h). Make sure `BASE_URL` in `functions/.env` matches, then redeploy functions.

### Notes
- The session cookie is named `__session` because Firebase Hosting drops all other cookies.
- Firestore rules deny all browser access; only the function (Admin SDK) reads and writes.
- Backups: Firestore console → Import/Export, or just use **Export guests** and **Church RSVPs → Export** in `/admin` before the day.

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

## Photos, story and the opening

- **Couple photo:** save a portrait photo as `public/img/couple.jpg` (at least 1200px tall) and set `hero.photo: '/img/couple.jpg'` in config. Add a short `hero.note`.
- **Gallery:** drop photos into `public/img/gallery/` and list them in `gallery`. The first photo shows large.
- **Our Story:** edit the four `story` milestones. Each can have an optional `photo` from `public/img/story/`.
- **Invitation cards:** `public/img/invite-church.jpg` and `invite-trad.jpg` were cut from your design. The trad card has the sample name removed, and each guest's name is set into it. Replace them with full-resolution exports when you have them. If the name position shifts, adjust `invitationArt.nameSlot`.
- **Wax-seal opening:** shown once per visit on the homepage and on private invites. Switch either off in `intro`.
- Compress photos before adding them (about 300 KB each). Firebase Hosting serves them from its CDN.

## Sending traditional invitations

1. Import your list (`guest-template.csv` shows the columns) or add guests one by one.
2. Filter **Not sent** and tap **Send next on WhatsApp**. The message reminds guests the link is personal.
3. For printed cards, set *Send via → Printed card* and tick **Card given**.
4. Chase **Sent, not opened** and **Opened, no reply** before the RSVP date.

## On the day

Give ushers `/checkin` and the PIN. Green = welcome, amber = card already used, red = not on the list or declined.

# Sarah & Damilare · Wedding site and invitation desk

Two static websites (Next.js + Tailwind + shadcn/ui) on Firebase Hosting, with one Cloud Function as the JSON API and Firestore for data.

| Address | Who | What |
| --- | --- | --- |
| `sarahanddamilare.dabioye.com` | **Public** | Church wedding website: ceremony details, directions, add-to-calendar, Our Story, gallery, the printed church invitation, **Joy gift registry**, contacts. No traditional-wedding details and no RSVP. |
| `sarahanddamilare.dabioye.com/admin` | You two + planners | Invitation desk (guest list, WhatsApp sending, sent → opened → RSVP → arrived tracking, CSV import/export) and **Edit website**. |
| `oluwabioye.dabioye.com` | Invited guests | Front page asks for the **6-character invitation code** (with "Remember me on this device"). Nothing about the event shows without a code. |
| `oluwabioye.dabioye.com/i/CODE` | One guest | Their traditional wedding & reception invitation with their name on the card, RSVP, QR **access card** and **driver meal card**. |
| `oluwabioye.dabioye.com/checkin` | Ushers | Gate check-in: scan the QR or search a name. Ushers can't see the guest list. |

### How it fits together

- `web/` — the Next.js app, exported as **two static sites**. Pages named `page.public.tsx` go only to the public site, `page.invite.tsx` only to the invite site, `*.shared.tsx` to both. Files in `web/site-assets/<site>/` are copied into that site only (the traditional invitation card never ships on the public domain).
- `functions/` — the API (`/api/**`, `/media/**`, `/calendar/**`), reached through Firebase Hosting rewrites on both sites. `functions/src/config.js` holds the wedding details for both the API and the pages.
- `firebase.json` — two Hosting targets: `public` → site `sarahanddamilare`, `invite` → site `oluwabioye-invite` (see `.firebaserc`). Every `/i/CODE` and `/c/CODE` is served by one static page that reads the code in the browser.
- Wrong invitation codes are limited to 10 per visitor per 15 minutes (counted in Firestore); right codes never count.

## Hosting on Firebase (project `sarahanddamilare`, Blaze plan)

Day to day you don't deploy by hand: **every push to `main` is tested and deployed by GitHub Actions** (see below). You can also start a deploy from GitHub → Actions → "Test and deploy to Firebase" → **Run workflow**.

### Secrets (already set; change them like this)

The site reads six secrets from Secret Manager (all six must exist, or the deploy fails). To change one (for example the admin password), run it from a computer logged in with `firebase login`, then redeploy:

```bash
firebase functions:secrets:set ADMIN_PASSWORD --project sarahanddamilare   # /admin
firebase functions:secrets:set CHECKIN_PIN    --project sarahanddamilare   # ushers at /checkin
firebase functions:secrets:set SESSION_SECRET --project sarahanddamilare   # any long random string
firebase functions:secrets:set WHATSAPP_TOKEN        --project sarahanddamilare   # see "WhatsApp Business" below
firebase functions:secrets:set WHATSAPP_APP_SECRET   --project sarahanddamilare
firebase functions:secrets:set WHATSAPP_VERIFY_TOKEN --project sarahanddamilare
firebase functions:secrets:access ADMIN_PASSWORD --project sarahanddamilare  # show the current value
```

Or in the browser: Google Cloud console → Security → **Secret Manager** → pick the secret → **New version**, then re-run the GitHub workflow.

### Custom domains (DNS at Namecheap)

Each domain belongs to its own Hosting site: in the Firebase console → Hosting, open site **sarahanddamilare** → **Add custom domain** → `sarahanddamilare.dabioye.com`, and site **oluwabioye-invite** → `oluwabioye.dabioye.com`.

In Namecheap → Domain List → `dabioye.com` → **Manage** → **Advanced DNS**, add the records Firebase shows (usually an **A** record and a **TXT** record per subdomain, sometimes an `_acme-challenge` record). In the **Host** field type only the part before the domain (`sarahanddamilare`, `oluwabioye`, `_acme-challenge.oluwabioye`), not the full name. Delete any old record for the same host first. Back in Firebase click **Verify**; SSL is issued automatically, usually within an hour (up to 24 h).

### Auto-deploy from GitHub

`.github/workflows/deploy.yml` runs every check on each pull request and push (API tests, lint, types, unit tests, both builds and browser tests), and deploys on pushes to `main` when the repo has a `FIREBASE_SERVICE_ACCOUNT` secret (it does). **Actions → Test and deploy to Firebase → Run workflow** deploys by hand; the optional *What to deploy* box takes a `firebase deploy --only` value such as `hosting:invite`. To set it up again, e.g. for a new project:

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
cd web && npm ci && npm run build && cd ..
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

Changes go live within about a minute (the pages cache the content briefly). `functions/src/config.js` still holds the fixed details (names, venues, times) and the defaults.

## Local development

Needs Node 22.

```bash
cd functions && npm ci && cd ../web && npm ci

npm run dev        # hot reload: public site http://localhost:3000, invite site http://localhost:3001
npm run preview    # build both sites, then serve them exactly as Firebase Hosting would
```

Locally the admin password is `dev-password` and the gate PIN is `1234`; data goes to `./data/guests.json`. `web/scripts/serve.mjs` reads the real `firebase.json`, so redirects and rewrites behave as they do on Firebase.

Checks (all run in GitHub Actions too):

```bash
cd functions && npm test           # API tests (npm run test:firestore runs them on the Firestore emulator)
cd web && npm run lint && npm run typecheck && npm run format:check
cd web && npm test                 # unit tests
cd web && npm run build && npm run test:e2e   # browser tests against both built sites
```

## Editing details

Everything is in `functions/src/config.js`: families, events, venues, map links, RSVP date, contacts, story, **registryUrl** (your withjoy.com link), public notes, guest notes for the private invite, and the WhatsApp message. The weekday is calculated from `date`.

## Invitation card name slot

On private invitations each guest's name is written into the traditional card; long names go on two smaller lines. If you upload a new card design, leave that space empty; adjust `invitationArt.nameSlot` in `config.js` if the name sits too high or low.

## WhatsApp Business (Cloud API, from +234 807 269 2636)

Invitations can go out from the couple's WhatsApp Business number without opening WhatsApp:
- **Send · WhatsApp** on a guest shows exactly what they'll get (their card and the message), then sends it.
- **Send all pending via WhatsApp** works through everyone who hasn't had theirs.
- Each guest shows how far their invite got: blue = queued/sent, green = delivered, solid green = read, red = failed, with the reason.
- **Inbox** (`/admin/inbox`) collects guests' replies. You can answer in free text for 24 hours after the guest's last message (WhatsApp's rule). After that, answer from the phone.
- Every reply also sends an alert to your own phone.

Until it's connected, the desk works as before: it opens WhatsApp with the message, then shares the card.

### 1. Templates (WhatsApp Manager → Message templates → Create)

The site reads each template from Meta (language, image header, variables, button), so you can edit the wording later without a code change.

**`oluwabioye_invitation`** (approved, Marketing). If its header is an **Image**, each guest's personalised card is sent as that image. Without an image header, the message goes out on its own. The body variables are filled by their sample values: a name sample gets the guest's name, and a date sample gets the RSVP date. A dynamic **View invitation** button `https://oluwabioye.dabioye.com/i/{{1}}` gets the guest's code.

**`guest_reply_alert`** (Utility, English), the alert sent to your own phone when a guest replies:
- **Body:**
  ```
  New reply: {{1}} replied to their invitation: {{2}}. Open the inbox to answer.
  ```
  Samples: `{{1}}` = `Tope Omidiji`, `{{2}}` = `Thank you, we'll be there!`

  Meta rejects templates whose body starts or ends with a variable. That's why the requested text "{{1}} replied to their invitation: {{2}}" has a few words around it.
- **Button:** Visit website · text `Open inbox` · **Static** URL `https://sarahanddamilare.dabioye.com/admin/inbox`.

  A dynamic URL `https://sarahanddamilare.dabioye.com/{{1}}` also works (sample `https://sarahanddamilare.dabioye.com/admin/inbox`). It opens straight on that guest's conversation.

### 2. Secrets and settings

| What | Where |
| --- | --- |
| `WHATSAPP_TOKEN`: permanent System User token (expiry **Never**) with `whatsapp_business_messaging` and `whatsapp_business_management` | Secret |
| `WHATSAPP_APP_SECRET`: Meta app → App settings → Basic → **App secret** (signs the webhook) | Secret |
| `WHATSAPP_VERIFY_TOKEN`: any random string you make up, also typed into Meta in step 3 | Secret |
| `WHATSAPP_ALERT_TO`: your personal number for reply alerts, e.g. `0803…` or `+44…` | GitHub repo **variable** (Settings → Secrets and variables → Actions → Variables) |
| `WHATSAPP_PHONE_ID`: already in `functions/src/config.js` (`1170328419507856`); a variable of the same name overrides it | optional variable |

A secret you aren't ready to use can be set to `none`; that feature then stays off. The desk's **WhatsApp Business** panel shows the following, and says plainly if anything needs fixing:
- the number and its quality rating;
- the template and whether it's approved;
- whether the token expires.

### 3. Webhook (receipts and replies)

Meta app → WhatsApp → Configuration → Webhook:
- **Callback URL:** `https://sarahanddamilare.dabioye.com/api/whatsapp/webhook`
- **Verify token:** the same `WHATSAPP_VERIFY_TOKEN`
- **Subscribe** to the **messages** field. That one field carries both delivery receipts and guests' replies.

### 4. Turn it on

1. Test with **Send · WhatsApp** on a guest entry with your own number.
2. Optionally tick **Edit website → WhatsApp invitations → Send automatically**. Guests are then sent their invitation as soon as they're added or imported. With an image template, the server draws each guest's personalised card (`functions/src/card.js`, laid out exactly like the desk's card), so automatic sends and **Send all pending** include it too. Only guests invited to the traditional wedding are sent the card template.
3. Use **Send all pending via WhatsApp** for everyone else. Guests marked "Printed card" or who declined are skipped.

A new WhatsApp Business account can message about 250 people a day, which covers the whole guest list.

## Sending traditional invitations

1. Import your list (`guest-template.csv` shows the columns) or add guests one by one.
2. With WhatsApp Business connected (above), tap **Send all pending via WhatsApp**, or **Send · WhatsApp** on a guest. Without it, filter **Not sent** and tap **Send next on WhatsApp** (or **Send · WhatsApp** on a guest). Guests invited to the traditional wedding get their **personalised card** (their name and access code on the card) as well as the message. WhatsApp opens the guest's chat with the message ready, so send it. On a phone, come back to the desk and tap **Share card**, pick WhatsApp, then the guest (top of your recent chats). On a laptop the card is downloaded instead, so attach it in the chat. WhatsApp can't take an image and a caption from a link, and drops the text when an image is shared, so they go as two messages. **Card** downloads a guest's card on its own. The message reminds guests the link is personal. Guests who lose the link can type their code (the last 6 characters of the link) on `oluwabioye.dabioye.com`.
3. For printed cards, set *Send via → Printed card* and tick **Card given**.
4. Chase **Sent, not opened** and **Opened, no reply** before the RSVP date.

## On the day

Give ushers `/checkin` and the PIN. Green = welcome, amber = card already used, red = not on the list or declined.

## Switching from the old single site (one time)

The old site ran everything from one Hosting site and a function called `app`. The new one uses two Hosting sites and a function called `api`. To switch without breaking invitation links:

1. **Create the invite site:** `firebase hosting:sites:create oluwabioye-invite --project sarahanddamilare` (or Firebase console → Hosting → *Add another site*).
2. **Deploy the API and the invite site only:** Actions → Run workflow on this branch with *What to deploy* = `functions:api,hosting:invite`. The old site keeps working (it still uses `app`). Test at `https://oluwabioye-invite.web.app`.
3. **Move the invite domain:** Firebase console → Hosting → site *sarahanddamilare* → remove `oluwabioye.dabioye.com`; then site *oluwabioye-invite* → *Add custom domain* → `oluwabioye.dabioye.com`, and update the Namecheap records it shows. Wait for **Connected**. (Links on that domain may not open until the certificate is issued, usually under an hour.)
4. **Merge the pull request.** The push to `main` deploys everything: the new public site goes live and the old `app` function is removed.

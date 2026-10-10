// Firebase entry point: the JSON API behind both static sites (see firebase.json rewrites).
process.env.STORE = 'firestore';

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

// Set once with:  firebase functions:secrets:set ADMIN_PASSWORD   (and the others)
// WhatsApp: WHATSAPP_TOKEN (permanent system-user token), WHATSAPP_APP_SECRET (Meta app secret, signs webhooks),
// WHATSAPP_VERIFY_TOKEN (any string you choose for webhook setup); SMTP_PASS (the email account's password
// or app password, for email invitations). Set any of them to "none" until you're ready.
const secrets = ['ADMIN_PASSWORD', 'CHECKIN_PIN', 'SESSION_SECRET', 'WHATSAPP_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'SMTP_PASS'].map(defineSecret);

const app = require('./server');

exports.api = onRequest(
  { region: 'europe-west1', secrets, memory: '256MiB', concurrency: 40, maxInstances: 5, timeoutSeconds: 300 },
  app,
);

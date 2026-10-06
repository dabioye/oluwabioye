// Firebase entry point: the JSON API behind both static sites (see firebase.json rewrites).
process.env.STORE = 'firestore';

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

// Set once with:  firebase functions:secrets:set ADMIN_PASSWORD   (and the other two)
const secrets = ['ADMIN_PASSWORD', 'CHECKIN_PIN', 'SESSION_SECRET'].map(defineSecret);

const app = require('./server');

exports.api = onRequest(
  { region: 'europe-west1', secrets, memory: '256MiB', concurrency: 40, maxInstances: 5, timeoutSeconds: 30 },
  app,
);

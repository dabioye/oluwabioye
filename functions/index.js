// Firebase entry point: the whole Express app runs as one HTTPS function behind Firebase Hosting.
process.env.STORE = 'firestore';

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

// Set once with:  firebase functions:secrets:set ADMIN_PASSWORD   (and the other two)
const secrets = ['ADMIN_PASSWORD', 'CHECKIN_PIN', 'SESSION_SECRET'].map(defineSecret);

const app = require('./server');

exports.app = onRequest(
  { region: 'europe-west1', secrets, memory: '256MiB', concurrency: 40, maxInstances: 5, timeoutSeconds: 30 },
  app,
);

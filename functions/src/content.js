// Site content that can be edited from /admin/site. Defaults come from config.js;
// saved edits are merged over them when read (cached briefly per instance).
const cfg = require('./config');
const store = require('./store');

const defaults = JSON.parse(JSON.stringify({
  hero: cfg.hero, story: cfg.story, gallery: cfg.gallery, registryUrl: cfg.registryUrl,
  giftsMessage: cfg.gifts.message, publicNotes: cfg.publicNotes, rsvpBy: cfg.rsvpBy,
  invitationArt: { church: cfg.invitationArt.church, trad: cfg.invitationArt.trad }, intro: cfg.intro,
  waAutoSend: false,
  nameFont: 'Pinyon Script',
}));

const str = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const url = (v) => {
  const s = str(v, 500);
  return /^(https:\/\/|\/media\/|\/img\/)/.test(s) || s === '' ? s : '';
};

// Whitelist + clean everything coming from the admin form.
function sanitize(input = {}) {
  const out = {};
  if (input.hero) out.hero = { photo: url(input.hero.photo), note: str(input.hero.note, 300) };
  if (Array.isArray(input.story)) out.story = input.story.slice(0, 20).map((m) => ({ when: str(m.when, 60), title: str(m.title, 120), text: str(m.text, 1500), photo: url(m.photo) })).filter((m) => m.title || m.text);
  if (Array.isArray(input.gallery)) out.gallery = input.gallery.slice(0, 60).map((g) => ({ src: url(g.src), caption: str(g.caption, 120) })).filter((g) => g.src);
  if ('registryUrl' in input) out.registryUrl = /^https:\/\//.test(str(input.registryUrl)) ? str(input.registryUrl, 500) : '';
  if ('giftsMessage' in input) out.giftsMessage = str(input.giftsMessage, 500);
  if (Array.isArray(input.publicNotes)) out.publicNotes = input.publicNotes.map((n) => str(n, 300)).filter(Boolean).slice(0, 10);
  if ('rsvpBy' in input && /^\d{4}-\d{2}-\d{2}$/.test(str(input.rsvpBy))) out.rsvpBy = str(input.rsvpBy);
  if (input.invitationArt) out.invitationArt = { church: url(input.invitationArt.church), trad: url(input.invitationArt.trad) };
  if (input.intro) out.intro = { home: !!input.intro.home, invite: !!input.intro.invite };
  if ('waAutoSend' in input) out.waAutoSend = !!input.waAutoSend;
  if (cfg.nameFonts.includes(input.nameFont)) out.nameFont = input.nameFont;
  return out;
}

let cache = null;
let cachedAt = 0;

async function current() {
  if (!cache || Date.now() - cachedAt > 15000) {
    cache = { ...defaults, ...(await store.getSettings()) };
    cachedAt = Date.now();
  }
  return cache;
}

// What the public church site may see. Nothing about the traditional wedding goes in here.
function publicView(c) {
  return {
    hero: { photo: c.hero?.photo || '', note: c.hero?.note || '' },
    story: c.story || [],
    gallery: c.gallery || [],
    registryUrl: c.registryUrl || '',
    giftsMessage: c.giftsMessage || '',
    publicNotes: c.publicNotes || [],
    rsvpBy: c.rsvpBy,
    invitationArt: { church: c.invitationArt?.church || defaults.invitationArt.church },
    intro: { home: c.intro?.home !== false },
  };
}

// Extra content for a private traditional-wedding invitation.
function inviteView(c) {
  return {
    art: c.invitationArt?.trad || defaults.invitationArt.trad,
    nameSlot: cfg.invitationArt.nameSlot,
    codeSlot: cfg.invitationArt.codeSlot,
    notes: cfg.notes,
    rsvpBy: c.rsvpBy,
    intro: c.intro?.invite !== false,
    registryUrl: c.registryUrl || '',
    nameFont: c.nameFont || defaults.nameFont,
  };
}

async function save(input) {
  const merged = { ...(await store.getSettings()), ...sanitize(input) };
  await store.saveSettings(merged);
  cache = null;
  return { ...defaults, ...merged };
}

module.exports = { current, save, sanitize, publicView, inviteView, defaults };

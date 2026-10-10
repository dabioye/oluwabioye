// Enquiries from the "Let us create your own event site" form: checked and cleaned here, then saved and emailed.
const EVENTS = ['Wedding', 'Birthday', 'Burial', 'Baby shower', 'Other'];
const FEATURES = [
  'Personalised invitations',
  'RSVP and guest list',
  'WhatsApp and email invitations',
  'Access cards and gate check-in',
  'Gallery and story',
  'Gift registry',
];

const str = (v, max) => String(v ?? '').trim().slice(0, max);

/** A clean enquiry, or { error } explaining what to fix. */
function clean(input = {}) {
  const lead = {
    name: str(input.name, 120),
    email: str(input.email, 160),
    phone: str(input.phone, 40),
    event: EVENTS.includes(input.event) ? input.event : '',
    otherEvent: str(input.otherEvent, 120),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(input.date, 10)) ? str(input.date, 10) : '',
    location: str(input.location, 160),
    guests: Math.max(0, Math.min(100000, parseInt(input.guests, 10) || 0)),
    features: (Array.isArray(input.features) ? input.features : []).filter((f) => FEATURES.includes(f)),
    budget: str(input.budget, 80),
    details: str(input.details, 3000),
    contactBy: ['WhatsApp', 'Phone call', 'Email'].includes(input.contactBy) ? input.contactBy : '',
    from: str(input.from, 200),
  };
  if (!lead.name) return { error: 'Please tell us your name.' };
  if (!lead.email && !lead.phone) return { error: 'Please add an email address or phone number so we can reach you.' };
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return { error: 'That email address doesn’t look right.' };
  if (!lead.event) return { error: 'Please choose the kind of event.' };
  if (lead.event === 'Other' && !lead.otherEvent) return { error: 'Please tell us what kind of event it is.' };
  return { lead };
}

const eventName = (l) => (l.event === 'Other' ? l.otherEvent : l.event);

module.exports = { EVENTS, FEATURES, clean, eventName };

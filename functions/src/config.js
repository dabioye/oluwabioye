// All wedding details live here. Edit this file, restart the server, done.
// Dates are Lagos time (WAT, UTC+1).

module.exports = {
  couple: {
    bride: 'Sarah',
    groom: 'Damilare',
    brideFull: 'Oluwafunmilayo Sarah',
    groomFull: 'Oluwadamilare David',
    monogram: 'SD',
    hashtag: 'The Making of Oluwabioye',
    surname: 'Oluwabioye',
  },

  families: {
    bride: 'Deacon Paul & Deaconess Grace Ahmed',
    groom: 'Late Engr. Abiodun & Mrs Jennifer Abioye',
  },

  // Wedding day. The weekday on every page is calculated from this date.
  date: '2026-12-17',

  events: {
    church: {
      key: 'church',
      name: 'Wedding Ceremony',
      time: '10:00 AM',
      startsAt: '2026-12-17T10:00:00+01:00',
      venue: 'The Redeemed Christian Church of God',
      venueLine2: 'Garden of Peace, Region 52 Headquarters',
      address: '78/80 Falolu Road, Surulere, Lagos',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=78%2F80%20Falolu%20Road%2C%20Surulere%2C%20Lagos',
    },
    trad: {
      key: 'trad',
      name: 'Traditional Wedding & Reception',
      time: '2:00 PM',
      startsAt: '2026-12-17T14:00:00+01:00',
      venue: 'SCFN Multipurpose Hall',
      venueLine2: 'Sickle Cell Foundation Nigeria Centre',
      address: 'Ishaga Rd, Idi-Araba, Surulere, Lagos 101241',
      mapUrl: 'https://maps.google.com/?q=Sickle+Cell+Foundation+Nigeria+Idi-Araba+Surulere+Lagos',
    },
  },

  colours: [
    { name: 'Navy', hex: '#14213A' },
    { name: 'Champagne Gold', hex: '#C9A56B' },
  ],

  rsvpBy: '2026-11-30',

  contacts: [
    { name: 'Busayo', phone: '+234 808 806 8669' },
    { name: 'Hope', phone: '+234 817 541 6843' },
  ],

  // Shown on the public homepage (church wedding). Keep traditional-wedding details out of here.
  publicNotes: [
    // e.g. 'Please be seated by 9:45 AM.'
  ],

  // Public RSVP for the church wedding. Off: RSVPs are only taken on private invitations (/i/CODE).
  // Set open: true to bring the RSVP form back on the public site.
  churchRsvp: { open: false, maxParty: 6 },

  // Gift registry on withjoy.com. Paste your registry link here.
  registryUrl: '',

  // Shown only on private traditional-wedding invitations (/i/CODE).
  notes: [
    'Strictly by invitation. Please bring your access card (printed or on your phone).',
    'Each access card admits one guest.',
    'No children, please.',
    'If you are coming with a driver, a driver meal card will be provided on request.',
  ],

  // Add the couple's story here when the final copy is ready.
  story: [],

  // Full-screen couple photo at the top of the homepage. Leave photo '' to use the monogram header.
  hero: {
    photo: '', // e.g. '/img/couple.jpg' (portrait, at least 1200px tall)
    note: '',  // short personal welcome, e.g. 'We can’t wait to celebrate with you.'
  },

  // Gallery. Put photos in public/img/gallery/ and list them here.
  gallery: [
    // { src: '/img/gallery/01.jpg', caption: 'Lekki, 2024' },
  ],

  // Wax-seal envelope opening, shown once per visit.
  intro: { home: true, invite: true },

  // Your designed invitation cards. On private invites the guest's name is set into the trad card.
  invitationArt: {
    church: '/img/invite-church.jpg',
    trad: '/img/invite-trad.jpg',
    // Where the guest's name sits on the trad card (% from top, size in % of card width): the gap under "Cordially invites".
    nameSlot: { top: 21.75, maxSize: 7.6 },
    // Where the guest's access code is written, under "Access Code:" (% from top and left, size in % of card width).
    codeSlot: { top: 78.9, left: 30.8, size: 3.6 },
  },

  // Gifts section on the homepage. Shows the registry button plus any accounts listed here.
  gifts: {
    message: 'Your presence is the greatest gift. We are grateful for your love and support.',
    accounts: [
      // { bank: 'Wema Bank', name: 'Oluwadamilare Abioye', number: '0000000000' },
    ],
  },

  // WhatsApp / SMS invitation text. {name}, {link}, {rsvpBy} are filled in per guest.
  // This is for the private traditional wedding invitation.
  inviteMessage:
    'Dear {name},\n\nSarah & Damilare joyfully invite you to The Making of Oluwabioye, our traditional wedding and reception, on {weekday}, 17 December 2026 at 2:00 PM in Lagos.\n\nThis invitation is personal to you. Please don\'t share the link.\nYour invitation, RSVP and access card: {link}\n\nKindly RSVP by {rsvpBy}.\n\n#TheMakingOfOluwabioye',
};

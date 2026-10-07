import type { EventKey, GalleryPhoto, StoryMoment } from './config';

export type Rsvp = 'pending' | 'yes' | 'no';
export type Channel = 'whatsapp' | 'sms' | 'email' | 'physical';
export type Side = 'bride' | 'groom' | 'both';

/** Editable content the public site reads from /api/content. */
export type PublicContent = {
  hero: { photo: string; note: string };
  story: StoryMoment[];
  gallery: GalleryPhoto[];
  registryUrl: string;
  giftsMessage: string;
  publicNotes: string[];
  rsvpBy: string;
  invitationArt: { church: string };
  intro: { home: boolean };
};

/** A guest as their own invitation sees them. */
export type InviteGuest = { name: string; code: string; events: EventKey[]; rsvp: Rsvp; rsvpNote: string; driverCard: boolean };
export type InviteData = {
  guest: InviteGuest;
  qrSvg: string;
  invite: {
    art: string;
    nameSlot: { top: number; maxSize: number };
    codeSlot: { top: number; left: number; size: number };
    notes: string[];
    rsvpBy: string;
    intro: boolean;
    /** The couple's gift registry (external), if set. */
    registryUrl: string;
    /** Script font for the guest's name on the card. */
    nameFont: string;
  };
  /** The public wedding website, for the link back to it. */
  publicUrl: string;
};

/** What an automatic WhatsApp send did, when adding or importing guests. */
export type WhatsAppResult = { ok: boolean; id?: string; error?: string };
export type WhatsAppBatch = { sent: number; failed: string[] };

/** A guest as the invitation desk sees them. */
export type Guest = {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  side: Side;
  group: string;
  events: EventKey[];
  driverCard: boolean;
  channel: Channel;
  table: string;
  notes: string;
  cardDelivered: boolean;
  sentAt: string | null;
  openedAt: string | null;
  openCount: number;
  rsvp: Rsvp;
  rsvpAt: string | null;
  rsvpNote: string;
  checkedInAt: string | null;
  createdAt: string;
  link: string;
  message: string;
  /** WhatsApp Business: the message id of the invitation, how far it got, and why it failed. */
  waMessageId?: string;
  waStatus?: 'accepted' | 'sent' | 'delivered' | 'read' | 'failed';
  waError?: string;
  waSentAt?: string;
  waReadAt?: string;
};

/** GET /api/admin/whatsapp: whether invitations can go out through WhatsApp Business. */
export type WhatsAppStatus = {
  ready: boolean;
  configured: boolean;
  autoSend?: boolean;
  problems?: string[];
  token?: { valid?: boolean; expiresAt?: string | null; error?: string };
  phone?: { display_phone_number?: string; verified_name?: string; quality_rating?: string; error?: string };
  template?: {
    name: string;
    language: string;
    status: string;
    /** True when the template couldn't be read from Meta and the README layout is assumed. */
    fallback?: boolean;
    category: string;
    header: string;
    needsImage: boolean;
    body: string;
    footer: string;
    buttons: { type: string; text: string; url: string }[];
  };
  /** The message as the guest asked about (?guest=id) will read it. */
  preview?: string;
};
export type Activity = { at: string; type: string; guestId: string | null; name: string; extra: string };
export type ChurchRsvp = {
  id: string;
  name: string;
  phone: string;
  email: string;
  attending: 'yes' | 'no';
  party: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** Everything the website editor can change (GET/PUT /api/admin/site). */
export type SiteSettings = {
  hero: { photo: string; note: string };
  story: StoryMoment[];
  gallery: GalleryPhoto[];
  registryUrl: string;
  giftsMessage: string;
  publicNotes: string[];
  rsvpBy: string;
  invitationArt: { church: string; trad: string };
  intro: { home: boolean; invite: boolean };
  /** Send the WhatsApp invitation as soon as a guest is added or imported. */
  waAutoSend?: boolean;
  /** Script font for guests' names on the traditional card. */
  nameFont?: string;
  /** Read-only: the invite site, where the traditional card is served from. */
  inviteUrl?: string;
};

export type Role = 'admin' | 'checkin' | null;

/** WhatsApp conversations (GET /api/admin/inbox and /api/admin/inbox/:thread). */
export type InboxMessage = {
  id: string;
  thread: string;
  dir: 'in' | 'out';
  type: string;
  text: string;
  at: string;
  name: string;
  status?: 'accepted' | 'sent' | 'delivered' | 'read' | 'failed';
  error?: string;
};
export type InboxThread = {
  thread: string;
  guestId: string | null;
  name: string;
  phone: string;
  unread: number;
  last: { dir: 'in' | 'out'; text: string; at: string };
  windowUntil: string | null;
};
export type InboxConversation = {
  thread: string;
  guest: Guest | null;
  name: string;
  phone: string;
  messages: InboxMessage[];
  windowUntil: string | null;
};

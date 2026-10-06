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
  };
  /** The public wedding website, for the link back to it. */
  publicUrl: string;
};

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
  /** Read-only: the invite site, where the traditional card is served from. */
  inviteUrl?: string;
};

export type Role = 'admin' | 'checkin' | null;

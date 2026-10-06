// The fixed wedding details (names, venues, times, contacts). One source of truth, shared with the API.
import raw from '../../functions/src/config.js';

export type EventKey = 'church' | 'trad';
export type WeddingEvent = {
  key: EventKey;
  name: string;
  time: string;
  startsAt: string;
  venue: string;
  venueLine2: string;
  address: string;
  mapUrl: string;
};
export type StoryMoment = { when: string; title: string; text: string; photo?: string };
export type GalleryPhoto = { src: string; caption?: string };

export type WeddingConfig = {
  couple: { bride: string; groom: string; brideFull: string; groomFull: string; monogram: string; hashtag: string; surname: string };
  families: { bride: string; groom: string };
  date: string;
  events: Record<EventKey, WeddingEvent>;
  colours: { name: string; hex: string }[];
  rsvpBy: string;
  contacts: { name: string; phone: string }[];
  publicNotes: string[];
  churchRsvp: { open: boolean; maxParty: number };
  registryUrl: string;
  notes: string[];
  story: StoryMoment[];
  hero: { photo: string; note: string };
  gallery: GalleryPhoto[];
  intro: { home: boolean; invite: boolean };
  invitationArt: { church: string; trad: string; nameSlot: { top: number; maxSize: number }; codeSlot: { top: number; left: number; size: number } };
  gifts: { message: string; accounts: { bank: string; name: string; number: string }[] };
  inviteMessage: string;
};

export const cfg = raw as unknown as WeddingConfig;

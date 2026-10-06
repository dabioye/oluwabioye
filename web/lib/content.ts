'use client';
import { useSyncExternalStore } from 'react';
import { cfg } from './config';
import type { PublicContent } from './types';

// Pages are built with the defaults from config, then pick up the latest edits from the website editor.
export const defaultContent: PublicContent = {
  hero: cfg.hero,
  story: cfg.story,
  gallery: cfg.gallery,
  registryUrl: cfg.registryUrl,
  giftsMessage: cfg.gifts.message,
  publicNotes: cfg.publicNotes,
  rsvpBy: cfg.rsvpBy,
  invitationArt: { church: cfg.invitationArt.church },
  intro: { home: cfg.intro.home },
};

const KEY = 'sd:content';
const listeners = new Set<() => void>();
let snapshot: PublicContent | null = null;
let loading = false;

function cached(): PublicContent | null {
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as PublicContent) : null;
  } catch {
    return null;
  }
}

function publish(c: PublicContent) {
  snapshot = c;
  listeners.forEach((l) => l());
}

function load() {
  if (loading) return;
  loading = true;
  fetch('/api/content')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((c: PublicContent) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(c));
      } catch {}
      publish(c);
    })
    .catch(() => {});
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  load();
  return () => listeners.delete(fn);
}

// Built-in defaults first, then the last copy seen on this device, then the live copy.
const getSnapshot = () => (snapshot ??= cached() || defaultContent);
const getServerSnapshot = () => defaultContent;

/** Latest public content (couple photo, story, gallery, registry…). */
export function useSiteContent() {
  const content = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { content };
}

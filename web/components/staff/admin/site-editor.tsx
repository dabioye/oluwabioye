'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, ImagePlus, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import type { StoryMoment } from '@/lib/config';
import { shrink } from '@/lib/image';
import { NAME_FONTS } from '@/lib/invitation';
import type { SiteSettings, WhatsAppStatus } from '@/lib/types';
import { StaffHeader, StaffPage } from '../staff-shell';

async function upload(file: File) {
  const blob = await shrink(file);
  return (await api<{ url: string }>('/api/admin/media', { raw: blob, type: 'image/jpeg' })).url;
}

// Built-in images live on one site only (the traditional card is never on the public domain), so preview them from there.
const previewSrc = (src: string, base?: string) => (base && src.startsWith('/img/') ? `${base}${src}` : src);

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">
      {children}
    </Label>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-4 border-hairline-soft bg-navy-2/60 py-5">
      <CardHeader className="px-5">
        <CardTitle className="font-display text-lg font-medium text-gold">{title}</CardTitle>
        {description && <CardDescription className="text-ivory-dim">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-3.5 px-5">{children}</CardContent>
    </Card>
  );
}

/** One photo with upload / replace / remove. */
function PhotoField({ label, value, onChange, from }: { label: string; value: string; onChange: (url: string) => void; from?: string }) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid content-start gap-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="grid min-h-36 place-items-center overflow-hidden rounded-md border border-dashed border-gold/35 bg-navy">
        {busy ? (
          <Loader2 className="animate-spin text-gold" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc(value, from)} alt="" className="block max-h-80 max-w-full object-contain" />
        ) : (
          <span className="text-sm text-ivory-dim">No photo yet</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-gold/40 bg-transparent text-gold"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <ImagePlus /> {value ? 'Replace' : 'Upload'}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" className="text-bad hover:bg-bad/10 hover:text-bad" onClick={() => onChange('')}>
            <X /> Remove
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try {
            onChange(await upload(f));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function swap<T>(list: T[], i: number, j: number) {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function SiteEditor() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const galleryInput = useRef<HTMLInputElement>(null);
  const [wa, setWa] = useState<WhatsAppStatus | null>(null);
  useEffect(() => {
    api<WhatsAppStatus>('/api/admin/whatsapp').then(setWa, () => {});
  }, []);

  useEffect(() => {
    api<SiteSettings>('/api/admin/site')
      .then((d) =>
        setS({
          ...d,
          story: d.story || [],
          gallery: d.gallery || [],
          hero: d.hero || { photo: '', note: '' },
          invitationArt: d.invitationArt || { church: '', trad: '' },
        }),
      )
      .catch((e) => (e instanceof ApiError && e.status === 401 ? location.reload() : toast.error('Couldn’t load the website content')));
  }, []);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = useCallback((fn: (x: SiteSettings) => SiteSettings) => {
    setS((x) => (x ? fn(x) : x));
    setDirty(true);
  }, []);
  const setStory = (fn: (m: StoryMoment[]) => StoryMoment[]) => update((x) => ({ ...x, story: fn(x.story) }));

  async function save() {
    if (!s) return;
    if (s.registryUrl && !/^https:\/\//.test(s.registryUrl)) return toast.error('The registry link must start with https://');
    setSaving(true);
    try {
      const d = await api<SiteSettings>('/api/admin/site', { method: 'PUT', body: s });
      setS({ ...d, story: d.story || [], gallery: d.gallery || [] });
      setDirty(false);
      toast.success('Saved. The website updates within a minute.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StaffPage className="max-w-[900px] pb-32">
      <StaffHeader
        title="Edit website"
        subtitle="Changes go live within about a minute of saving"
        links={[
          { href: '/admin', label: 'Invitations' },
          { href: '/', label: 'View website', external: true },
        ]}
        signOutTo="/admin"
      />
      {!s ? (
        <p className="py-16 text-center text-ivory-dim">Loading…</p>
      ) : (
        <div className="mt-5 grid gap-4">
          <Section title="Welcome" description="The couple photo fills the top of the home page. A portrait photo works best.">
            <PhotoField label="Couple photo" value={s.hero.photo} onChange={(photo) => update((x) => ({ ...x, hero: { ...x.hero, photo } }))} />
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="heroNote">Welcome note under your names</FieldLabel>
              <Input
                id="heroNote"
                maxLength={300}
                placeholder="We can’t wait to celebrate with you."
                value={s.hero.note}
                onChange={(e) => update((x) => ({ ...x, hero: { ...x.hero, note: e.target.value } }))}
              />
            </div>
          </Section>

          <Section
            title="Invitation cards"
            description="Leave the guest-name space empty on the traditional card: each guest’s name is written in automatically."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <PhotoField
                label="Church invitation (public site)"
                value={s.invitationArt.church}
                onChange={(church) => update((x) => ({ ...x, invitationArt: { ...x.invitationArt, church } }))}
              />
              <PhotoField
                label="Traditional invitation (private invites)"
                from={s.inviteUrl}
                value={s.invitationArt.trad}
                onChange={(trad) => update((x) => ({ ...x, invitationArt: { ...x.invitationArt, trad } }))}
              />
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">Font for guests’ names</legend>
              <div role="radiogroup" aria-label="Font for guests’ names" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {NAME_FONTS.map(({ family, scale }) => {
                  const on = (s.nameFont || NAME_FONTS[0].family) === family;
                  return (
                    <button
                      key={family}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => update((x) => ({ ...x, nameFont: family }))}
                      className={`grid cursor-pointer justify-items-center gap-1 rounded-md border px-2 py-3 transition-colors ${on ? 'border-gold bg-gold/10' : 'border-hairline-soft bg-navy hover:border-gold/50'}`}
                    >
                      <span className="text-[#f3e6cc]" style={{ fontFamily: `"${family}", cursive`, fontSize: `${1.9 * scale}rem`, lineHeight: 1.1 }}>
                        Tope Omidiji
                      </span>
                      <small className="text-[0.7rem] text-ivory-dim">{family}</small>
                    </button>
                  );
                })}
              </div>
              <p className="m-0 text-[0.8rem] text-ivory-dim">Used on each guest’s card on their invitation page and in the card sent on WhatsApp.</p>
            </fieldset>
          </Section>

          <Section title="Our story" description="Moments shown on the home page and the Our Story page, in this order.">
            {s.story.length === 0 && <p className="m-0 text-sm text-ivory-dim">No story yet. Add your first moment: how you met, the proposal, and so on.</p>}
            {s.story.map((m, i) => (
              <div key={i} className="grid gap-2.5 rounded-md border border-hairline-soft p-3">
                <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
                  <Input
                    aria-label="When"
                    placeholder="When (e.g. 2019)"
                    value={m.when}
                    onChange={(e) => setStory((l) => l.map((x, j) => (j === i ? { ...x, when: e.target.value } : x)))}
                  />
                  <Input
                    aria-label="Title"
                    placeholder="Title"
                    value={m.title}
                    onChange={(e) => setStory((l) => l.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  />
                </div>
                <Textarea
                  aria-label="Story text"
                  rows={3}
                  placeholder="What happened"
                  value={m.text}
                  onChange={(e) => setStory((l) => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.photo && <img src={m.photo} alt="" className="size-12 rounded object-cover" />}
                  <Button asChild size="sm" variant="outline" className="border-gold/40 bg-transparent text-gold">
                    <label className="cursor-pointer">
                      <ImagePlus /> {m.photo ? 'Change photo' : 'Add photo'}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          try {
                            const url = await upload(f);
                            setStory((l) => l.map((x, j) => (j === i ? { ...x, photo: url } : x)));
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Upload failed');
                          }
                        }}
                      />
                    </label>
                  </Button>
                  {m.photo && (
                    <Button size="sm" variant="ghost" onClick={() => setStory((l) => l.map((x, j) => (j === i ? { ...x, photo: '' } : x)))}>
                      Remove photo
                    </Button>
                  )}
                  <span className="flex-1" />
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => setStory((l) => swap(l, i, i - 1))} aria-label="Move up">
                    <ArrowUp />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-bad hover:bg-bad/10 hover:text-bad"
                    onClick={() => setStory((l) => l.filter((_, j) => j !== i))}
                    aria-label="Delete moment"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              className="justify-self-start border-gold/40 bg-transparent text-gold"
              onClick={() => setStory((l) => [...l, { when: '', title: '', text: '', photo: '' }])}
            >
              <Plus /> Add a moment
            </Button>
          </Section>

          <Section
            title="Gallery"
            description="The first photo shows large on the website. Photos are resized on your phone before upload, so large camera photos are fine."
          >
            {s.gallery.length === 0 ? (
              <p className="m-0 text-sm text-ivory-dim">No photos yet.</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
                {s.gallery.map((g, i) => (
                  <div key={g.src} className="grid gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.src} alt="" className="aspect-square w-full rounded object-cover" />
                    <Input
                      aria-label="Caption"
                      placeholder="Caption (optional)"
                      className="h-8 text-xs"
                      value={g.caption || ''}
                      onChange={(e) => update((x) => ({ ...x, gallery: x.gallery.map((p, j) => (j === i ? { ...p, caption: e.target.value } : p)) }))}
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={i === 0}
                        aria-label="Move earlier"
                        onClick={() => update((x) => ({ ...x, gallery: swap(x.gallery, i, i - 1) }))}
                      >
                        <ArrowLeft />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-bad hover:bg-bad/10 hover:text-bad"
                        aria-label="Remove photo"
                        onClick={() => update((x) => ({ ...x, gallery: x.gallery.filter((_, j) => j !== i) }))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button className="justify-self-start" disabled={!!uploading} onClick={() => galleryInput.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} {uploading || 'Add photos'}
            </Button>
            <input
              ref={galleryInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={async (e) => {
                const files = [...(e.target.files || [])];
                e.target.value = '';
                let n = 0;
                for (const f of files) {
                  setUploading(`Uploading ${++n} of ${files.length}…`);
                  try {
                    const src = await upload(f);
                    update((x) => ({ ...x, gallery: [...x.gallery, { src, caption: '' }] }));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Upload failed');
                  }
                }
                setUploading('');
                if (files.length) toast(`${files.length} photo${files.length === 1 ? '' : 's'} added. Remember to save.`);
              }}
            />
          </Section>

          <Section title="Registry & details">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="registryUrl">Joy registry link</FieldLabel>
              <Input
                id="registryUrl"
                type="url"
                placeholder="https://withjoy.com/…"
                value={s.registryUrl}
                onChange={(e) => update((x) => ({ ...x, registryUrl: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="giftsMessage">Registry message</FieldLabel>
              <Textarea
                id="giftsMessage"
                rows={2}
                maxLength={500}
                value={s.giftsMessage}
                onChange={(e) => update((x) => ({ ...x, giftsMessage: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5 sm:max-w-60">
              <FieldLabel htmlFor="rsvpBy">RSVP deadline (private invitations)</FieldLabel>
              <Input id="rsvpBy" type="date" value={s.rsvpBy} onChange={(e) => update((x) => ({ ...x, rsvpBy: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="publicNotes">Notes for church guests (one per line)</FieldLabel>
              <Textarea
                id="publicNotes"
                rows={3}
                value={s.publicNotes.join('\n')}
                onChange={(e) => update((x) => ({ ...x, publicNotes: e.target.value.split('\n') }))}
              />
            </div>
            <fieldset className="grid gap-3">
              <legend className="mb-2 text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">Wax-seal opening</legend>
              <label className="flex items-center justify-between gap-3 text-ivory">
                On the public website
                <Switch checked={s.intro.home} onCheckedChange={(home) => update((x) => ({ ...x, intro: { ...x.intro, home } }))} />
              </label>
              <label className="flex items-center justify-between gap-3 text-ivory">
                On private invitations
                <Switch checked={s.intro.invite} onCheckedChange={(invite) => update((x) => ({ ...x, intro: { ...x.intro, invite } }))} />
              </label>
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">WhatsApp invitations</legend>
              <label className="flex items-center justify-between gap-3 text-ivory">
                Send the WhatsApp invitation automatically when a guest is added or imported
                <Switch
                  checked={!!s.waAutoSend}
                  disabled={!s.waAutoSend && !wa?.ready}
                  onCheckedChange={(waAutoSend) => update((x) => ({ ...x, waAutoSend }))}
                />
              </label>
              <p className="m-0 text-[0.8rem] text-ivory-dim">
                {!wa
                  ? 'Checking WhatsApp…'
                  : !wa.configured
                    ? 'WhatsApp API is not connected yet. Set the WhatsApp secrets, then redeploy.'
                    : !wa.ready
                      ? 'WhatsApp cannot send yet. Resolve the connection or approved-template issue shown on the invitation desk, then try again.'
                      : wa.template?.needsImage
                        ? 'Each guest’s personalised card goes with their message, including when they’re sent automatically. Only guests invited to the traditional wedding are sent one. Turn this on only after a test send to yourself looks right.'
                        : 'WhatsApp API is connected. Turn this on only after a test send to yourself looks right.'}
              </p>
            </fieldset>
          </Section>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-4 border-t border-hairline-soft bg-[#0c1526]/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-md">
        {dirty && <span className="font-ui text-sm text-warn">Unsaved changes</span>}
        <Button size="lg" onClick={save} disabled={!s || saving || !dirty}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Save changes
        </Button>
      </div>
    </StaffPage>
  );
}

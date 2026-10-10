import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { INVITE, META, PUBLIC } from '../../playwright.config';

// Skip the wax-seal envelope unless a test is about it.
const skipIntro = (page: Page) => page.addInitScript(() => ['home', 'invite'].forEach((k) => sessionStorage.setItem(`opened:${k}`, '1')));

async function addGuest(request: APIRequestContext, body: Record<string, unknown>, signIn = true) {
  if (signIn) await request.post(`${PUBLIC}/api/login`, { data: { kind: 'admin', password: 'test-admin' } });
  const r = await request.post(`${PUBLIC}/api/admin/guests`, { data: body });
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as { code: string; name: string; id: string };
}

test('public site: church wedding only, no RSVP, no code box', async ({ page }) => {
  await page.goto(PUBLIC);
  await expect(page.getByRole('button', { name: 'Open the invitation' })).toBeVisible();
  await page.getByRole('button', { name: 'Open the invitation' }).click();
  await expect(page.locator('#intro')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Wedding Ceremony' })).toBeVisible();
  // Every Gift Registry link goes straight to the registry, not to a section of the site.
  const registry = page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Gift Registry' });
  await expect(registry).toHaveAttribute('href', 'https://wishgum.com/w/sarahdamilare_');
  await expect(registry).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/gallery');
  await expect(page.locator('#gallery')).toContainText('Photos are coming soon');
  await expect(page.getByText('Oluwafunmilayo Emem')).toBeVisible();
  await expect(page.getByRole('link', { name: '+234 903 002 2185' })).toHaveAttribute('href', 'tel:+2349030022185');
  const body = await page.locator('body').innerText();
  expect(body).toContain('Garden of Peace');
  expect(body).not.toMatch(/SCFN|Traditional Wedding/);
  expect(body).not.toMatch(/rsvp/i);
  await expect(page.locator('input')).toHaveCount(0);

  // The invitation page is the printed card, then date, time and place with directions and calendar, then the registry.
  await page.goto(`${PUBLIC}/invitation`);
  await expect(page.getByRole('img', { name: /^Invitation: together with their families/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wedding Ceremony', exact: true })).toBeVisible();
  await expect(page.getByText('78/80 Falolu Road, Surulere, Lagos')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Directions' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add to calendar' })).toHaveAttribute('href', '/calendar/church.ics');
  await expect(page.getByRole('heading', { name: 'Celebrate our new chapter' })).toBeVisible();
  // A public privacy policy (Meta needs one to publish the WhatsApp app), linked from every footer.
  await page.goto(`${PUBLIC}/privacy`);
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your choices, and deleting your data' })).toBeVisible();
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy');
  // The gallery has a page of its own.
  await page.goto(`${PUBLIC}/gallery`);
  await expect(page.getByRole('heading', { name: 'Moments so far' })).toBeVisible();
  await page.goto(`${PUBLIC}/our-story`);
  await expect(page.getByRole('heading', { name: /The Making/ })).toBeVisible();
});

test('the public build never ships traditional-wedding files', async () => {
  const dir = path.join(__dirname, '../../dist/public');
  expect(fs.existsSync(path.join(dir, 'img/invite-trad.jpg'))).toBe(false);
  expect(fs.existsSync(path.join(dir, 'i.html'))).toBe(false);
  expect(fs.readFileSync(path.join(dir, 'index.html'), 'utf8')).not.toContain('SCFN');
});

test('public /i/CODE links move to the invite site', async ({ request }) => {
  const r = await request.get(`${PUBLIC}/i/ABC234`, { maxRedirects: 0 });
  expect(r.status()).toBe(301);
  expect(r.headers().location).toBe(`${INVITE}/i/ABC234`);
});

test('guest enters their code, is remembered, RSVPs and gets their access card', async ({ page, request }) => {
  const g = await addGuest(request, { name: 'Tope Omidiji', phone: '08031234567', driverCard: true });
  await page.goto(INVITE);
  await expect(page.getByText('Strictly by invitation')).toBeVisible();

  // A wrong code is explained, not silently ignored.
  await page.getByLabel('Enter your invitation code').pressSequentially('ZZZ222');
  await expect(page.getByRole('alert').filter({ hasText: 'couldn’t find that code' })).toBeVisible();

  // Lower case works and submits on its own once all six are typed.
  await page.getByLabel('Enter your invitation code').fill('');
  await page.getByLabel('Enter your invitation code').pressSequentially(g.code.toLowerCase());
  await expect(page).toHaveURL(`${INVITE}/i/${g.code}`);
  await expect(page.getByText('An invitation for')).toBeVisible();
  await expect(page.locator('#intro')).toContainText('Tope Omidiji');
  await page.getByRole('button', { name: 'Open the invitation' }).click();

  // The card carries the guest's name and access code; under it, the reception details and directions.
  await expect(
    page.getByRole('img', {
      name: `Invitation for Tope Omidiji, access code ${g.code}: The Making of Oluwabioye, traditional wedding, strictly by invitation, 17 December 2026, 2:00 PM, SCFN Multipurpose Hall. No children allowed.`,
    }),
  ).toBeVisible();
  await expect(page.locator('#invitation').getByText(g.code)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Traditional Wedding & Reception' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Directions' }).first()).toHaveAttribute('href', /Sickle\+Cell/);
  // The church ceremony follows, and the nav leads to the story and the registry on the public site.
  await expect(page.getByRole('heading', { name: 'Wedding Ceremony', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Our Story' })).toHaveAttribute('href', `${PUBLIC}/our-story`);
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Gift Registry' })).toHaveAttribute(
    'href',
    'https://wishgum.com/w/sarahdamilare_',
  );

  // RSVP: a declining guest is asked for a reason; accepting sends straight away, with the note.
  await expect(page.getByRole('heading', { name: 'Send RSVP' })).toBeVisible();
  await expect(page.locator('#respond')).toContainText('Your response helps us properly plan for you as our most esteemed guest.');
  // The RSVP is the first thing on the page, before the card and the details.
  expect(
    await page.evaluate(
      () => !!(document.getElementById('respond')!.compareDocumentPosition(document.getElementById('invitation')!) & Node.DOCUMENT_POSITION_FOLLOWING),
    ),
  ).toBe(true);
  await expect(page.locator('#respond')).toContainText('Kindly respond by 30 November 2026');
  await page.getByRole('button', { name: 'Regretfully Decline' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Kindly tell us why' })).toBeVisible();
  await page.getByLabel('A note for Sarah & Damilare').fill('Can’t wait!');
  await page.getByRole('button', { name: 'Joyfully Accept' }).click();
  await expect(page.getByText('Attending', { exact: true })).toBeVisible();
  await expect(page.locator('#card').getByText('Access card', { exact: true })).toBeVisible();
  await expect(page.getByText('Driver’s meal card')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Entry QR code for Tope Omidiji' })).toBeVisible();

  // Remembered: the front page goes straight back to the invitation.
  await page.goto(INVITE);
  await expect(page).toHaveURL(`${INVITE}/i/${g.code}`);
  await page.getByRole('button', { name: 'Not you? Use a different code' }).click();
  await expect(page).toHaveURL(`${INVITE}/`);
  await expect(page.getByLabel('Enter your invitation code')).toBeVisible();
});

test('an unknown invitation link explains what to do', async ({ page }) => {
  await skipIntro(page);
  await page.goto(`${INVITE}/i/YYY333`);
  await expect(page.getByRole('heading', { name: 'Invitation not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Enter your invitation code' })).toBeVisible();
});

test('the couple signs in, adds a guest and edits the website', async ({ page }) => {
  await page.goto(`${PUBLIC}/admin`);
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'didn’t work' })).toBeVisible();
  await page.getByLabel('Password').fill('test-admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invitation desk')).toBeVisible();

  await page.getByRole('button', { name: 'Add guest' }).click();
  await page.getByLabel('Full name').fill('Kemi Adeyemi');
  await page.getByLabel('WhatsApp / phone').fill('08012345678');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: /Kemi Adeyemi/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Send · WhatsApp/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Card' }).first()).toBeVisible();

  await page.goto(`${PUBLIC}/admin/site`);
  await page.getByLabel('Welcome note under your names').fill('We can’t wait to celebrate with you.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  await skipIntro(page);
  await page.goto(PUBLIC);
  await expect(page.getByText('We can’t wait to celebrate with you.')).toBeVisible();
});

test('ushers check guests in at the gate', async ({ page, request }) => {
  const g = await addGuest(request, { name: 'Bisi Ade', phone: '08055555555' });
  await page.goto(`${INVITE}/checkin`);
  await page.getByLabel('PIN').fill('4321');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Invitation code or guest name').fill(g.code);
  await page.getByLabel('Invitation code or guest name').press('Enter');
  await expect(page.getByText('Welcome')).toBeVisible();
  await expect(page.getByText('Bisi Ade').first()).toBeVisible();

  // Scanning the same card again is flagged.
  await page.goto(`${INVITE}/c/${g.code}`);
  await expect(page.getByText('Already checked in')).toBeVisible();
});

test('sending on WhatsApp from a phone opens the guest’s chat with the message, then shares the card', async ({ page, request }) => {
  const g = await addGuest(request, { name: 'Funke Bello', phone: '08066666666' });
  // Without WhatsApp Business, the desk opens WhatsApp itself. Stand-ins for WhatsApp and the share sheet record what would be sent.
  await page.route('**/api/admin/whatsapp*', (r) => r.fulfill({ json: { configured: false, ready: false } }));
  await page.addInitScript(() => {
    const w = window as unknown as { opened: string[]; shared: unknown[] };
    w.opened = [];
    w.shared = [];
    window.open = (url?: string | URL) => (w.opened.push(String(url)), null);
    Object.assign(navigator, {
      canShare: () => true,
      share: async (d: { files: File[]; text?: string }) => {
        w.shared.push({ text: d.text, files: d.files.map((f) => ({ name: f.name, type: f.type, size: f.size })) });
      },
    });
  });
  await page.goto(`${PUBLIC}/admin`);
  await page.getByLabel('Password').fill('test-admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const row = page
    .locator('div', { hasText: 'Funke Bello' })
    .filter({ has: page.getByRole('button', { name: /Send · WhatsApp/ }) })
    .last();
  await row.getByRole('button', { name: /Send · WhatsApp/ }).click();
  await expect(page.getByText('Marked as sent to Funke Bello')).toBeVisible();
  const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened);
  expect(opened).toHaveLength(1);
  expect(opened[0]).toMatch(/^https:\/\/wa\.me\/2348066666666\?text=/);
  expect(decodeURIComponent(opened[0])).toContain(`/i/${g.code}`);

  const dialog = page.getByRole('dialog', { name: /Now send Funke’s card/ });
  await expect(dialog.getByRole('img', { name: 'Invitation card for Funke Bello' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Share card' }).click();
  await expect(dialog).toBeHidden();
  const shared = await page.evaluate(
    () => (window as unknown as { shared: { text?: string; files: { name: string; type: string; size: number }[] }[] }).shared,
  );
  expect(shared).toHaveLength(1);
  expect(shared[0].text).toBeUndefined();
  expect(shared[0].files[0]).toMatchObject({ name: 'Invitation - Funke Bello.jpg', type: 'image/jpeg' });
  expect(shared[0].files[0].size).toBeGreaterThan(50_000);
});

test('with WhatsApp Business, the desk sends each guest their card and message from the couple’s number', async ({ page, request }) => {
  // Signed in once, through the page (the sign-in limit is 8 a minute and the suite signs in a lot).
  const kemi = await addGuest(page.request, { name: 'Kemi Adeyemi', phone: '0807 777 7777' });
  await addGuest(page.request, { name: 'Bayo Ojo', phone: '08088888888' }, false);
  await page.goto(`${PUBLIC}/admin`);
  await expect(page.getByText(/WhatsApp Business · ready/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('+234 807 269 2636 · Dabioye Solutions')).toBeVisible();

  // One guest: preview of exactly what they'll get, then send
  const row = page
    .locator('div', { hasText: 'Kemi Adeyemi' })
    .filter({ has: page.getByRole('button', { name: /send · WhatsApp/i }) })
    .last();
  await row.getByRole('button', { name: /Send · WhatsApp/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Send Kemi Adeyemi’s invitation on WhatsApp' });
  await expect(dialog.getByRole('img', { name: 'Invitation card for Kemi Adeyemi' })).toBeVisible();
  await expect(dialog.getByText(/^Dear Kemi Adeyemi,/)).toBeVisible();
  await expect(dialog.getByText('View invitation')).toBeVisible();
  await dialog.getByRole('button', { name: 'Send now' }).click();
  // Drawing the card and uploading it can take a while on a busy CI machine.
  await expect(dialog.getByText(/Done\. 1 sent of 1/)).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(row.getByText('WhatsApp queued')).toBeVisible();

  // "Message" still sends from WhatsApp on this device: the guest's chat opens with the message, then the card.
  await page.evaluate(() => {
    const w = window as unknown as { opened: string[] };
    w.opened = [];
    window.open = (url?: string | URL) => (w.opened.push(String(url)), null);
    Object.assign(navigator, { canShare: () => true, share: async () => {} });
  });
  await row.getByRole('button', { name: 'Message' }).click();
  const viaPhone = await page.evaluate(() => (window as unknown as { opened: string[] }).opened);
  expect(viaPhone[0]).toMatch(/^https:\/\/wa\.me\/2348077777777\?text=/);
  const cardStep = page.getByRole('dialog', { name: /Now send Kemi’s card/ });
  await expect(cardStep.getByRole('img', { name: 'Invitation card for Kemi Adeyemi' })).toBeVisible({ timeout: 20_000 });
  await cardStep.getByRole('button', { name: 'Share card' }).click();
  await expect(cardStep).toBeHidden();

  let meta = await (await request.get(`${META}/__sent`)).json();
  const msg = meta.sent.at(-1);
  expect(msg.to).toBe('2348077777777');
  expect(msg.template.name).toBe('oluwabioye_invitation');
  expect(msg.template.components[0]).toEqual({ type: 'header', parameters: [{ type: 'image', image: { id: `MEDIA${meta.media.length}` } }] });
  expect(msg.template.components[1].parameters[0].text).toBe('Kemi Adeyemi');
  expect(msg.template.components[2]).toEqual({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: kemi.code }] });
  expect(meta.media.at(-1).size).toBeGreaterThan(50_000);

  // Everyone else who hasn't had theirs yet
  await page.getByRole('button', { name: 'Send all pending via WhatsApp' }).click();
  const bulk = page.getByRole('dialog', { name: /^Send \d+ invitations on WhatsApp$/ });
  await bulk.getByRole('button', { name: /^Send all \d+$/ }).click();
  await expect(bulk.getByText(/^Done\./)).toBeVisible({ timeout: 30_000 });
  await expect(bulk.getByText(/failed/)).toHaveCount(0);
  await bulk.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send all pending via WhatsApp' })).toHaveCount(0);
  meta = await (await request.get(`${META}/__sent`)).json();
  expect(meta.sent.map((m: { to: string }) => m.to)).toContain('2348088888888');
  // Kemi got exactly one invitation (counted by her code, so a retried attempt's earlier sends don't count).
  const forKemi = meta.sent.filter((m: { template: { components: { type: string; parameters: { text?: string }[] }[] } }) =>
    m.template.components.some((c) => c.type === 'button' && c.parameters[0].text === kemi.code),
  );
  expect(forKemi).toHaveLength(1);
});

test('guests’ WhatsApp replies arrive in the inbox, alert the couple, and can be answered', async ({ page, request }) => {
  const lara = await addGuest(page.request, { name: 'Lara Bello', phone: '0809 999 9999' });
  const browserErrors: string[] = [];
  page.on('pageerror', (e) => browserErrors.push(`pageerror: ${e.stack || e.message}`));
  page.on('console', (m) => m.type() === 'error' && browserErrors.push(`console: ${m.text()}`));
  // Meta delivers the reply to the webhook, signed with the app secret (a fresh id each attempt, as Meta would).
  const wamid = `wamid.lara.${Date.now()}`;
  const body = JSON.stringify({
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              contacts: [{ profile: { name: 'Lara' }, wa_id: '2348099999999' }],
              messages: [
                {
                  from: '2348099999999',
                  id: wamid,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: 'Thank you so much!\nWe’ll be there.' },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const hook = await request.post(`${PUBLIC}/api/whatsapp/webhook`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'e2e-app-secret').update(body).digest('hex'),
    },
    data: body,
  });
  expect(hook.status()).toBe(200);
  let meta = await (await request.get(`${META}/__sent`)).json();
  const alert = meta.sent.filter((m: { to: string }) => m.to === '2348011112222').at(-1);
  expect(alert.template.name).toBe('guest_reply_alert');
  expect(alert.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual(['Lara Bello', 'Thank you so much! We’ll be there.']);

  await page.goto(`${PUBLIC}/admin`);
  await expect(page.getByText('Lara Bello replied on WhatsApp: “Thank you so much!').first()).toBeVisible();
  await page.getByRole('link', { name: 'Inbox' }).click();
  const item = page.getByRole('list', { name: 'Conversations' }).getByRole('button', { name: /Lara Bello/ });
  await expect(item).toContainText('1');
  await item.click();
  const convo = page.getByRole('region', { name: 'Conversation with Lara Bello' });
  const messages = convo.getByRole('log', { name: 'Messages' });
  await expect(messages.getByText('We’ll be there.')).toBeVisible();
  await expect(convo.getByText(/You can reply freely for 2[34] hours more/)).toBeVisible();
  await convo.getByLabel('Reply').fill('See you on the 17th, Lara!');
  await convo.getByRole('button', { name: 'Send' }).click();
  await expect(messages.getByText('See you on the 17th, Lara!')).toBeVisible();
  await expect(convo.getByLabel('Reply')).toHaveValue('');
  meta = await (await request.get(`${META}/__sent`)).json();
  expect(meta.sent.at(-1)).toEqual({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '2348099999999',
    type: 'text',
    text: { body: 'See you on the 17th, Lara!', preview_url: true },
  });
  // The link in the alert opens straight on the conversation.
  await page.goto(`${PUBLIC}/admin/inbox?thread=${lara.id}`);
  await expect(page.getByRole('region', { name: 'Conversation with Lara Bello' }).getByRole('log').getByText('See you on the 17th, Lara!')).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('anyone can ask us to create their own event site from the footer', async ({ page }) => {
  await page.goto(`${PUBLIC}/our-story`);
  await page.getByRole('contentinfo').getByRole('link', { name: 'Let Us Create Your Own Event Site' }).click();
  await expect(page).toHaveURL(`${PUBLIC}/create-your-event-site`);
  await expect(page.getByRole('heading', { name: 'Your celebration, beautifully online' })).toBeVisible();
  // Choosing "Other" asks what the event is; a missing contact is explained.
  await page.getByRole('radio', { name: 'Other (tell us)' }).click();
  await page.getByLabel('What’s the event?').fill('Naming ceremony');
  await page.getByLabel('Your name').fill('Amaka Obi');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'email address or phone number' })).toBeVisible();
  await page.getByLabel('Phone / WhatsApp').fill('0802 222 3333');
  await page.getByLabel('Expected guests').fill('120');
  await page.getByRole('checkbox', { name: 'RSVP and guest list' }).click();
  await page.getByLabel('Tell us about your event').fill('For our baby girl.');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you, Amaka' })).toBeVisible();
  // It reaches the team: saved, and listed for the couple.
  const leads = await (await page.request.get(`${PUBLIC}/api/admin/leads`)).status();
  expect(leads).toBe(401);
  await page.request.post(`${PUBLIC}/api/login`, { data: { kind: 'admin', password: 'test-admin' } });
  const list = await (await page.request.get(`${PUBLIC}/api/admin/leads`)).json();
  expect(list.leads[0]).toMatchObject({ name: 'Amaka Obi', event: 'Other', otherEvent: 'Naming ceremony', guests: 120, features: ['RSVP and guest list'] });
});

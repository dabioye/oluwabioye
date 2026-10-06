import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { INVITE, PUBLIC } from '../../playwright.config';

// Skip the wax-seal envelope unless a test is about it.
const skipIntro = (page: Page) => page.addInitScript(() => ['home', 'invite'].forEach((k) => sessionStorage.setItem(`opened:${k}`, '1')));

async function addGuest(request: APIRequestContext, body: Record<string, unknown>) {
  await request.post(`${PUBLIC}/api/login`, { data: { kind: 'admin', password: 'test-admin' } });
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
  await expect(page.getByRole('heading', { name: 'Will you join us, Tope?' })).toBeVisible();
  await page.getByLabel('A note for the couple').fill('Can’t wait!');
  await page.getByRole('button', { name: 'Send RSVP' }).click();
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

test('sending on WhatsApp from a phone shares the personalised card with the message', async ({ page, request }) => {
  const g = await addGuest(request, { name: 'Funke Bello', phone: '08066666666' });
  // Stand-in for the phone's share sheet: record what would go to WhatsApp.
  await page.addInitScript(() => {
    const w = window as unknown as { shared: unknown[] };
    w.shared = [];
    Object.assign(navigator, {
      canShare: () => true,
      share: async (d: { files: File[]; text: string }) => {
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
  const shared = await page.evaluate(() => (window as unknown as { shared: { text: string; files: { name: string; type: string; size: number }[] }[] }).shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].text).toContain(`/i/${g.code}`);
  expect(shared[0].files[0]).toMatchObject({ name: 'Invitation - Funke Bello.jpg', type: 'image/jpeg' });
  expect(shared[0].files[0].size).toBeGreaterThan(50_000);
});

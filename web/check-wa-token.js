#!/usr/bin/env node
// Checks a WhatsApp token BEFORE you save it to Firebase.
// It confirms the token can see the wedding number and the approved template,
// so you can't put a token from the wrong business/account into the site.
//
// Usage (the token is typed hidden, never shown or saved):
//   read -s -p "Paste new token: " T; echo
//   WA_TOKEN="$T" WA_PHONE_ID=<phone number id> WA_WABA_ID=<whatsapp business account id> node check-wa-token.js
//   unset T

const EXPECT_NUMBER = '8072692636'; // last 10 digits of the wedding sender number
const EXPECT_TEMPLATE = 'oluwabioye_invitation';
const V = process.env.WHATSAPP_API_VERSION || process.env.WA_API_VERSION || 'v23.0';

const { WA_TOKEN: token, WA_PHONE_ID: phoneId, WA_WABA_ID: wabaId } = process.env;
if (!token || !phoneId || !wabaId) {
  console.error('Set WA_TOKEN, WA_PHONE_ID and WA_WABA_ID (see the usage note at the top).');
  process.exit(2);
}

const get = async (path) => {
  const r = await fetch(`https://graph.facebook.com/${V}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && !j.error, j };
};
let bad = 0;
const pass = (m) => console.log('  ✓ ' + m);
const fail = (m) => {
  bad++;
  console.log('  ✗ ' + m);
};

(async () => {
  console.log('\n1. Who does this token belong to?');
  const me = await get('me?fields=id,name');
  me.ok ? pass(`token user: ${me.j.name} (${me.j.id})  ← should be wedding-sender`) : fail(`token rejected: ${me.j.error?.message}`);

  console.log('\n2. Can it see the wedding phone number?');
  const ph = await get(`${phoneId}?fields=display_phone_number,verified_name,quality_rating`);
  if (!ph.ok) fail(`cannot read phone ${phoneId}: ${ph.j.error?.message}`);
  else {
    const digits = String(ph.j.display_phone_number).replace(/\D/g, '');
    const line = `${ph.j.display_phone_number} · name "${ph.j.verified_name}" · quality ${ph.j.quality_rating}`;
    digits.endsWith(EXPECT_NUMBER) ? pass(line) : fail(`${line}  ← NOT the wedding number`);
  }

  console.log('\n3. Can it see the WhatsApp Business Account and the template?');
  const waba = await get(`${wabaId}?fields=name,id`);
  waba.ok
    ? pass(`WhatsApp account: ${waba.j.name} (${waba.j.id})`)
    : fail(`cannot read WhatsApp account ${wabaId}: ${waba.j.error?.message}  ← assets not assigned to this system user, or wrong business`);

  const nums = await get(`${wabaId}/phone_numbers?fields=id,display_phone_number`);
  if (nums.ok) {
    (nums.j.data || []).some((n) => n.id === phoneId)
      ? pass('the phone number belongs to this WhatsApp account')
      : fail('the phone number is NOT in this WhatsApp account — the IDs come from different accounts');
  }

  const t = await get(`${wabaId}/message_templates?name=${EXPECT_TEMPLATE}&fields=name,status,language,category,components`);
  if (!t.ok) fail(`cannot list templates: ${t.j.error?.message}  ← token is missing whatsapp_business_management`);
  else {
    const list = (t.j.data || []).filter((x) => x.name === EXPECT_TEMPLATE);
    if (!list.length) fail(`template "${EXPECT_TEMPLATE}" not found in this account`);
    for (const x of list) {
      const body = (x.components || []).find((c) => c.type === 'BODY');
      const vars = (body?.text?.match(/\{\{\d+\}\}/g) || []).length;
      const btn = (x.components || []).find((c) => c.type === 'BUTTONS')?.buttons?.[0];
      const line = `${x.name} · ${x.language} · ${x.category} · ${x.status} · body vars: ${vars} · button: ${btn ? btn.type + ' ' + (btn.url || '') : 'none'}`;
      x.status === 'APPROVED' ? pass(line) : fail(line + '  ← not approved yet');
    }
  }

  console.log(bad ? `\n✗ ${bad} problem(s). Do NOT save this token yet.\n` : '\n✓ All good. Safe to save this token to Firebase.\n');
  process.exit(bad ? 1 : 0);
})();

// Stand-in for Meta's WhatsApp Cloud API during the browser tests. GET /__sent lists what was sent.
import http from 'node:http';

const template = {
  name: 'oluwabioye_invitation',
  language: 'en',
  status: 'APPROVED',
  category: 'MARKETING',
  components: [
    { type: 'HEADER', format: 'IMAGE' },
    { type: 'BODY', text: 'Dear {{1}},\n\nYou are invited. Kindly RSVP by {{2}}.', example: { body_text: [['Tope Omidiji', '30 November 2026']] } },
    { type: 'FOOTER', text: '#TheMakingOfOluwabioye' },
    { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'View invitation', url: 'https://oluwabioye.dabioye.com/i/{{1}}' }] },
  ],
};
const alert = {
  name: 'guest_reply_alert',
  language: 'en',
  status: 'APPROVED',
  category: 'UTILITY',
  components: [
    { type: 'BODY', text: 'Guest reply: {{1}} replied to their invitation: {{2}}', example: { body_text: [['Tope Omidiji', 'Thank you!']] } },
    { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Open inbox', url: 'https://sarahanddamilare.dabioye.com/admin/inbox' }] },
  ],
};
const sent = [];
const media = [];

http
  .createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const url = new URL(req.url, 'http://x');
      const path = url.pathname.replace(/^\/v\d+\.\d+/, '');
      const send = (status, o) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(o));
      };
      if (path === '/__sent') return send(200, { sent, media });
      if (req.headers.authorization !== 'Bearer e2e-token') return send(401, { error: { message: 'Invalid OAuth access token' } });
      if (path === '/debug_token')
        return send(200, { data: { is_valid: true, expires_at: 0, granular_scopes: [{ scope: 'whatsapp_business_management', target_ids: ['WABA1'] }] } });
      if (path === '/WABA1/message_templates') return send(200, { data: [template, alert].filter((t) => t.name === url.searchParams.get('name')) });
      if (path === '/PHONE1' && req.method === 'GET')
        return send(200, { display_phone_number: '+234 807 269 2636', verified_name: 'Dabioye Solutions', quality_rating: 'GREEN' });
      if (path === '/PHONE1/media') {
        media.push({ type: req.headers['content-type'], size: body.length });
        return send(200, { id: `MEDIA${media.length}` });
      }
      if (path === '/PHONE1/messages') {
        const m = JSON.parse(body);
        sent.push(m);
        return send(200, { messages: [{ id: `wamid.${sent.length}` }] });
      }
      send(404, { error: { message: `Unknown path ${path}` } });
    });
  })
  .listen(Number(process.env.PORT || 3199));

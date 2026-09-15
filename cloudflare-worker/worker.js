const ALLOWED_ORIGINS = [
  'https://kitty840219-web.github.io',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Google Form: 美淑琳設計顧問｜網站詢問單
// https://docs.google.com/forms/d/e/1FAIpQLSft_f5_FPSQ4rqXNczq9zfaLX485DCvmEHsAI-66zhuiFdR8g/viewform
const GOOGLE_FORM_ID = '1FAIpQLSft_f5_FPSQ4rqXNczq9zfaLX485DCvmEHsAI-66zhuiFdR8g';
const GOOGLE_FORM_ENTRIES = {
  name: 'entry.252609749',
  phone: 'entry.1425905080',
  email: 'entry.976305721',
  lineId: 'entry.588924791',
  contactTime: 'entry.1600019176',
  needs: 'entry.635533849',
  spaceType: 'entry.1261683112',
  layoutChange: 'entry.1687566601',
  address: 'entry.1533653433',
  budget: 'entry.570816994',
  size: 'entry.1225021293',
  style: 'entry.971747479',
  message: 'entry.1806837787',
};

const FIELD_LABELS = [
  ['name', '姓名'],
  ['phone', '聯絡電話'],
  ['email', '電子信箱'],
  ['lineId', 'LINE ID'],
  ['contactTime', '方便聯絡時間'],
  ['needs', '需求類型'],
  ['spaceType', '空間類型'],
  ['layoutChange', '格局是否需要改動'],
  ['address', '空間地址'],
  ['size', '空間概略坪數'],
  ['budget', '預算'],
  ['style', '期望設計風格'],
  ['message', '期望空間需求'],
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // LINE webhook: log the sender's userId so we know who to push() to.
    // Visit this in "wrangler tail" while the target person messages the bot.
    if (url.pathname === '/line-webhook') {
      const body = await request.json().catch(() => ({}));
      for (const ev of body.events || []) {
        console.log('LINE webhook event', JSON.stringify({ type: ev.type, userId: ev.source?.userId }));
      }
      return new Response('ok');
    }

    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // honeypot: bots fill this hidden field, real users never see it
    if (data.website) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // simple math check
    if (String(data.captchaAnswer).trim() !== String(data.captchaExpected).trim()) {
      return new Response(JSON.stringify({ ok: false, error: 'captcha' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    if (!data.name || !data.phone || !data.email) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const rows = [];
    for (const [key, label] of FIELD_LABELS) {
      const v = data[key];
      if (!v) continue;
      const text = Array.isArray(v) ? v.join('、') : v;
      if (String(text).trim()) rows.push([label, text]);
    }
    const lineMessage = ['\n【美淑琳設計顧問｜網站詢問單】', ...rows.map(([l, t]) => `${l}：${t}`)].join('\n');
    const emailHtml = `<h2>美淑琳設計顧問｜網站詢問單</h2><table cellpadding="6" style="border-collapse:collapse">${rows.map(([l, t]) => `<tr><td style="color:#777;white-space:nowrap;vertical-align:top">${l}</td><td>${String(t).replace(/</g, '&lt;')}</td></tr>`).join('')}</table>`;

    const results = {};

    if (env.LINE_CHANNEL_TOKEN && env.LINE_TARGET_USER_ID) {
      // Pushes privately to one specific person (the business owner), not a
      // broadcast — this Official Account may have unrelated existing friends
      // who must never see customer inquiry data.
      const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.LINE_CHANNEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: env.LINE_TARGET_USER_ID, messages: [{ type: 'text', text: lineMessage }] }),
      });
      results.line = lineRes.ok ? 'sent' : `failed:${await lineRes.text()}`;
    } else {
      results.line = 'skipped:not_configured';
    }

    if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'CTDC 網站表單 <onboarding@resend.dev>',
          to: [env.NOTIFY_EMAIL],
          reply_to: data.email,
          subject: `網站詢問單：${data.name}`,
          html: emailHtml,
        }),
      });
      results.email = emailRes.ok ? 'sent' : `failed:${await emailRes.text()}`;
    } else {
      results.email = 'skipped:not_configured';
    }

    const formBody = new URLSearchParams();
    for (const [key, entry] of Object.entries(GOOGLE_FORM_ENTRIES)) {
      const v = data[key];
      if (!v) continue;
      if (Array.isArray(v)) {
        for (const item of v) formBody.append(entry, item);
      } else {
        formBody.append(entry, v);
      }
    }
    const sheetRes = await fetch(`https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/formResponse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });
    results.googleForm = sheetRes.ok ? 'sent' : `failed:${sheetRes.status}`;

    const anySent = results.line === 'sent' || results.email === 'sent' || results.googleForm === 'sent';
    return new Response(JSON.stringify({ ok: anySent, results }), {
      status: anySent ? 200 : 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};

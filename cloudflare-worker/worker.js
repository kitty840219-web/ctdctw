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

    if (env.LINE_CHANNEL_TOKEN) {
      // Broadcasts to everyone who has added the Official Account as a friend.
      // LINE Notify was retired 2025-03-31; this uses the Messaging API instead.
      const lineRes = await fetch('https://api.line.me/v2/bot/message/broadcast', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.LINE_CHANNEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: [{ type: 'text', text: lineMessage }] }),
      });
      results.line = lineRes.ok ? 'sent' : `failed:${await lineRes.text()}`;
    } else {
      results.line = 'skipped:no_token';
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

    const anySent = results.line === 'sent' || results.email === 'sent';
    return new Response(JSON.stringify({ ok: anySent, results }), {
      status: anySent ? 200 : 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};

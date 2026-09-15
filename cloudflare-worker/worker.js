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

    const lines = ['\n【美淑琳設計顧問｜網站詢問單】'];
    for (const [key, label] of FIELD_LABELS) {
      const v = data[key];
      if (!v) continue;
      const text = Array.isArray(v) ? v.join('、') : v;
      if (String(text).trim()) lines.push(`${label}：${text}`);
    }
    const message = lines.join('\n');

    const lineRes = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.LINE_NOTIFY_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ message }),
    });

    if (!lineRes.ok) {
      const errText = await lineRes.text();
      return new Response(JSON.stringify({ ok: false, error: 'line_notify_failed', detail: errText }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};

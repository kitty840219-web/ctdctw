import { buildCheckout, verifyNotify } from './ecpay.js';
import { hashPassword, verifyPassword, newToken, requireAuth, ROLE_RANK } from './auth.js';

// Origins allowed to call the *public* shop API (the main marketing site).
const SHOP_ALLOWED_ORIGINS = [
  'https://kitty840219-web.github.io',
];
// Origins allowed to call the *admin* API (the separate admin site).
const ADMIN_ALLOWED_ORIGINS = [
  'https://ctdc-tw-admin.pages.dev',
];

function cors(origin, allowedList) {
  const allow = allowedList.includes(origin) ? origin : allowedList[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}
function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function genOrderNo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => (b % 36).toString(36)).join('').toUpperCase();
  return `T${ts}${rand}`.slice(0, 20);
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

// ---- public shop API --------------------------------------------------

async function listProducts(env) {
  const { results: products } = await env.DB.prepare(
    `SELECT id, slug, name, category, description, image_url, sort_order FROM products
     WHERE status = 'published' ORDER BY sort_order ASC, id DESC`,
  ).all();
  const { results: variants } = await env.DB.prepare(
    `SELECT id, product_id, sku, option_label, price, stock_qty FROM product_variants
     ORDER BY sort_order ASC, id ASC`,
  ).all();
  const byProduct = {};
  for (const v of variants) (byProduct[v.product_id] ||= []).push(v);
  return products.map((p) => ({ ...p, variants: byProduct[p.id] || [] }));
}

async function getProduct(env, slug) {
  const p = await env.DB.prepare(
    `SELECT id, slug, name, category, description, image_url FROM products WHERE slug = ? AND status = 'published'`,
  ).bind(slug).first();
  if (!p) return null;
  const { results: variants } = await env.DB.prepare(
    `SELECT id, sku, option_label, price, stock_qty FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC, id ASC`,
  ).bind(p.id).all();
  return { ...p, variants };
}

async function createOrder(env, body, origin) {
  const items = Array.isArray(body?.items) ? body.items : [];
  const customer = body?.customer || {};
  if (!items.length || items.length > 30) return { error: 'invalid_items', status: 400 };
  for (const it of items) {
    if (!Number.isInteger(it.variantId) || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99) {
      return { error: 'invalid_items', status: 400 };
    }
  }
  const name = String(customer.name || '').trim();
  const phone = String(customer.phone || '').trim();
  const email = String(customer.email || '').trim();
  const address = String(customer.address || '').trim();
  if (!name || !phone || !email || !address) return { error: 'missing_customer_fields', status: 400 };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'invalid_email', status: 400 };

  const lines = [];
  let subtotal = 0;
  for (const it of items) {
    const row = await env.DB.prepare(
      `SELECT pv.id, pv.price, pv.stock_qty, pv.option_label, p.name AS product_name, p.status
       FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = ?`,
    ).bind(it.variantId).first();
    if (!row || row.status !== 'published') return { error: 'product_unavailable', status: 400 };
    if (row.stock_qty < it.qty) return { error: 'out_of_stock', status: 409, detail: row.product_name };
    lines.push({ variantId: row.id, qty: it.qty, price: row.price, productName: row.product_name, optionLabel: row.option_label });
    subtotal += row.price * it.qty;
  }

  // Reserve stock with a conditional UPDATE so concurrent orders can't
  // oversell; if a race already consumed the stock, roll back what we
  // already reserved for this order and fail.
  const reserved = [];
  for (const line of lines) {
    const res = await env.DB.prepare(
      `UPDATE product_variants SET stock_qty = stock_qty - ?, updated_at = datetime('now') WHERE id = ? AND stock_qty >= ?`,
    ).bind(line.qty, line.variantId, line.qty).run();
    if (!res.meta.changes) {
      for (const r of reserved) {
        await env.DB.prepare(`UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?`).bind(r.qty, r.variantId).run();
      }
      return { error: 'out_of_stock', status: 409, detail: line.productName };
    }
    reserved.push(line);
  }

  const orderNo = genOrderNo();
  await env.DB.prepare(
    `INSERT INTO orders (order_no, customer_name, customer_phone, customer_email, shipping_address, note, subtotal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(orderNo, name, phone, email, address, String(customer.note || '').slice(0, 500), subtotal).run();
  const order = await env.DB.prepare(`SELECT id FROM orders WHERE order_no = ?`).bind(orderNo).first();
  for (const line of lines) {
    await env.DB.prepare(
      `INSERT INTO order_items (order_id, variant_id, product_name, option_label, unit_price, qty) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(order.id, line.variantId, line.productName, line.optionLabel, line.price, line.qty).run();
  }

  const itemName = lines.map((l) => `${l.productName}${l.optionLabel ? '(' + l.optionLabel + ')' : ''} x${l.qty}`).join('#');
  const checkout = buildCheckout(env, {
    orderNo,
    amount: subtotal,
    itemName,
    notifyPath: '/api/payment/notify',
    resultPath: `/order-status.html?order=${orderNo}`,
    origin,
  });
  return { orderNo, actionUrl: checkout.actionUrl, fields: checkout.fields };
}

async function restoreStockForOrder(env, orderId) {
  const { results: items } = await env.DB.prepare(`SELECT variant_id, qty FROM order_items WHERE order_id = ?`).bind(orderId).all();
  for (const it of items) {
    await env.DB.prepare(`UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?`).bind(it.qty, it.variant_id).run();
  }
}

async function handlePaymentNotify(env, request) {
  const form = await request.formData();
  const params = {};
  for (const [k, v] of form.entries()) params[k] = v;
  if (!verifyNotify(env, params)) {
    return new Response('0|CheckMacValueError', { status: 400 });
  }
  const order = await env.DB.prepare(`SELECT id, status FROM orders WHERE order_no = ?`).bind(params.MerchantTradeNo).first();
  if (!order) return new Response('0|OrderNotFound', { status: 404 });

  if (order.status === 'pending_payment') {
    if (params.RtnCode === '1') {
      await env.DB.prepare(
        `UPDATE orders SET status = 'paid', payment_trade_no = ?, paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      ).bind(params.TradeNo || '', order.id).run();
    } else {
      await env.DB.prepare(`UPDATE orders SET status = 'payment_failed', updated_at = datetime('now') WHERE id = ?`).bind(order.id).run();
      await restoreStockForOrder(env, order.id);
    }
  }
  // Idempotent: ECPay retries this webhook until it sees "1|OK", so a
  // repeat delivery for an already-settled order just re-acks without
  // touching state again.
  return new Response('1|OK');
}

async function publicOrderStatus(env, orderNo) {
  const order = await env.DB.prepare(
    `SELECT order_no, status, subtotal, customer_name, created_at FROM orders WHERE order_no = ?`,
  ).bind(orderNo).first();
  if (!order) return null;
  const { results: items } = await env.DB.prepare(
    `SELECT product_name, option_label, unit_price, qty FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_no = ?)`,
  ).bind(orderNo).all();
  return { ...order, items };
}

// ---- admin API ----------------------------------------------------------

async function adminBootstrap(env, body) {
  if (!env.BOOTSTRAP_SECRET || body?.secret !== env.BOOTSTRAP_SECRET) return { error: 'forbidden', status: 403 };
  const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_users`).first();
  if (count.n > 0) return { error: 'already_bootstrapped', status: 409 };
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10) return { error: 'invalid_input', status: 400 };
  const hash = await hashPassword(password);
  await env.DB.prepare(`INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, 'super_admin')`).bind(email, hash).run();
  return { ok: true };
}

async function adminLogin(env, body) {
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const user = await env.DB.prepare(`SELECT id, email, password_hash, role FROM admin_users WHERE email = ?`).bind(email).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) return { error: 'invalid_credentials', status: 401 };
  const token = newToken();
  const expires = new Date(Date.now() + 12 * 3600 * 1000).toISOString().replace('Z', '');
  await env.DB.prepare(`INSERT INTO admin_sessions (token, admin_user_id, expires_at) VALUES (?, ?, ?)`).bind(token, user.id, expires).run();
  return { token, email: user.email, role: user.role };
}

const PRODUCT_FIELDS = ['slug', 'name', 'category', 'description', 'image_url', 'status', 'sort_order'];
const VARIANT_FIELDS = ['sku', 'option_label', 'price', 'stock_qty', 'sort_order'];
function pick(body, fields, camelMap) {
  const out = {};
  for (const f of fields) {
    const camel = camelMap[f];
    if (body[camel] !== undefined) out[f] = body[camel];
  }
  return out;
}
const PRODUCT_CAMEL = { slug: 'slug', name: 'name', category: 'category', description: 'description', image_url: 'imageUrl', status: 'status', sort_order: 'sortOrder' };
const VARIANT_CAMEL = { sku: 'sku', option_label: 'optionLabel', price: 'price', stock_qty: 'stockQty', sort_order: 'sortOrder' };

async function adminListProducts(env) {
  const { results: products } = await env.DB.prepare(`SELECT * FROM products ORDER BY sort_order ASC, id DESC`).all();
  const { results: variants } = await env.DB.prepare(`SELECT * FROM product_variants ORDER BY sort_order ASC, id ASC`).all();
  const byProduct = {};
  for (const v of variants) (byProduct[v.product_id] ||= []).push(v);
  return products.map((p) => ({ ...p, variants: byProduct[p.id] || [] }));
}

async function adminOrders(env, url) {
  const status = url.searchParams.get('status');
  const stmt = status
    ? env.DB.prepare(`SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 200`).bind(status)
    : env.DB.prepare(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`);
  const { results } = await stmt.all();
  return results;
}

async function adminOrderDetail(env, id) {
  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
  if (!order) return null;
  const { results: items } = await env.DB.prepare(`SELECT * FROM order_items WHERE order_id = ?`).bind(id).all();
  return { ...order, items };
}

const VALID_STATUS_TRANSITIONS = ['processing', 'shipped', 'completed', 'cancelled'];

async function releaseExpiredOrders(env) {
  const { results } = await env.DB.prepare(
    `SELECT id FROM orders WHERE status = 'pending_payment' AND created_at < datetime('now', '-30 minutes')`,
  ).all();
  for (const row of results) {
    await restoreStockForOrder(env, row.id);
    await env.DB.prepare(`UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).bind(row.id).run();
  }
}

export default {
  // Carts that reserved stock but never came back from ECPay (closed tab,
  // gave up on payment) would otherwise hold that stock hostage forever.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(releaseExpiredOrders(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const path = url.pathname;
    const isAdmin = path.startsWith('/admin/api/');
    const allowedList = isAdmin ? ADMIN_ALLOWED_ORIGINS : SHOP_ALLOWED_ORIGINS;
    const headers = cors(origin, allowedList);

    if (request.method === 'OPTIONS') return new Response(null, { headers });

    try {
      // ---- public ----
      if (!isAdmin && path === '/api/products' && request.method === 'GET') {
        return json(await listProducts(env), 200, headers);
      }
      if (!isAdmin && path.startsWith('/api/products/') && request.method === 'GET') {
        const slug = path.slice('/api/products/'.length);
        const product = await getProduct(env, slug);
        return product ? json(product, 200, headers) : json({ error: 'not_found' }, 404, headers);
      }
      if (!isAdmin && path === '/api/orders' && request.method === 'POST') {
        const body = await readJson(request);
        const result = await createOrder(env, body, origin);
        if (result.error) return json(result, result.status, headers);
        return json(result, 201, headers);
      }
      if (!isAdmin && path.startsWith('/api/orders/') && request.method === 'GET') {
        const orderNo = path.slice('/api/orders/'.length);
        const order = await publicOrderStatus(env, orderNo);
        return order ? json(order, 200, headers) : json({ error: 'not_found' }, 404, headers);
      }
      if (!isAdmin && path === '/api/payment/notify' && request.method === 'POST') {
        return handlePaymentNotify(env, request);
      }

      // ---- admin: auth ----
      if (isAdmin && path === '/admin/api/bootstrap' && request.method === 'POST') {
        const result = await adminBootstrap(env, await readJson(request));
        return json(result, result.error ? result.status : 200, headers);
      }
      if (isAdmin && path === '/admin/api/login' && request.method === 'POST') {
        const result = await adminLogin(env, await readJson(request));
        return json(result, result.error ? result.status : 200, headers);
      }
      if (isAdmin && path === '/admin/api/logout' && request.method === 'POST') {
        const auth = await requireAuth(request, env);
        if (auth.error) return json(auth, auth.status, headers);
        const token = request.headers.get('Authorization').slice(7);
        await env.DB.prepare(`DELETE FROM admin_sessions WHERE token = ?`).bind(token).run();
        return json({ ok: true }, 200, headers);
      }
      if (isAdmin && path === '/admin/api/me' && request.method === 'GET') {
        const auth = await requireAuth(request, env);
        if (auth.error) return json(auth, auth.status, headers);
        return json(auth.admin, 200, headers);
      }

      // ---- admin: products/variants (manager+) ----
      if (isAdmin && path === '/admin/api/products') {
        const auth = await requireAuth(request, env, 'manager');
        if (auth.error) return json(auth, auth.status, headers);
        if (request.method === 'GET') return json(await adminListProducts(env), 200, headers);
        if (request.method === 'POST') {
          const body = await readJson(request) || {};
          const fields = pick(body, PRODUCT_FIELDS, PRODUCT_CAMEL);
          if (!fields.slug || !fields.name) return json({ error: 'missing_fields' }, 400, headers);
          const cols = Object.keys(fields);
          await env.DB.prepare(
            `INSERT INTO products (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          ).bind(...cols.map((c) => fields[c])).run();
          return json({ ok: true }, 201, headers);
        }
      }
      const productIdMatch = isAdmin && path.match(/^\/admin\/api\/products\/(\d+)$/);
      if (productIdMatch) {
        const auth = await requireAuth(request, env, 'manager');
        if (auth.error) return json(auth, auth.status, headers);
        const id = productIdMatch[1];
        if (request.method === 'PUT') {
          const body = await readJson(request) || {};
          const fields = pick(body, PRODUCT_FIELDS, PRODUCT_CAMEL);
          const cols = Object.keys(fields);
          if (cols.length) {
            await env.DB.prepare(
              `UPDATE products SET ${cols.map((c) => `${c} = ?`).join(',')}, updated_at = datetime('now') WHERE id = ?`,
            ).bind(...cols.map((c) => fields[c]), id).run();
          }
          return json({ ok: true }, 200, headers);
        }
        if (request.method === 'DELETE') {
          await env.DB.prepare(`DELETE FROM product_variants WHERE product_id = ?`).bind(id).run();
          await env.DB.prepare(`DELETE FROM products WHERE id = ?`).bind(id).run();
          return json({ ok: true }, 200, headers);
        }
      }
      const variantsMatch = isAdmin && path.match(/^\/admin\/api\/products\/(\d+)\/variants$/);
      if (variantsMatch && request.method === 'POST') {
        const auth = await requireAuth(request, env, 'manager');
        if (auth.error) return json(auth, auth.status, headers);
        const body = await readJson(request) || {};
        const fields = pick(body, VARIANT_FIELDS, VARIANT_CAMEL);
        if (!fields.sku || fields.price === undefined) return json({ error: 'missing_fields' }, 400, headers);
        fields.product_id = variantsMatch[1];
        const cols = Object.keys(fields);
        await env.DB.prepare(
          `INSERT INTO product_variants (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        ).bind(...cols.map((c) => fields[c])).run();
        return json({ ok: true }, 201, headers);
      }
      const variantIdMatch = isAdmin && path.match(/^\/admin\/api\/variants\/(\d+)$/);
      if (variantIdMatch) {
        const auth = await requireAuth(request, env, 'manager');
        if (auth.error) return json(auth, auth.status, headers);
        const id = variantIdMatch[1];
        if (request.method === 'PUT') {
          const body = await readJson(request) || {};
          const fields = pick(body, VARIANT_FIELDS, VARIANT_CAMEL);
          const cols = Object.keys(fields);
          if (cols.length) {
            await env.DB.prepare(
              `UPDATE product_variants SET ${cols.map((c) => `${c} = ?`).join(',')}, updated_at = datetime('now') WHERE id = ?`,
            ).bind(...cols.map((c) => fields[c]), id).run();
          }
          return json({ ok: true }, 200, headers);
        }
        if (request.method === 'DELETE') {
          await env.DB.prepare(`DELETE FROM product_variants WHERE id = ?`).bind(id).run();
          return json({ ok: true }, 200, headers);
        }
      }

      // ---- admin: orders (staff+) ----
      if (isAdmin && path === '/admin/api/orders' && request.method === 'GET') {
        const auth = await requireAuth(request, env, 'staff');
        if (auth.error) return json(auth, auth.status, headers);
        return json(await adminOrders(env, url), 200, headers);
      }
      const orderIdMatch = isAdmin && path.match(/^\/admin\/api\/orders\/(\d+)$/);
      if (orderIdMatch) {
        const auth = await requireAuth(request, env, 'staff');
        if (auth.error) return json(auth, auth.status, headers);
        const id = orderIdMatch[1];
        if (request.method === 'GET') {
          const order = await adminOrderDetail(env, id);
          return order ? json(order, 200, headers) : json({ error: 'not_found' }, 404, headers);
        }
        if (request.method === 'PATCH') {
          const body = await readJson(request) || {};
          if (body.status && !VALID_STATUS_TRANSITIONS.includes(body.status)) {
            return json({ error: 'invalid_status' }, 400, headers);
          }
          if (body.status === 'cancelled' && (ROLE_RANK[auth.admin.role] || 0) < ROLE_RANK.manager) {
            return json({ error: 'forbidden' }, 403, headers);
          }
          const order = await env.DB.prepare(`SELECT status FROM orders WHERE id = ?`).bind(id).first();
          if (!order) return json({ error: 'not_found' }, 404, headers);
          if (body.status === 'cancelled' && ['paid', 'processing'].includes(order.status)) {
            await restoreStockForOrder(env, id);
          }
          const sets = [];
          const vals = [];
          if (body.status) { sets.push('status = ?'); vals.push(body.status); }
          if (body.trackingNo !== undefined) { sets.push('tracking_no = ?'); vals.push(body.trackingNo); }
          if (!sets.length) return json({ error: 'nothing_to_update' }, 400, headers);
          sets.push(`updated_at = datetime('now')`);
          await env.DB.prepare(`UPDATE orders SET ${sets.join(',')} WHERE id = ?`).bind(...vals, id).run();
          return json({ ok: true }, 200, headers);
        }
      }

      // ---- admin: users (super_admin only) ----
      if (isAdmin && path === '/admin/api/users') {
        const auth = await requireAuth(request, env, 'super_admin');
        if (auth.error) return json(auth, auth.status, headers);
        if (request.method === 'GET') {
          const { results } = await env.DB.prepare(`SELECT id, email, role, created_at FROM admin_users ORDER BY id ASC`).all();
          return json(results, 200, headers);
        }
        if (request.method === 'POST') {
          const body = await readJson(request) || {};
          const email = String(body.email || '').trim().toLowerCase();
          const password = String(body.password || '');
          const role = body.role;
          if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10 || !ROLE_RANK[role]) {
            return json({ error: 'invalid_input' }, 400, headers);
          }
          const hash = await hashPassword(password);
          try {
            await env.DB.prepare(`INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)`).bind(email, hash, role).run();
          } catch {
            return json({ error: 'email_taken' }, 409, headers);
          }
          return json({ ok: true }, 201, headers);
        }
      }
      const userIdMatch = isAdmin && path.match(/^\/admin\/api\/users\/(\d+)$/);
      if (userIdMatch && request.method === 'DELETE') {
        const auth = await requireAuth(request, env, 'super_admin');
        if (auth.error) return json(auth, auth.status, headers);
        const id = userIdMatch[1];
        const target = await env.DB.prepare(`SELECT role FROM admin_users WHERE id = ?`).bind(id).first();
        if (target?.role === 'super_admin') {
          const remaining = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_users WHERE role = 'super_admin' AND id != ?`).bind(id).first();
          if (remaining.n === 0) return json({ error: 'last_super_admin' }, 400, headers);
        }
        await env.DB.prepare(`DELETE FROM admin_sessions WHERE admin_user_id = ?`).bind(id).run();
        await env.DB.prepare(`DELETE FROM admin_users WHERE id = ?`).bind(id).run();
        return json({ ok: true }, 200, headers);
      }

      return json({ error: 'not_found' }, 404, headers);
    } catch (err) {
      return json({ error: 'internal_error', message: String(err) }, 500, headers);
    }
  },
};

const API = 'https://ctdc-tw-shop-api.kitty840219.workers.dev';
const ROLE_RANK = { staff: 1, manager: 2, super_admin: 3 };
const ROLE_LABEL = { staff: '客服／出貨人員', manager: '商品管理員', super_admin: '系統管理員' };
const ORDER_STATUS_LABEL = { pending_payment: '等待付款', paid: '已付款', processing: '備貨中', shipped: '已出貨', completed: '已完成', cancelled: '已取消', payment_failed: '付款失敗' };
const PRODUCT_STATUS_LABEL = { draft: '草稿', published: '上架中', archived: '下架' };

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

let session = { token: localStorage.getItem('admin-token') || '', role: '', email: '' };
let PRODUCTS_CACHE = [];

async function api(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}), ...(opts.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) { logout(); throw Object.assign(new Error('unauthorized'), { data: { error: 'unauthorized' } }); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { data });
  return data;
}

let demoMode = false;

function logout() {
  localStorage.removeItem('admin-token');
  session = { token: '', role: '', email: '' };
  demoMode = false;
  document.getElementById('app-view').hidden = true;
  document.getElementById('login-view').hidden = false;
}

function enterDemoMode() {
  demoMode = true;
  session = { token: '', role: 'super_admin', email: '（示範模式，未登入）' };
  enterApp();
}

function enterApp() {
  document.getElementById('login-view').hidden = true;
  document.getElementById('app-view').hidden = false;
  document.getElementById('current-user').textContent = demoMode ? session.email : `${session.email}（${ROLE_LABEL[session.role] || session.role}）`;
  document.querySelectorAll('.nav-btn[data-role]').forEach((btn) => {
    btn.hidden = (ROLE_RANK[session.role] || 0) < (ROLE_RANK[btn.dataset.role] || 0);
  });
  showView('dashboard');
}

function showView(name) {
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${name}`; });
  if (name === 'dashboard') loadDashboard();
  if (name === 'orders') loadOrders();
  if (name === 'products') loadProducts();
  if (name === 'sales') loadSales();
  if (name === 'users') loadUsers();
}

document.querySelectorAll('.nav-btn').forEach((btn) => btn.addEventListener('click', () => showView(btn.dataset.view)));
document.getElementById('logout-btn').addEventListener('click', async () => {
  try { await api('/admin/api/logout', { method: 'POST' }); } catch {}
  logout();
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const status = document.getElementById('login-status');
  status.textContent = '登入中…'; status.className = 'status';
  try {
    const data = await api('/admin/api/login', { method: 'POST', body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }) });
    session = { token: data.token, role: data.role, email: data.email };
    localStorage.setItem('admin-token', data.token);
    status.textContent = ''; e.target.reset();
    enterApp();
  } catch (err) {
    if (err.data) {
      status.textContent = '⚠ 登入失敗，請確認帳號密碼'; status.className = 'status error';
    } else {
      status.innerHTML = '⚠ 連不到後台伺服器（尚未部署，或部署中）。<button type="button" id="demo-mode-btn" style="margin-left:8px;text-decoration:underline;border:0;background:none;color:inherit;cursor:pointer">先看示範資料</button>';
      status.className = 'status error';
      document.getElementById('demo-mode-btn').addEventListener('click', enterDemoMode);
    }
  }
});

function openModal(html) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(modal);
  modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  return modal;
}

// ---- dashboard ----

const SETTLED_ORDER_STATUSES = ['paid', 'processing', 'shipped', 'completed'];

async function loadDashboard() {
  const box = document.getElementById('view-dashboard');
  box.innerHTML = `<div class="view-head"><h2>總覽</h2></div><div id="dashboard-cards" class="stat-grid"><p class="loading">載入中…</p></div><div id="dashboard-lowstock"></div>`;
  let orders;
  try {
    orders = await api('/admin/api/orders');
  } catch (err) {
    document.getElementById('dashboard-cards').innerHTML = '<p class="empty">載入失敗，請重新整理再試。</p>';
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const toShip = orders.filter((o) => ['paid', 'processing'].includes(o.status)).length;
  const todayOrders = orders.filter((o) => (o.created_at || '').slice(0, 10) === today);
  const todayRevenue = todayOrders.filter((o) => SETTLED_ORDER_STATUSES.includes(o.status)).reduce((n, o) => n + o.subtotal, 0);
  let cardsHtml = `
    <button type="button" class="stat-card" data-view="orders"><span class="stat-label">待出貨</span><strong class="stat-value">${toShip}</strong></button>
    <div class="stat-card"><span class="stat-label">今日訂單</span><strong class="stat-value">${todayOrders.length}</strong></div>
    <div class="stat-card"><span class="stat-label">今日營業額</span><strong class="stat-value">NT$${todayRevenue.toLocaleString()}</strong></div>
  `;
  if ((ROLE_RANK[session.role] || 0) >= ROLE_RANK.manager) {
    try {
      const products = await api('/admin/api/products');
      const lowStock = [];
      products.forEach((p) => p.variants.forEach((v) => { if (v.stock_qty < 5) lowStock.push({ product: p.name, variant: v.option_label || '標準款', stock: v.stock_qty }); }));
      cardsHtml += `<button type="button" class="stat-card${lowStock.length ? ' stat-warn' : ''}" data-view="products"><span class="stat-label">低庫存規格</span><strong class="stat-value">${lowStock.length}</strong></button>`;
      document.getElementById('dashboard-cards').innerHTML = cardsHtml;
      const lowBox = document.getElementById('dashboard-lowstock');
      if (lowStock.length) {
        lowBox.innerHTML = `<h3 class="section-sub">低庫存提醒（少於 5 件）</h3><table class="data-table"><thead><tr><th>商品</th><th>規格</th><th>庫存</th></tr></thead><tbody>${lowStock.map((l) => `<tr><td>${esc(l.product)}</td><td>${esc(l.variant)}</td><td>${l.stock}</td></tr>`).join('')}</tbody></table>`;
      }
    } catch (err) {
      document.getElementById('dashboard-cards').innerHTML = cardsHtml;
    }
  } else {
    document.getElementById('dashboard-cards').innerHTML = cardsHtml;
  }
  document.querySelectorAll('#dashboard-cards [data-view]').forEach((el) => el.addEventListener('click', () => showView(el.dataset.view)));
}

// ---- sales ----

const SALES_RANGES = [
  { key: 'today', label: '今日' },
  { key: 'yesterday', label: '昨日' },
  { key: 'last7', label: '過去 7 天' },
  { key: 'last30', label: '過去 30 天' },
];
let salesOrdersCache = null;
let salesProductsCache = null;
let salesRangeKey = 'today';

async function loadSales() {
  const box = document.getElementById('view-sales');
  box.innerHTML = `<div class="view-head"><h2>銷售分析</h2></div><div class="tab-bar" id="sales-subtabs"><button type="button" data-sub="sales" class="active">銷售</button><button type="button" data-sub="products">商品</button></div><div class="tab-bar" id="sales-range">${SALES_RANGES.map((r, i) => `<button type="button" data-key="${r.key}" class="${i === 0 ? 'active' : ''}">${r.label}</button>`).join('')}</div><div id="sales-body"><p class="loading">載入中…</p></div>`;
  try {
    salesOrdersCache = await api('/admin/api/orders');
  } catch (err) {
    document.getElementById('sales-body').innerHTML = '<p class="empty">載入失敗，請重新整理再試。</p>';
    return;
  }
  document.querySelectorAll('#sales-range button').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('#sales-range button').forEach((b) => b.classList.toggle('active', b === btn));
    salesRangeKey = btn.dataset.key;
    renderSales(salesRangeKey);
  }));
  document.querySelectorAll('#sales-subtabs button').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('#sales-subtabs button').forEach((b) => b.classList.toggle('active', b === btn));
    document.getElementById('sales-range').hidden = btn.dataset.sub !== 'sales';
    if (btn.dataset.sub === 'sales') renderSales(salesRangeKey);
    else renderSalesProducts();
  }));
  renderSales(salesRangeKey);
}

function renderSales(range) {
  const body = document.getElementById('sales-body');
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start;
  if (range === 'yesterday') { end.setUTCDate(end.getUTCDate() - 1); start = new Date(end); }
  else if (range === 'last7') { start = new Date(end); start.setUTCDate(start.getUTCDate() - 6); }
  else if (range === 'last30') { start = new Date(end); start.setUTCDate(start.getUTCDate() - 29); }
  else { start = new Date(end); }
  const endExclusive = new Date(end);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const inRange = salesOrdersCache.filter((o) => {
    const t = new Date((o.created_at || '').replace(' ', 'T') + 'Z');
    return t >= start && t < endExclusive && SETTLED_ORDER_STATUSES.includes(o.status);
  });
  const revenue = inRange.reduce((n, o) => n + o.subtotal, 0);
  const count = inRange.length;
  const aov = count ? Math.round(revenue / count) : 0;
  const buyers = new Set(inRange.map((o) => o.customer_email)).size;
  const perBuyer = buyers ? Math.round(revenue / buyers) : 0;
  const byDay = {};
  inRange.forEach((o) => { const d = (o.created_at || '').slice(0, 10); byDay[d] = (byDay[d] || 0) + o.subtotal; });
  const dayKeys = Object.keys(byDay).sort();
  const maxVal = Math.max(1, ...Object.values(byDay));
  body.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">銷售額</span><strong class="stat-value">NT$${revenue.toLocaleString()}</strong></div>
      <div class="stat-card"><span class="stat-label">訂單數</span><strong class="stat-value">${count}</strong></div>
      <div class="stat-card"><span class="stat-label">平均訂單金額</span><strong class="stat-value">NT$${aov.toLocaleString()}</strong></div>
      <div class="stat-card"><span class="stat-label">買家數</span><strong class="stat-value">${buyers}</strong></div>
      <div class="stat-card"><span class="stat-label">客單價</span><strong class="stat-value">NT$${perBuyer.toLocaleString()}</strong></div>
    </div>
    ${dayKeys.length ? `<div class="bar-chart">${dayKeys.map((d) => `<div class="bar-col"><div class="bar" style="height:${Math.max(4, Math.round((byDay[d] / maxVal) * 140))}px" title="${d}：NT$${byDay[d].toLocaleString()}"></div><span class="bar-label">${d.slice(5)}</span></div>`).join('')}</div>` : '<p class="empty">這段期間沒有已成立的訂單。</p>'}
  `;
}

async function renderSalesProducts() {
  const body = document.getElementById('sales-body');
  body.innerHTML = '<p class="loading">載入中…</p>';
  if (!salesProductsCache) {
    try { salesProductsCache = await api('/admin/api/products'); } catch (err) { body.innerHTML = '<p class="empty">載入失敗，請重新整理再試。</p>'; return; }
  }
  const rows = salesProductsCache.map((p) => ({
    name: p.name,
    sold: p.variants.reduce((n, v) => n + (v.sold_qty || 0), 0),
    revenue: p.variants.reduce((n, v) => n + (v.sold_qty || 0) * v.price, 0),
    createdAt: p.created_at,
  }));
  const topSelling = [...rows].sort((a, b) => b.sold - a.sold).slice(0, 5);
  const newest = [...rows].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);
  body.innerHTML = `
    <h3 class="section-sub">熱銷商品（依累計已售出排序，前 5 名）</h3>
    ${topSelling.some((r) => r.sold > 0)
      ? `<table class="data-table"><thead><tr><th>商品</th><th>累計已售出</th><th>累計營收</th></tr></thead><tbody>${topSelling.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.sold}</td><td>NT$${r.revenue.toLocaleString()}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">目前還沒有任何銷售紀錄。</p>'}
    <h3 class="section-sub">新上架商品</h3>
    ${newest.length
      ? `<table class="data-table"><thead><tr><th>商品</th><th>上架時間</th></tr></thead><tbody>${newest.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.createdAt || '')}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">尚未新增任何商品。</p>'}
    <p class="note-muted">「訪客數」「加入購物車轉換率」這類流量數據，需要另外在商店頁加裝真正的流量追蹤才會有真實數字，目前還沒做，這裡先不顯示假資料。</p>
  `;
}

// ---- orders ----

const ORDER_TABS = [
  { key: 'unpaid', label: '尚未付款', statuses: ['pending_payment'] },
  { key: 'toship', label: '待出貨', statuses: ['paid', 'processing'] },
  { key: 'shipped', label: '已出貨', statuses: ['shipped'] },
  { key: 'done', label: '已完成', statuses: ['completed'] },
  { key: 'other', label: '已取消／異常', statuses: ['cancelled', 'payment_failed'] },
];
let ordersCache = [];

async function loadOrders() {
  const box = document.getElementById('view-orders');
  box.innerHTML = `<div class="view-head"><h2>訂單管理</h2></div><div class="tab-bar" id="order-tabs">${ORDER_TABS.map((t, i) => `<button type="button" data-key="${t.key}" class="${t.key === 'toship' ? 'active' : ''}">${t.label}</button>`).join('')}</div><div id="orders-table"><p class="loading">載入中…</p></div>`;
  try {
    ordersCache = await api('/admin/api/orders');
  } catch (err) {
    document.getElementById('orders-table').innerHTML = '<p class="empty">載入失敗，請重新整理再試。</p>';
    return;
  }
  document.querySelectorAll('#order-tabs button').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('#order-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    renderOrdersTable(btn.dataset.key);
  }));
  renderOrdersTable('toship');
}

function renderOrdersTable(tabKey) {
  const tab = ORDER_TABS.find((t) => t.key === tabKey) || ORDER_TABS[1];
  const orders = ordersCache.filter((o) => tab.statuses.includes(o.status));
  const tableBox = document.getElementById('orders-table');
  if (!orders.length) { tableBox.innerHTML = '<p class="empty">這個分類目前沒有訂單。</p>'; return; }
  tableBox.innerHTML = `<table class="data-table"><thead><tr><th>訂單編號</th><th>收件人</th><th>狀態</th><th>金額</th><th>建立時間</th></tr></thead><tbody>${orders.map((o) => `<tr data-id="${o.id}"><td>${esc(o.order_no)}</td><td>${esc(o.customer_name)}</td><td>${ORDER_STATUS_LABEL[o.status] || esc(o.status)}</td><td>NT$${o.subtotal.toLocaleString()}</td><td>${esc(o.created_at)}</td></tr>`).join('')}</tbody></table>`;
  tableBox.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => openOrderDetail(tr.dataset.id, tabKey)));
}

async function openOrderDetail(id, currentFilter) {
  let order;
  try { order = await api(`/admin/api/orders/${id}`); } catch { return; }
  const canCancel = (ROLE_RANK[session.role] || 0) >= ROLE_RANK.manager;
  const transitions = ['processing', 'shipped', 'completed'];
  if (canCancel) transitions.push('cancelled');
  let optionsHtml = '';
  if (!transitions.includes(order.status)) {
    optionsHtml += `<option value="${order.status}" selected disabled>${ORDER_STATUS_LABEL[order.status] || order.status}（目前狀態）</option>`;
  }
  optionsHtml += transitions.map((s) => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${ORDER_STATUS_LABEL[s]}</option>`).join('');
  const modal = openModal(`
    <button class="modal-close" aria-label="關閉">✕</button>
    <h2>訂單 ${esc(order.order_no)}</h2>
    <p>${esc(order.customer_name)}・${esc(order.customer_phone)}・${esc(order.customer_email)}</p>
    <p>${esc(order.shipping_address)}</p>
    ${order.note ? `<p>備註：${esc(order.note)}</p>` : ''}
    <div class="order-items">${order.items.map((i) => `<div class="order-item-row"><span>${esc(i.product_name)}${i.option_label ? `（${esc(i.option_label)}）` : ''} x${i.qty}</span><span>NT$${(i.unit_price * i.qty).toLocaleString()}</span></div>`).join('')}</div>
    <p class="order-total"><span>總金額</span><span>NT$${order.subtotal.toLocaleString()}</span></p>
    <form id="order-form">
      <label>訂單狀態<select name="status">${optionsHtml}</select></label>
      <label>物流追蹤碼<input name="trackingNo" value="${esc(order.tracking_no || '')}"></label>
      <div class="modal-actions"><button type="submit">儲存</button><p class="status" id="order-save-status"></p></div>
    </form>
  `);
  modal.querySelector('#order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const statusEl = modal.querySelector('#order-save-status');
    try {
      await api(`/admin/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status: fd.get('status'), trackingNo: fd.get('trackingNo') }) });
      statusEl.textContent = '已儲存'; statusEl.className = 'status ok';
      ordersCache = await api('/admin/api/orders');
      renderOrdersTable(currentFilter);
      setTimeout(() => modal.remove(), 600);
    } catch (err) {
      statusEl.textContent = '⚠ 儲存失敗，請確認權限或稍後再試'; statusEl.className = 'status error';
    }
  });
}

// ---- products ----

let lowStockOnly = false;

async function loadProducts() {
  const box = document.getElementById('view-products');
  box.innerHTML = `<div class="view-head"><h2>商品管理</h2><div style="display:flex;gap:10px"><button type="button" id="lowstock-toggle" class="chip-toggle${lowStockOnly ? ' active' : ''}">只看低庫存</button><button type="button" id="new-product-btn">＋ 新增商品</button></div></div><div id="products-list"><p class="loading">載入中…</p></div>`;
  document.getElementById('new-product-btn').addEventListener('click', () => openProductForm(null));
  document.getElementById('lowstock-toggle').addEventListener('click', (e) => {
    lowStockOnly = !lowStockOnly;
    e.target.classList.toggle('active', lowStockOnly);
    renderProductsList();
  });
  renderProductsList();
}

async function renderProductsList() {
  const list = document.getElementById('products-list');
  try {
    const products = await api('/admin/api/products');
    PRODUCTS_CACHE = products;
    const shown = lowStockOnly ? products.filter((p) => p.variants.some((v) => v.stock_qty < 5)) : products;
    if (!shown.length) { list.innerHTML = `<p class="empty">${lowStockOnly ? '沒有低庫存的商品。' : '尚未新增任何商品。'}</p>`; return; }
    list.innerHTML = shown.map((p) => `
      <div class="product-card">
        <div class="product-card-head">
          <div><h3>${esc(p.name)}<span class="tag tag-${p.status}">${PRODUCT_STATUS_LABEL[p.status] || p.status}</span></h3><p class="muted">/${esc(p.slug)}${p.category ? ` ・ ${esc(p.category)}` : ''}</p></div>
          <div class="product-card-actions"><button type="button" data-act="edit-product" data-id="${p.id}">編輯</button><button type="button" data-act="delete-product" data-id="${p.id}">刪除</button></div>
        </div>
        <table class="data-table"><thead><tr><th>SKU</th><th>規格</th><th>價格</th><th>庫存</th><th>已售出</th><th></th></tr></thead><tbody>
          ${p.variants.map((v) => `<tr${v.stock_qty < 5 ? ' class="row-warn"' : ''}><td>${esc(v.sku)}</td><td>${esc(v.option_label)}</td><td>NT$${v.price.toLocaleString()}</td><td>${v.stock_qty}</td><td>${v.sold_qty || 0}</td><td><button type="button" data-act="edit-variant" data-id="${v.id}" data-product="${p.id}">編輯</button><button type="button" data-act="delete-variant" data-id="${v.id}" data-product="${p.id}">刪除</button></td></tr>`).join('')}
          <tr><td colspan="6"><button type="button" data-act="new-variant" data-product="${p.id}">＋ 新增規格</button></td></tr>
        </tbody></table>
      </div>`).join('');
    list.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => handleProductAction(btn)));
  } catch (err) {
    const TEST_PRODUCTS = [
      { name: 'CTDC 帆布提袋', price: 450 },
      { name: '空間感香氛蠟燭', price: 680 },
      { name: '陶瓷托盤', price: 580 },
    ];
    list.innerHTML = `<p class="empty">尚未連接後端，以下為示範資料（跟前台商店頁的測試商品一致；shop-worker 部署好之後會自動換成真正的商品，不用手動改）。</p>` + TEST_PRODUCTS.map((p) => `
      <div class="product-card">
        <div class="product-card-head">
          <div><h3>${esc(p.name)}<span class="tag" style="background:#f5e6e4;color:var(--danger)">測試商品</span></h3></div>
        </div>
        <table class="data-table"><thead><tr><th>示範價格</th></tr></thead><tbody><tr><td>NT$${p.price.toLocaleString()}</td></tr></tbody></table>
      </div>`).join('');
  }
}

async function handleProductAction(btn) {
  const act = btn.dataset.act;
  const product = PRODUCTS_CACHE.find((p) => String(p.id) === btn.dataset.id) || PRODUCTS_CACHE.find((p) => String(p.id) === btn.dataset.product);
  if (act === 'edit-product') return openProductForm(product);
  if (act === 'delete-product') {
    if (!confirm(`確定要刪除「${product.name}」嗎？此動作無法復原。`)) return;
    try { await api(`/admin/api/products/${btn.dataset.id}`, { method: 'DELETE' }); renderProductsList(); } catch { alert('刪除失敗'); }
    return;
  }
  if (act === 'new-variant') return openVariantForm(btn.dataset.product, null);
  if (act === 'edit-variant') return openVariantForm(btn.dataset.product, product.variants.find((v) => String(v.id) === btn.dataset.id));
  if (act === 'delete-variant') {
    if (!confirm('確定要刪除這個規格嗎？')) return;
    try { await api(`/admin/api/variants/${btn.dataset.id}`, { method: 'DELETE' }); renderProductsList(); } catch { alert('刪除失敗'); }
  }
}

function openProductForm(product) {
  const isNew = !product;
  const modal = openModal(`
    <button class="modal-close" aria-label="關閉">✕</button>
    <h2>${isNew ? '新增商品' : '編輯商品'}</h2>
    <form id="product-form">
      <label>商品名稱 *<input name="name" required value="${esc(product?.name || '')}"></label>
      <label>網址代稱（slug，只能用小寫英數字與 -）*<input name="slug" required pattern="[a-z0-9-]+" value="${esc(product?.slug || '')}"></label>
      <label>分類（會顯示在商店頁的分類列，例如：提袋、香氛、餐具）<input name="category" value="${esc(product?.category || '')}"></label>
      <label>商品描述<textarea name="description" rows="4">${esc(product?.description || '')}</textarea></label>
      <label>圖片網址<input name="imageUrl" value="${esc(product?.image_url || '')}"></label>
      <label>狀態<select name="status">${Object.entries(PRODUCT_STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${product?.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>排序（數字越小越前面）<input type="number" name="sortOrder" value="${product?.sort_order ?? 0}"></label>
      <div class="modal-actions"><button type="submit">${isNew ? '新增' : '儲存'}</button><p class="status" id="product-form-status"></p></div>
    </form>
  `);
  modal.querySelector('#product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { name: fd.get('name'), slug: fd.get('slug'), category: fd.get('category'), description: fd.get('description'), imageUrl: fd.get('imageUrl'), status: fd.get('status'), sortOrder: parseInt(fd.get('sortOrder'), 10) || 0 };
    const statusEl = modal.querySelector('#product-form-status');
    try {
      if (isNew) await api('/admin/api/products', { method: 'POST', body: JSON.stringify(body) });
      else await api(`/admin/api/products/${product.id}`, { method: 'PUT', body: JSON.stringify(body) });
      modal.remove();
      renderProductsList();
    } catch (err) {
      statusEl.textContent = '⚠ 儲存失敗，請確認 slug 是否已被使用'; statusEl.className = 'status error';
    }
  });
}

function openVariantForm(productId, variant) {
  const isNew = !variant;
  const modal = openModal(`
    <button class="modal-close" aria-label="關閉">✕</button>
    <h2>${isNew ? '新增規格' : '編輯規格'}</h2>
    <form id="variant-form">
      <label>SKU *<input name="sku" required value="${esc(variant?.sku || '')}"></label>
      <label>規格名稱（如：L / 黑色）<input name="optionLabel" value="${esc(variant?.option_label || '')}"></label>
      <label>價格（NT$）*<input type="number" name="price" min="0" required value="${variant?.price ?? ''}"></label>
      <label>庫存數量 *<input type="number" name="stockQty" min="0" required value="${variant?.stock_qty ?? 0}"></label>
      <label>排序<input type="number" name="sortOrder" value="${variant?.sort_order ?? 0}"></label>
      <div class="modal-actions"><button type="submit">${isNew ? '新增' : '儲存'}</button><p class="status" id="variant-form-status"></p></div>
    </form>
  `);
  modal.querySelector('#variant-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { sku: fd.get('sku'), optionLabel: fd.get('optionLabel'), price: parseInt(fd.get('price'), 10), stockQty: parseInt(fd.get('stockQty'), 10), sortOrder: parseInt(fd.get('sortOrder'), 10) || 0 };
    const statusEl = modal.querySelector('#variant-form-status');
    try {
      if (isNew) await api(`/admin/api/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(body) });
      else await api(`/admin/api/variants/${variant.id}`, { method: 'PUT', body: JSON.stringify(body) });
      modal.remove();
      renderProductsList();
    } catch (err) {
      statusEl.textContent = '⚠ 儲存失敗，請確認 SKU 是否已被使用'; statusEl.className = 'status error';
    }
  });
}

// ---- users ----

async function loadUsers() {
  const box = document.getElementById('view-users');
  box.innerHTML = `<div class="view-head"><h2>帳號管理</h2><button type="button" id="new-user-btn">＋ 新增帳號</button></div><div id="users-list"><p class="loading">載入中…</p></div>`;
  document.getElementById('new-user-btn').addEventListener('click', openUserForm);
  renderUsersList();
}

async function renderUsersList() {
  const list = document.getElementById('users-list');
  try {
    const users = await api('/admin/api/users');
    list.innerHTML = `<table class="data-table"><thead><tr><th>Email</th><th>角色</th><th>建立時間</th><th></th></tr></thead><tbody>${users.map((u) => `<tr><td>${esc(u.email)}</td><td>${ROLE_LABEL[u.role] || esc(u.role)}</td><td>${esc(u.created_at)}</td><td>${u.email === session.email ? '' : `<button type="button" data-id="${u.id}" data-act="delete-user">刪除</button>`}</td></tr>`).join('')}</tbody></table>`;
    list.querySelectorAll('[data-act=delete-user]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('確定要刪除這個帳號嗎？')) return;
      try {
        await api(`/admin/api/users/${btn.dataset.id}`, { method: 'DELETE' });
        renderUsersList();
      } catch (err) {
        alert(err.data?.error === 'last_super_admin' ? '不能刪除最後一位系統管理員' : '刪除失敗');
      }
    }));
  } catch (err) {
    list.innerHTML = '<p class="empty">載入失敗，請重新整理再試。</p>';
  }
}

function openUserForm() {
  const modal = openModal(`
    <button class="modal-close" aria-label="關閉">✕</button>
    <h2>新增帳號</h2>
    <form id="user-form">
      <label>電子信箱 *<input type="email" name="email" required></label>
      <label>密碼（至少 10 碼）*<input type="password" name="password" required minlength="10"></label>
      <label>角色 *<select name="role">
        <option value="staff">客服／出貨人員（只能看訂單、標記出貨）</option>
        <option value="manager">商品管理員（可管理商品、庫存、訂單）</option>
        <option value="super_admin">系統管理員（可管理所有帳號）</option>
      </select></label>
      <div class="modal-actions"><button type="submit">新增</button><p class="status" id="user-form-status"></p></div>
    </form>
  `);
  modal.querySelector('#user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const statusEl = modal.querySelector('#user-form-status');
    try {
      await api('/admin/api/users', { method: 'POST', body: JSON.stringify({ email: fd.get('email'), password: fd.get('password'), role: fd.get('role') }) });
      modal.remove();
      renderUsersList();
    } catch (err) {
      statusEl.textContent = err.data?.error === 'email_taken' ? '⚠ 這個信箱已經有帳號了' : '⚠ 新增失敗，請確認欄位填寫正確';
      statusEl.className = 'status error';
    }
  });
}

// ---- boot ----

(async function init() {
  if (session.token) {
    try {
      const me = await api('/admin/api/me');
      session.role = me.role; session.email = me.email;
      enterApp();
      return;
    } catch {
      localStorage.removeItem('admin-token');
      session.token = '';
    }
  }
  document.getElementById('login-view').hidden = false;
})();

const API = 'https://ctdc-tw-shop-api.kitty840219.workers.dev';
const ROLE_RANK = { staff: 1, manager: 2, super_admin: 3 };
const ROLE_LABEL = { staff: '客服／出貨人員', manager: '商品管理員', super_admin: '系統管理員' };
const ORDER_STATUS_LABEL = { pending_payment: '等待付款', paid: '已付款', processing: '備貨中', shipped: '已出貨', completed: '已完成', cancelled: '已取消', payment_failed: '付款失敗' };
const PRODUCT_STATUS_LABEL = { draft: '草稿', published: '上架中', archived: '下架' };

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

let session = { token: localStorage.getItem('admin-token') || '', role: '', email: '' };
let PRODUCTS_CACHE = [];

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}), ...(opts.headers || {}) },
  });
  if (res.status === 401) { logout(); throw Object.assign(new Error('unauthorized'), { data: { error: 'unauthorized' } }); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { data });
  return data;
}

function logout() {
  localStorage.removeItem('admin-token');
  session = { token: '', role: '', email: '' };
  document.getElementById('app-view').hidden = true;
  document.getElementById('login-view').hidden = false;
}

function enterApp() {
  document.getElementById('login-view').hidden = true;
  document.getElementById('app-view').hidden = false;
  document.getElementById('current-user').textContent = `${session.email}（${ROLE_LABEL[session.role] || session.role}）`;
  document.querySelectorAll('.nav-btn[data-role]').forEach((btn) => {
    btn.hidden = (ROLE_RANK[session.role] || 0) < (ROLE_RANK[btn.dataset.role] || 0);
  });
  showView('orders');
}

function showView(name) {
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${name}`; });
  if (name === 'orders') loadOrders();
  if (name === 'products') loadProducts();
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
    status.textContent = '⚠ 登入失敗，請確認帳號密碼'; status.className = 'status error';
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

// ---- orders ----

async function loadOrders() {
  const box = document.getElementById('view-orders');
  box.innerHTML = `<div class="view-head"><h2>訂單管理</h2><select id="order-filter"><option value="">全部狀態</option>${Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><div id="orders-table"><p class="loading">載入中…</p></div>`;
  document.getElementById('order-filter').addEventListener('change', (e) => renderOrdersTable(e.target.value));
  renderOrdersTable('');
}

async function renderOrdersTable(status) {
  const tableBox = document.getElementById('orders-table');
  try {
    const orders = await api(`/admin/api/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`);
    if (!orders.length) { tableBox.innerHTML = '<p class="empty">沒有符合條件的訂單。</p>'; return; }
    tableBox.innerHTML = `<table class="data-table"><thead><tr><th>訂單編號</th><th>收件人</th><th>狀態</th><th>金額</th><th>建立時間</th></tr></thead><tbody>${orders.map((o) => `<tr data-id="${o.id}"><td>${esc(o.order_no)}</td><td>${esc(o.customer_name)}</td><td>${ORDER_STATUS_LABEL[o.status] || esc(o.status)}</td><td>NT$${o.subtotal.toLocaleString()}</td><td>${esc(o.created_at)}</td></tr>`).join('')}</tbody></table>`;
    tableBox.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => openOrderDetail(tr.dataset.id, status)));
  } catch (err) {
    tableBox.innerHTML = '<p class="empty">載入失敗，請重新整理再試。</p>';
  }
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
      renderOrdersTable(currentFilter);
      setTimeout(() => modal.remove(), 600);
    } catch (err) {
      statusEl.textContent = '⚠ 儲存失敗，請確認權限或稍後再試'; statusEl.className = 'status error';
    }
  });
}

// ---- products ----

async function loadProducts() {
  const box = document.getElementById('view-products');
  box.innerHTML = `<div class="view-head"><h2>商品管理</h2><button type="button" id="new-product-btn">＋ 新增商品</button></div><div id="products-list"><p class="loading">載入中…</p></div>`;
  document.getElementById('new-product-btn').addEventListener('click', () => openProductForm(null));
  renderProductsList();
}

async function renderProductsList() {
  const list = document.getElementById('products-list');
  try {
    const products = await api('/admin/api/products');
    PRODUCTS_CACHE = products;
    if (!products.length) { list.innerHTML = '<p class="empty">尚未新增任何商品。</p>'; return; }
    list.innerHTML = products.map((p) => `
      <div class="product-card">
        <div class="product-card-head">
          <div><h3>${esc(p.name)}<span class="tag tag-${p.status}">${PRODUCT_STATUS_LABEL[p.status] || p.status}</span></h3><p class="muted">/${esc(p.slug)}</p></div>
          <div class="product-card-actions"><button type="button" data-act="edit-product" data-id="${p.id}">編輯</button><button type="button" data-act="delete-product" data-id="${p.id}">刪除</button></div>
        </div>
        <table class="data-table"><thead><tr><th>SKU</th><th>規格</th><th>價格</th><th>庫存</th><th></th></tr></thead><tbody>
          ${p.variants.map((v) => `<tr><td>${esc(v.sku)}</td><td>${esc(v.option_label)}</td><td>NT$${v.price.toLocaleString()}</td><td>${v.stock_qty}</td><td><button type="button" data-act="edit-variant" data-id="${v.id}" data-product="${p.id}">編輯</button><button type="button" data-act="delete-variant" data-id="${v.id}" data-product="${p.id}">刪除</button></td></tr>`).join('')}
          <tr><td colspan="5"><button type="button" data-act="new-variant" data-product="${p.id}">＋ 新增規格</button></td></tr>
        </tbody></table>
      </div>`).join('');
    list.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => handleProductAction(btn)));
  } catch (err) {
    list.innerHTML = '<p class="empty">載入失敗，請重新整理再試。</p>';
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
    const body = { name: fd.get('name'), slug: fd.get('slug'), description: fd.get('description'), imageUrl: fd.get('imageUrl'), status: fd.get('status'), sortOrder: parseInt(fd.get('sortOrder'), 10) || 0 };
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

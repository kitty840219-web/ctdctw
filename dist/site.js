const menu=document.querySelector('.menu'),nav=document.querySelector('nav');
menu?.addEventListener('click',()=>{const opened=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(opened));menu.textContent=opened?'關閉 ✕':'選單 ☰'});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.classList.contains('open')){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='選單 ☰';menu.focus()}});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});button.classList.add('active');button.setAttribute('aria-pressed','true');document.querySelectorAll('[data-category]').forEach(p=>p.hidden=button.dataset.filter!=='all'&&p.dataset.category!==button.dataset.filter)}));

const CONTACT_ENDPOINT='https://ctdc-tw-contact-form.kitty840219.workers.dev';
const form=document.getElementById('contact-form');
if(form){
 const a=Math.floor(Math.random()*8)+2,b=Math.floor(Math.random()*8)+2;
 const q=document.getElementById('captcha-q'),expected=form.querySelector('[name=captchaExpected]');
 if(q&&expected){q.textContent=`驗證碼：${a} + ${b} = ?`;expected.value=String(a+b)}
 const status=document.getElementById('form-status'),btn=form.querySelector('button[type=submit]');
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const fd=new FormData(form),data={};
  for(const[key,val]of fd.entries()){
   if(form.querySelector(`[name="${key}"][type=checkbox]`)){(data[key]=data[key]||[]).push(val)}
   else{data[key]=val}
  }
  btn.disabled=true;status.textContent='傳送中…';status.className='form-status';
  try{
   const res=await fetch(CONTACT_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   const json=await res.json();
   if(json.ok){status.textContent='已送出，我們會盡快與您聯繫！';status.className='form-status ok';form.reset();if(q&&expected){const na=Math.floor(Math.random()*8)+2,nb=Math.floor(Math.random()*8)+2;q.textContent=`驗證碼：${na} + ${nb} = ?`;expected.value=String(na+nb)}}
   else{status.textContent='⚠ 送出失敗，麻煩改用電話 (02) 2500-7668 或 Email ctdc@ctdcdesign.com 與我們聯繫，謝謝。';status.className='form-status error'}
  }catch(err){status.textContent='⚠ 送出失敗，麻煩改用電話 (02) 2500-7668 或 Email ctdc@ctdcdesign.com 與我們聯繫，謝謝。';status.className='form-status error'}
  btn.disabled=false;
 });
}

const galleryMain=document.querySelector('.gallery-main');
if(galleryMain){
 const thumbs=[...document.querySelectorAll('.gallery-thumb')];
 const track=document.querySelector('.gallery-thumbs');
 let current=0,timer;
 function show(i,scroll=true){
  current=(i+thumbs.length)%thumbs.length;
  galleryMain.style.opacity=0;
  setTimeout(()=>{
   galleryMain.src=thumbs[current].dataset.full;galleryMain.style.opacity=1;
   galleryMain.style.animation='none';void galleryMain.offsetWidth;galleryMain.style.animation='';
  },150);
  thumbs.forEach(t=>t.classList.remove('active'));
  thumbs[current].classList.add('active');
  if(scroll)thumbs[current].scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
 }
 function restart(){clearInterval(timer);timer=setInterval(()=>show(current+1),5000)}
 thumbs.forEach((thumb,i)=>thumb.addEventListener('click',()=>{show(i);restart()}));
 document.querySelector('.thumb-nav.prev')?.addEventListener('click',()=>{show(current-1);restart()});
 document.querySelector('.thumb-nav.next')?.addEventListener('click',()=>{show(current+1);restart()});
 if(thumbs.length>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches)restart();
}

const SHOP_API='https://ctdc-tw-shop-api.kitty840219.workers.dev';
const CART_KEY='ctdc-cart';
function shopFetch(url,opts,timeoutMs=10000){
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
 return fetch(url,{...opts,signal:ctrl.signal}).finally(()=>clearTimeout(timer));
}
// Stand-ins shown while shop-worker isn't deployed yet, shaped exactly like
// a real GET /api/products/:slug response so they can share render code.
// Negative variant ids so they can never collide with a real DB row.
const TEST_PRODUCTS=[
 {slug:'test-bag',name:'CTDC 帆布提袋',category:'測試商品',description:'厚磅帆布，內襯口袋可放筆記本與隨身小物。',image_url:'https://cdn.gamma.app/3cjbz0ve4bkt26w/design-anything/JGUOjDX2iD0cX3btxRq1r/KqqWh4o80UfEoZDmzORSy.jpg',variants:[{id:-1,option_label:'標準款',price:450,stock_qty:99}]},
 {slug:'test-candle',name:'空間感香氛蠟燭',category:'測試商品',description:'大豆蠟手工製作，燃燒時間約 45 小時。',image_url:'https://cdn.gamma.app/3cjbz0ve4bkt26w/design-anything/wVcf3n2SYkRUweIYXInp2/Jm-s0uEiFNoIvukxeEtK1.jpg',variants:[{id:-2,option_label:'標準款',price:680,stock_qty:99}]},
 {slug:'test-tray',name:'陶瓷托盤',category:'測試商品',description:'手工釉燒陶瓷托盤，適合收納鑰匙、香氛或作為茶具承盤。',image_url:'https://cdn.gamma.app/3cjbz0ve4bkt26w/design-anything/DFcpWC9uPQN36a6DORwxw/PGUAGVqJIJIC4cb71M0R2.jpg',variants:[{id:-3,option_label:'標準款',price:580,stock_qty:99}]},
];
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function money(n){return 'NT$'+Math.round(n||0).toLocaleString('zh-Hant')}
function cartGet(){try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]')}catch{return[]}}
function cartSet(items){try{localStorage.setItem(CART_KEY,JSON.stringify(items))}catch{}updateCartBadge()}
function cartAdd(item){const items=cartGet();const existing=items.find(i=>i.variantId===item.variantId);if(existing){existing.qty=Math.min(99,existing.qty+item.qty)}else{items.push(item)}cartSet(items)}
function cartRemove(variantId){cartSet(cartGet().filter(i=>i.variantId!==variantId))}
function cartUpdateQty(variantId,qty){const items=cartGet();const it=items.find(i=>i.variantId===variantId);if(!it)return;if(qty<1)return cartRemove(variantId);it.qty=Math.min(99,qty);cartSet(items)}
function updateCartBadge(){const badge=document.getElementById('cart-count');if(!badge)return;const count=cartGet().reduce((n,i)=>n+i.qty,0);badge.textContent=String(count);badge.hidden=count===0}
updateCartBadge();

function miniCartBar(){
 let bar=document.getElementById('mini-cart-bar');
 if(!bar){
  bar=document.createElement('div');
  bar.id='mini-cart-bar';bar.className='mini-cart-bar';
  bar.innerHTML='<span class="mc-info">購物車共 <strong id="mc-count">0</strong> 件・<strong id="mc-total">NT$0</strong></span><a href="cart.html">前往購物車 →</a>';
  document.body.appendChild(bar);
 }
 const items=cartGet();
 const count=items.reduce((n,i)=>n+i.qty,0);
 bar.querySelector('#mc-count').textContent=String(count);
 bar.querySelector('#mc-total').textContent=money(items.reduce((n,i)=>n+i.price*i.qty,0));
 bar.classList.toggle('show',count>0);
}

const shopGrid=document.getElementById('shop-grid');
const shopCats=document.getElementById('shop-cats');
if(shopGrid){
 shopFetch(`${SHOP_API}/api/products`).then(r=>r.json()).then(products=>{
  if(!Array.isArray(products)||!products.length){shopGrid.innerHTML='<p class="empty">目前尚無上架商品，敬請期待。</p>';return}
  const cats=['全部商品',...new Set(products.map(p=>p.category).filter(Boolean))];
  let active='全部商品';
  function renderGrid(){
   const list=active==='全部商品'?products:products.filter(p=>p.category===active);
   shopGrid.innerHTML=list.map(p=>{
    const prices=p.variants.map(v=>v.price);
    const inStock=p.variants.some(v=>v.stock_qty>0);
    const priceLabel=prices.length&&Math.min(...prices)!==Math.max(...prices)?`${money(Math.min(...prices))} 起`:money(prices[0]||0);
    return `<a class="project" href="product.html?slug=${encodeURIComponent(p.slug)}"><div class="image">${p.image_url?`<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async">`:''}</div><div class="project-meta"><div><h3>${escapeHtml(p.name)}</h3><small${inStock?'':' class="out-of-stock"'}>${priceLabel}${inStock?'':'・已售完'}</small></div><span aria-hidden="true">↗</span></div></a>`;
   }).join('')||'<p class="empty">這個分類目前沒有商品。</p>';
  }
  if(shopCats){
   shopCats.innerHTML=cats.map(c=>`<button type="button" data-cat="${escapeHtml(c)}" class="${c===active?'active':''}">${escapeHtml(c)}</button>`).join('');
   shopCats.hidden=cats.length<=1;
   shopCats.closest('.shop-layout')?.classList.toggle('no-cats',shopCats.hidden);
   shopCats.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    active=btn.dataset.cat;
    shopCats.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));
    renderGrid();
   }));
  }
  renderGrid();
  miniCartBar();
 }).catch(()=>{
  shopCats?.closest('.shop-layout')?.classList.add('no-cats');
  const status=document.getElementById('shop-status');
  if(status)status.innerHTML='<p class="shop-placeholder-note">目前網站建置測試中，商品陸續上架中，敬請期待。</p>';
  shopGrid.innerHTML=TEST_PRODUCTS.map(p=>`<a class="project placeholder-card" href="product.html?slug=${encodeURIComponent(p.slug)}"><div class="image"><img src="${p.image_url}" alt="測試商品" loading="lazy" decoding="async"><span class="test-tag">測試商品</span></div><div class="project-meta"><div><h3>${escapeHtml(p.name)}</h3><small>${money(p.variants[0].price)}</small></div><span aria-hidden="true">↗</span></div></a>`).join('');
 });
}

function renderProductDetail(productBox,p,isTest){
 document.title=`${p.name}｜美淑琳設計顧問有限公司`;
 const crumb=document.getElementById('product-crumb');if(crumb)crumb.textContent=p.name;
 const variantOptions=p.variants.map(v=>`<option value="${v.id}" data-price="${v.price}" data-label="${escapeHtml(v.option_label||'標準款')}" ${v.stock_qty<1?'disabled':''}>${escapeHtml(v.option_label||'標準款')}・${money(v.price)}${v.stock_qty<1?'（缺貨）':''}</option>`).join('');
 const allSoldOut=p.variants.every(v=>v.stock_qty<1);
 productBox.innerHTML=`<div class="shop-detail-media">${p.image_url?`<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}">`:''}${isTest?'<span class="test-tag">測試商品</span>':''}</div><div><p class="eyebrow">${p.category?escapeHtml(p.category):'CTDC SHOP'}</p><h1>${escapeHtml(p.name)}</h1><p class="body-copy">${escapeHtml(p.description).replace(/\n/g,'<br>')}</p>${isTest?'<p class="shop-placeholder-note">這是測試商品，加入購物車可以體驗流程，但結帳送出目前還無法完成（後端尚未部署）。</p>':''}</div>`;
 const bar=document.createElement('div');
 bar.className='product-actionbar';
 bar.innerHTML=`<form id="add-to-cart-form" class="pa-row"><select name="variantId" required>${variantOptions}</select><span class="pa-qty"><button type="button" data-step="-1" aria-label="減少數量">−</button><input type="number" name="qty" value="1" min="1" max="99" required><button type="button" data-step="1" aria-label="增加數量">＋</button></span><span class="pa-total">小計<strong id="pa-total-amount">NT$0</strong></span><button type="submit"${allSoldOut?' disabled':''}>${allSoldOut?'已售完':'加入購物車'}</button></form><p class="form-status" id="add-to-cart-status" role="status"></p>`;
 document.body.appendChild(bar);
 const form=bar.querySelector('#add-to-cart-form');
 const select=form.querySelector('[name=variantId]'),qtyInput=form.querySelector('[name=qty]'),totalEl=bar.querySelector('#pa-total-amount');
 function updateTotal(){
  const opt=select.selectedOptions[0];
  const qty=Math.max(1,Math.min(99,parseInt(qtyInput.value,10)||1));
  totalEl.textContent=opt?money(parseFloat(opt.dataset.price)*qty):'NT$0';
 }
 select.addEventListener('change',updateTotal);
 qtyInput.addEventListener('input',updateTotal);
 form.querySelectorAll('[data-step]').forEach(btn=>btn.addEventListener('click',()=>{
  qtyInput.value=Math.max(1,Math.min(99,(parseInt(qtyInput.value,10)||1)+parseInt(btn.dataset.step,10)));
  updateTotal();
 }));
 updateTotal();
 form.addEventListener('submit',e=>{
  e.preventDefault();
  const opt=select.selectedOptions[0];
  if(!opt||opt.disabled)return;
  const qty=Math.max(1,Math.min(99,parseInt(qtyInput.value,10)||1));
  cartAdd({variantId:parseInt(select.value,10),qty,productName:p.name,optionLabel:opt.dataset.label,price:parseFloat(opt.dataset.price),image:p.image_url});
  const status=document.getElementById('add-to-cart-status');
  status.textContent='已加入購物車';status.className='form-status ok';
  miniCartBar();
  setTimeout(()=>{status.textContent='';status.className='form-status'},2500);
 });
}

const productBox=document.getElementById('product-detail');
if(productBox){
 const slug=new URLSearchParams(location.search).get('slug');
 const testProduct=TEST_PRODUCTS.find(p=>p.slug===slug);
 if(!slug){productBox.innerHTML='<p class="empty">找不到商品。</p>'}
 else if(testProduct){renderProductDetail(productBox,testProduct,true)}
 else shopFetch(`${SHOP_API}/api/products/${encodeURIComponent(slug)}`).then(async r=>{
  if(!r.ok){productBox.innerHTML='<p class="empty">找不到這項商品，或已下架。</p>';return}
  const p=await r.json();
  renderProductDetail(productBox,p,false);
 }).catch(()=>{productBox.innerHTML='<p class="empty">商品載入失敗，請稍後再試。</p>'});
}

const cartList=document.getElementById('cart-list');
function renderCart(){
 const items=cartGet();
 const summary=document.getElementById('cart-summary'),checkoutLink=document.getElementById('checkout-link');
 if(!items.length){
  cartList.innerHTML='<p class="empty">購物車是空的。<br><a class="text-link" href="shop.html" style="margin-top:16px">去看看商品</a></p>';
  if(summary)summary.hidden=true;if(checkoutLink)checkoutLink.hidden=true;
  return;
 }
 cartList.innerHTML=items.map(i=>`<div class="cart-row" data-id="${i.variantId}"><div class="cart-row-media">${i.image?`<img src="${escapeHtml(i.image)}" alt="${escapeHtml(i.productName)}">`:''}</div><div class="cart-row-info"><h3>${escapeHtml(i.productName)}</h3><p>${escapeHtml(i.optionLabel||'')}</p><p>${money(i.price)}</p></div><input type="number" class="cart-qty" min="1" max="99" value="${i.qty}" aria-label="數量"><button type="button" class="cart-remove">移除</button></div>`).join('');
 cartList.querySelectorAll('.cart-qty').forEach(input=>input.addEventListener('change',()=>{cartUpdateQty(parseInt(input.closest('.cart-row').dataset.id,10),parseInt(input.value,10)||1);renderCart()}));
 cartList.querySelectorAll('.cart-remove').forEach(btn=>btn.addEventListener('click',()=>{cartRemove(parseInt(btn.closest('.cart-row').dataset.id,10));renderCart()}));
 const total=items.reduce((n,i)=>n+i.price*i.qty,0);
 if(summary){summary.hidden=false;document.getElementById('cart-total-amount').textContent=money(total)}
 if(checkoutLink)checkoutLink.hidden=false;
}
if(cartList)renderCart();

const checkoutSummary=document.getElementById('checkout-summary');
if(checkoutSummary){
 const items=cartGet();
 if(!items.length){
  checkoutSummary.innerHTML='<p class="empty">購物車是空的。<br><a class="text-link" href="shop.html" style="margin-top:16px">去看看商品</a></p>';
 }else{
  const total=items.reduce((n,i)=>n+i.price*i.qty,0);
  checkoutSummary.innerHTML=`<div class="cart-summary-list">${items.map(i=>`<div class="cart-summary-row"><span>${escapeHtml(i.productName)}${i.optionLabel?`（${escapeHtml(i.optionLabel)}）`:''} x${i.qty}</span><span>${money(i.price*i.qty)}</span></div>`).join('')}</div><div class="cart-total"><span>總金額</span><strong>${money(total)}</strong></div>`;
  const form=document.getElementById('checkout-form');
  form.hidden=false;
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   const fd=new FormData(form);
   const customer={name:fd.get('name'),phone:fd.get('phone'),email:fd.get('email'),address:fd.get('address'),note:fd.get('note')};
   const btn=form.querySelector('button[type=submit]'),status=document.getElementById('checkout-status');
   btn.disabled=true;status.textContent='處理中…';status.className='form-status';
   try{
    const res=await shopFetch(`${SHOP_API}/api/orders`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cartGet().map(i=>({variantId:i.variantId,qty:i.qty})),customer})},15000);
    const data=await res.json();
    if(!res.ok||data.error){
     status.textContent=data.error==='out_of_stock'?`⚠ 「${data.detail||''}」庫存不足，請調整購物車後再試一次。`:'⚠ 送出失敗，請確認欄位填寫正確後再試一次，或改用聯絡我們頁面與我們聯繫。';
     status.className='form-status error';btn.disabled=false;return;
    }
    localStorage.setItem('ctdc-last-order',data.orderNo);
    cartSet([]);
    const payForm=document.createElement('form');
    payForm.method='POST';payForm.action=data.actionUrl;payForm.style.display='none';
    for(const[k,v] of Object.entries(data.fields)){const input=document.createElement('input');input.type='hidden';input.name=k;input.value=v;payForm.appendChild(input)}
    document.body.appendChild(payForm);payForm.submit();
   }catch(err){status.textContent='⚠ 送出失敗，請稍後再試。';status.className='form-status error';btn.disabled=false}
  });
 }
}

const orderStatusBox=document.getElementById('order-status-box');
if(orderStatusBox){
 const orderNo=new URLSearchParams(location.search).get('order')||localStorage.getItem('ctdc-last-order');
 const STATUS_LABEL={pending_payment:'等待付款',paid:'已付款，準備出貨',processing:'備貨中',shipped:'已出貨',completed:'已完成',cancelled:'已取消',payment_failed:'付款失敗'};
 if(!orderNo){orderStatusBox.innerHTML='<p class="empty">找不到訂單編號。</p>'}
 else shopFetch(`${SHOP_API}/api/orders/${encodeURIComponent(orderNo)}`).then(async r=>{
  if(!r.ok){orderStatusBox.innerHTML='<p class="empty">查無此訂單。</p>';return}
  const o=await r.json();
  orderStatusBox.innerHTML=`<p class="eyebrow">訂單編號 ${escapeHtml(o.order_no)}</p><h2>${STATUS_LABEL[o.status]||escapeHtml(o.status)}</h2><div class="cart-summary-list">${o.items.map(i=>`<div class="cart-summary-row"><span>${escapeHtml(i.product_name)}${i.option_label?`（${escapeHtml(i.option_label)}）`:''} x${i.qty}</span><span>${money(i.unit_price*i.qty)}</span></div>`).join('')}</div><div class="cart-total"><span>總金額</span><strong>${money(o.subtotal)}</strong></div><p class="body-copy" style="margin-top:20px">若付款完成後狀態仍顯示「等待付款」，請稍候片刻重新整理，或透過<a class="text-link" href="contact.html" style="margin-left:6px">聯絡我們</a>與我們確認。</p>`;
 }).catch(()=>{orderStatusBox.innerHTML='<p class="empty">查詢失敗，請稍後再試。</p>'});
}

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

const gate=document.querySelector('.entry-gate');
if(gate){
 const obs=new IntersectionObserver(([entry])=>{document.body.classList.toggle('past-gate',!entry.isIntersecting)},{threshold:0});
 obs.observe(gate);
}

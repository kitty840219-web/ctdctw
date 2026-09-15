# -*- coding: utf-8 -*-
from pathlib import Path
import json,hashlib,shutil,html
from PIL import Image
import opencc
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent/'CTDC官網素材'
if not SOURCE.exists():SOURCE=ROOT/'archive'
DATA=json.loads((ROOT/'content/cases.json').read_text())
DIST=ROOT/'dist';ASSETS=DIST/'assets';ASSETS.mkdir(exist_ok=True)
_s2tw=opencc.OpenCC('s2tw')
def trad(s):
 return html.escape(_s2tw.convert(s))
_logo_bytes=(ROOT/'content/brand/ctdc-mark.png').read_bytes()
BRAND_LOGO='brand-ctdc-'+hashlib.sha256(_logo_bytes).hexdigest()[:10]+'.png'
for old in ASSETS.glob('brand-ctdc*.png'):
 if old.name!=BRAND_LOGO:old.unlink()
(ASSETS/BRAND_LOGO).write_bytes(_logo_bytes)
_gate_logo_bytes=(ROOT/'content/brand/gate-logo.png').read_bytes()
GATE_LOGO='gate-logo-'+hashlib.sha256(_gate_logo_bytes).hexdigest()[:10]+'.png'
for old in ASSETS.glob('gate-logo-*.png'):
 if old.name!=GATE_LOGO:old.unlink()
(ASSETS/GATE_LOGO).write_bytes(_gate_logo_bytes)
FEATURE_DIR=ROOT/'content/brand/feature'
def feature_photo(name):
 for old in ASSETS.glob(f'feature-{name}-*.webp'):old.unlink()
 with Image.open(FEATURE_DIR/f'{name}.jpg') as im:
  h=hashlib.sha256((FEATURE_DIR/f'{name}.jpg').read_bytes()).hexdigest()[:10]
  out=f'feature-{name}-{h}.webp'
  im=im.convert('RGB');im.thumbnail((1900,1900));im.save(ASSETS/out,'WEBP',quality=85)
 return out
FEATURE_IMGS={n:feature_photo(n) for n in ('hero','interior','design','craft','plan')}
def optimize(url):
 ext=Path(url.split('?')[0]).suffix;name=hashlib.sha256(url.encode()).hexdigest()[:12];src=SOURCE/'圖片'/(name+ext)
 if not src.exists():return None
 target=ASSETS/(name+'.webp')
 try:
  with Image.open(src) as im:
   if im.width<300 or im.height<200:return None
   if not target.exists():
    im=im.convert('RGB');im.thumbnail((1900,1900));im.save(target,'WEBP',quality=85)
  return name+'.webp'
 except:return None
cases=[]
for item in DATA:
 if item.get('error'):continue
 imgs=list(dict.fromkeys(filter(None,(optimize(u) for u in item['images']))))
 if imgs:cases.append(dict(item,photos=imgs,title=trad(item['title'])))
cases.sort(key=lambda x:({'Residence':0,'Commercial':1,'Office':2,'Private':3}[x['category']],-int(x['id'])))
cats={'Residence':'住宅空間','Commercial':'商業空間','Office':'辦公空間','Private':'私人會所'}
navs=[('index.html','首頁'),('about.html','關於我們'),('services.html','服務項目'),('works.html','案例分享'),('contact.html','聯絡我們')]
def page(name,title,body,prefix='',chrome=True):
 nav=''.join(f'<a href="{prefix}{url}"'+(' aria-current="page"' if url==name else '')+f'>{label}</a>' for url,label in navs)
 chrome_html=f'''<a class="skip" href="#main">跳至主要內容</a><header><a class="brand" href="{prefix}welcome.html" aria-label="CTDC 臺灣"><div><img class="logo-mark" src="{prefix}assets/{BRAND_LOGO}" alt="CTDC"></div><div class="brand-name">美淑琳<br>設計顧問有限公司</div></a><button class="menu" aria-controls="nav" aria-expanded="false">選單 ☰</button><nav id="nav" aria-label="主要導覽">{nav}</nav></header><main id="main">{body}</main><footer><div class="footer-top"><div><a class="brand" href="{prefix}welcome.html"><div><img class="logo-mark" src="{prefix}assets/{BRAND_LOGO}" alt="CTDC"></div></a><p class="footer-info" style="margin-top:22px">美淑琳設計顧問有限公司<br>統一編號 60677831</p></div><div class="footer-nav">{nav}</div></div><div class="footer-bottom"><span>© 2026 CTDC Taiwan. All rights reserved.</span><span>空間有形，生活無限。</span></div></footer><a class="backtop" href="#top" aria-label="回到頁首">↑</a>''' if chrome else f'<main id="main">{body}</main>'
 txt=f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}｜美淑琳設計顧問有限公司</title><meta name="description" content="美淑琳設計顧問有限公司，CTDC 臺灣。整合設計、工程與專案管理，讓空間的每一個細節，回應生活。"><meta name="theme-color" content="#f4f3ef"><link rel="stylesheet" href="{prefix}style.css"><link rel="icon" href="{prefix}favicon.svg" type="image/svg+xml"><script src="{prefix}site.js" defer></script></head><body id="top">{chrome_html}</body></html>'''
 (DIST/name).parent.mkdir(parents=True,exist_ok=True);(DIST/name).write_text(txt,encoding='utf-8')
def photo(file,alt,cls='',eager=False,prefix=''):
 return f'<img class="{cls}" src="{prefix}assets/{file}" alt="{alt}" loading="'+('eager' if eager else 'lazy')+'" decoding="async">'
def heading(title,en):return f'<div class="wrap breadcrumb"><a href="index.html">首頁</a> / {title}</div><div class="page-head"><h1>{title}</h1><p class="eyebrow">{en}</p></div>'
def cards(items):
 return ''.join(f'<a class="project" data-category="{c["category"]}" href="projects/{c["id"]}.html"><div class="image">{photo(c["photos"][0],c["title"]+"案例照片")}</div><div class="project-meta"><div><small>{cats[c["category"]]}</small><h3>{c["title"]}</h3></div><span aria-hidden="true">↗</span></div></a>' for c in items)
services=[('專案管理','串聯設計、技術與施工團隊，整合進度、預算、品質及現場協調，讓每個環節都有清楚的安排。'),('工程施工','從住宅、商業到辦公場域，重視施工細節、材料品質與現場執行，將圖面轉化為真實空間。'),('深化設計','回應空間規劃與品牌形象，整理設計細節、施工圖面與材料運用，讓想像具備落地的條件。'),('軟裝執行','透過家具、織品與飾品的搭配，延續空間的設計語彙，讓使用感受與視覺層次相互呼應。'),('家具訂製','依照空間需求，整合訂製家具、地毯及金屬展示道具，讓尺寸、材質與細節形成一致的風格。')]
def rows():return '<div class="service-list">'+''.join(f'<article class="service-row"><span class="num">0{i+1}</span><h3>{t}</h3><p>{d}</p></article>' for i,(t,d) in enumerate(services))+'</div>'
guarantees=[('材料設備保證','依工程進度安排材料與設備採購，掌握多元供應管道並嚴格把關進場品質；機具進場前完成性能檢查與維護，即時排除故障與安全隱患。'),('技術保證','施工人員熟悉圖面並訂定合適工法，各專業工班依規程與圖面要求施作；遇突發狀況即時調整應變，並與設計、施工單位保持密切溝通。'),('人員保證','依計畫合理調度人力並安排施工，定期召開協調會議因應現場需求；農忙、節慶等特殊期間，仍確保工程正常進行。')]
phases=[('施工準備階段','指定專案經理並成立專案小組，依規模與特性擬定管理規劃、規章制度及施工組織設計，完成現場準備並提出開工申請。'),('施工階段','依施工組織設計執行並動態管理進度、品質、成本與安全，落實合約、現場與資訊管理，完整記錄施工過程。'),('竣工驗收階段','工程全數完成並試運轉合格、預驗結果符合驗收標準後，組織正式竣工驗收，辦理結算與工程移交手續。'),('品質保固與售後服務','定期回訪聽取使用意見，提供維護、維修與技術諮詢，並提供一年整體保修、永久防漏保修與 48 小時到府服務。')]
def feature_section():
 imgs=FEATURE_IMGS
 photo_row=lambda a,b,alt_a,alt_b:f'<div class="wrap photo-pair">{photo(imgs[a],alt_a)}{photo(imgs[b],alt_b)}</div>'
 return f'''<section class="section wash"><div class="wrap"><p class="eyebrow">PROJECT MANAGEMENT</p><h2>有方法地，管理每一個專案。</h2><div class="about-layout" style="align-items:start"><div>{photo(imgs['hero'],'CTDC 專案管理示意')}</div><div><p class="body-copy">透過進度、品質、安全與成本等面向的控制與管理，達成預期的工期、品質、安全與成本目標。</p><p class="body-copy">管理範疇涵蓋專案規劃、合約管理、資訊管理與現場管理等制度性工作，並針對人力、技術、資金、材料與設備等生產要素進行合理調度與動態控制，讓每個專案都有清楚可依循的管理方法。</p></div></div></div></section><section class="section wrap">{photo_row('interior','plan','CTDC 接待空間實景','CTDC 平面圖討論')}</section><section class="section wash"><div class="wrap"><p class="eyebrow">THREE GUARANTEES</p><h2>三大保證措施</h2><div class="principles">'''+''.join(f'<article><h3>{t}</h3><p>{d}</p></article>' for t,d in guarantees)+f'''</div></div></section><section class="section wrap">{photo_row('design','craft','CTDC 設計發想過程','CTDC 施工細節')}</section><section class="section wash"><div class="wrap"><p class="eyebrow">PROJECT PHASES</p><h2>有條理地，完成每個階段。</h2><div class="process">'''+''.join(f'<article><span class="num">0{i+1}</span><h3>{t}</h3><p>{d}</p></article>' for i,(t,d) in enumerate(phases))+'</div></div></section>'
def band():return '<section class="contact-band"><div class="wrap"><div><p class="eyebrow">LET’S CREATE TOGETHER</p><h2>從一個想法，<br>開始一段空間的旅程。</h2></div><a class="text-link" href="contact.html">聯絡我們</a></div></section>'
def recommend_track(items,prefix=''):
 track_items=items+items
 cards_html=''.join(f'<a class="recommend-card" href="{prefix}projects/{c["id"]}.html"><div class="image">{photo(c["photos"][0],c["title"]+"案例照片",prefix=prefix)}</div><h3>{c["title"]}</h3></a>' for c in track_items)
 return f'<section class="section wash recommend"><div class="wrap"><p class="recommend-title"><span></span>推薦作品</p></div><div class="recommend-track-wrap"><div class="recommend-track">{cards_html}</div></div></section>'
def related_cases(current,pool,limit=6):
 same=[x for x in pool if x['category']==current['category'] and x['id']!=current['id']]
 rest=[x for x in pool if x['category']!=current['category'] and x['id']!=current['id']]
 return (same+rest)[:limit]
hero=next((c for c in cases if c['id']=='163'),cases[0]);secondary=next((c for c in cases if c['id']=='162'),cases[0]);featured=[c for c in cases if c['id'] in ['163','162','164']]
SOCIAL_LINKS={'facebook':'#','line':'#','instagram':'#'}
SOCIAL_ICONS={
 'facebook':'<svg viewBox="0 0 24 24" fill="none"><path d="M15 8.5h2V5.5h-2c-2.2 0-4 1.8-4 4V12H9v3h2v6h3v-6h2.2l.8-3H14V9.5c0-.6.4-1 1-1Z" fill="currentColor"/></svg>',
 'line':'<svg viewBox="0 0 24 24" fill="none"><path d="M12 4C6.9 4 3 7.3 3 11.2c0 3.4 3 6.3 7.1 6.9-.3 1-.5 1.9-.5 2.2 0 .3.2.4.4.3.2 0 2.4-1.6 3.7-2.6 5.7-.4 9.3-3.6 9.3-6.8C23 7.3 17.1 4 12 4Z" fill="currentColor"/></svg>',
 'instagram':'<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>',
}
def social_row(cls='gate-social'):
 return f'<div class="{cls}">'+''.join(f'<a href="{url}" target="_blank" rel="noopener" aria-label="{name}">{SOCIAL_ICONS[name]}</a>' for name,url in SOCIAL_LINKS.items())+'</div>'
def gate_section():
 gate_ids=['164','163','162','161']
 gate_photos=[next(c for c in cases if c['id']==gid)['photos'][0] for gid in gate_ids]
 slides=''.join(f'<img class="gate-slide" src="assets/{p}" alt="CTDC 空間作品" loading="eager" decoding="async">' for p in gate_photos)
 return f'''<section class="entry-gate"><div class="gate-slides">{slides}</div><div class="gate-overlay"></div><div class="gate-content"><img class="gate-logo" src="assets/{GATE_LOGO}" alt="美淑琳設計顧問有限公司"><h1>讓空間，回應生活。</h1><a class="gate-cta" href="works.html">了解更多</a>{social_row()}</div></section>'''
page('welcome.html','歡迎',gate_section(),chrome=False)
page('index.html','首頁',f'''<section class="hero"><div class="hero-copy reveal"><p class="eyebrow">CTDC DESIGN / TAIWAN</p><h1>讓空間，<br>回應生活。</h1><p>關於裝修，<br>我們比您更在意細節。</p><a class="text-link" href="works.html">探索精選案例</a></div><div class="hero-photo">{photo(hero['photos'][0],hero['title'],eager=True)}<span>{hero['title']} / CTDC PROJECT</span></div></section><section class="section wrap intro"><div class="intro-visual">{photo(secondary['photos'][0],secondary['title'])}</div><div><p class="eyebrow">ABOUT CTDC</p><h2>設計的感性，<br>工程的理性。</h2><p class="body-copy">在想像與實踐之間，我們用細節連結兩者。<br>美淑琳設計顧問有限公司，承接 CTDC 對空間品質的重視，在臺灣展開設計與工程的對話。</p><p class="body-copy">從一張圖面、一種材質，到生活中的每次觸碰，讓空間的美感與使用感受，一起被好好完成。</p><a class="text-link" href="about.html">關於我們</a></div></section><section class="section wash"><div class="wrap"><div class="section-head"><div><p class="eyebrow">SELECTED WORKS</p><h2>空間裡的故事</h2></div><a class="text-link" href="works.html">所有案例</a></div><div class="project-grid">{cards(featured)}</div></div></section><section class="section wrap"><div class="section-head"><div><p class="eyebrow">OUR SERVICES</p><h2>從構想到實現</h2></div></div>{rows()}</section>{band()}''')
page('about.html','關於我們',heading('關於我們','ABOUT CTDC')+f'''<section class="wrap about-layout"><div>{photo(secondary['photos'][0],'CTDC 空間作品','organic',True)}</div><div><p class="eyebrow">DESIGN MEETS CRAFT</p><h2 class="quote">「設計是感性的，<br>工程施作是理性的。」</h2><p class="body-copy">而我們的工作，是細膩地連結這兩種思維。</p><p class="body-copy">CTDC 由蕭世雄於 2015 年創立於上海，核心團隊結合設計、工程、專案管理與品牌行銷，服務涵蓋商業空間、辦公空間、私人會所及住宅。</p><p class="body-copy">美淑琳設計顧問有限公司於 2025 年在臺灣成立，延續品牌對品質與細節的堅持，將累積的經驗帶入在地的空間實踐。</p></div></section><section class="section wash"><div class="wrap"><p class="eyebrow">WHAT WE BELIEVE</p><h2>好的空間，始於細節。</h2><div class="principles"><article><h3>誠信</h3><p>以清楚的溝通建立信任，理解每一個需求，認真對待每一次託付。</p></article><article><h3>品質</h3><p>從材料、工法到現場執行，將細緻的要求落實在每一個環節。</p></article><article><h3>創新</h3><p>讓經驗與新的想法相遇，尋找設計者、建造者與使用者之間的共鳴。</p></article></div></div></section>{band()}''')
page('services.html','服務項目',heading('服務項目','OUR SERVICES')+f'<section class="wrap" style="padding-bottom:90px"><h2>完整思考，細緻執行。</h2><p class="body-copy">整合設計、施工與專案管理，陪伴空間從構想到完成。</p>{rows()}</section>'+feature_section()+band())
page('works.html','案例分享',heading('案例分享','SELECTED WORKS')+'<section class="wrap" style="padding-bottom:100px"><div class="filters" aria-label="案例分類"><button class="active" data-filter="all" aria-pressed="true">全部作品</button>'+''.join(f'<button data-filter="{k}" aria-pressed="false">{v}</button>' for k,v in cats.items())+'</div><div class="project-grid">'+cards(cases)+'</div></section>')
contact_times=['平日 09:00-12:00','平日 12:00-18:00','假日 09:00-12:00','假日 12:00-18:00']
contact_needs=['專案管理','工程施工','深化設計','軟裝執行','家具訂製']
contact_spaces=['住宅','商業空間','辦公空間','私人會所']
contact_sizes=['15坪以下','15-20坪','20-30坪','30-40坪','40坪以上']
def check_group(legend,name,values,kind='checkbox'):
 return '<fieldset class="form-check-group"><legend>'+legend+'</legend>'+''.join(f'<label><input type="{kind}" name="{name}" value="{v}"> {v}</label>' for v in values)+'</fieldset>'
contact_form=f'''<section class="section wash"><div class="wrap" style="max-width:820px"><p class="eyebrow">GET IN TOUCH</p><h2>想重新定義空間的樣子嗎？</h2><p class="body-copy">告訴我們您的想法，我們會盡快與您聯繫。</p><form id="contact-form" class="contact-form"><input type="text" name="website" class="hp-field" tabindex="-1" autocomplete="off"><div class="form-grid"><label class="form-field"><span>姓名 *</span><input type="text" name="name" required></label><label class="form-field"><span>聯絡電話 *</span><input type="tel" name="phone" required></label><label class="form-field"><span>電子信箱 *</span><input type="email" name="email" required></label><label class="form-field"><span>LINE ID</span><input type="text" name="lineId"></label></div>{check_group('方便聯絡時間（可複選）','contactTime',contact_times)}{check_group('需求類型（可複選）','needs',contact_needs)}{check_group('空間類型','spaceType',contact_spaces,'radio')}{check_group('格局是否需要改動','layoutChange',['是','否'],'radio')}<div class="form-grid"><label class="form-field"><span>空間地址</span><input type="text" name="address"></label><label class="form-field"><span>您的預算</span><input type="text" name="budget"></label></div>{check_group('空間概略坪數','size',contact_sizes,'radio')}<div class="form-grid"><label class="form-field"><span>期望設計風格</span><input type="text" name="style"></label></div><label class="form-field" style="margin-bottom:26px"><span>期望空間需求</span><textarea name="message" rows="4"></textarea></label><label class="form-field" style="max-width:260px;margin-bottom:26px"><span id="captcha-q">驗證碼</span><input type="text" name="captchaAnswer" required></label><input type="hidden" name="captchaExpected"><div class="form-actions"><button type="submit">送出訊息</button><p class="form-status" id="form-status" role="status"></p></div></form></div></section>'''
page('contact.html','聯絡我們',heading('聯絡我們','CONTACT')+f'''<section class="wrap contact-layout"><div><p class="eyebrow">CTDC TAIWAN</p><h2>期待，<br>下一個空間故事。</h2><p class="body-copy">美淑琳設計顧問有限公司</p><dl><dt>統一編號</dt><dd>60677831</dd><dt>聯絡地址</dt><dd>台北市中山區建國北路二段186巷3號1樓</dd><dt>聯絡人</dt><dd>蕭先生</dd><dt>電子郵件</dt><dd><a class="text-link" href="mailto:ctdc@ctdcdesign.com" style="gap:10px">ctdc@ctdcdesign.com</a></dd><dt>對外電話</dt><dd><a class="text-link" href="tel:0225007668" style="gap:10px">(02) 2500-7668</a></dd><dt>CTDC 品牌網站</dt><dd><a class="text-link" href="https://www.ctdcdesign.com/cn/" target="_blank" rel="noopener">前往品牌官網</a></dd></dl></div>{photo(hero['photos'][-1],'CTDC 室內空間細節')}</section>'''+contact_form)
for c in cases:
 info_side=''.join(f'<div><p class="eyebrow">{trad(c["info"][i])}</p><p>{trad(c["info"][i+1])}</p></div>' for i in range(0,len(c['info'])-1,2))
 thumbs=''.join(f'<img class="gallery-thumb{" active" if i==0 else ""}" src="../assets/{p}" data-full="../assets/{p}" alt="{c["title"]}・縮圖 {i+1}" loading="lazy" decoding="async">' for i,p in enumerate(c['photos']))
 viewer=f'''<div class="gallery-viewer"><div class="gallery-main-frame"><img class="gallery-main" src="../assets/{c['photos'][0]}" alt="{c['title']}・空間照片" loading="eager" decoding="async"></div><div class="gallery-thumbs-row"><button type="button" class="thumb-nav prev" aria-label="上一批縮圖">‹</button><div class="gallery-thumbs">{thumbs}</div><button type="button" class="thumb-nav next" aria-label="下一批縮圖">›</button></div></div>'''
 body=f'''<div class="wrap"><div class="breadcrumb"><a href="../works.html">案例分享</a> / {cats[c["category"]]}</div><div class="detail-title"><p class="eyebrow">CTDC PROJECT / {cats[c["category"]]}</p><h1>{c["title"]}</h1></div><div class="detail-hero">{viewer}<div class="detail-info-side">{info_side}</div></div><a class="text-link" style="margin:25px 0 60px" href="../works.html">返回案例分享</a></div>'''+recommend_track(related_cases(c,cases),prefix='../')
 page('projects/'+c['id']+'.html',c['title'],body,'../')
(DIST/'favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f4f3ef"/><text x="32" y="46" text-anchor="middle" font-family="Georgia,serif" font-size="45" fill="#292a27">C</text></svg>')
(ROOT/'content/published-cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2))
print(f'Built {len(cases)+5} pages with {len(list(ASSETS.glob("*.webp")))} local images')

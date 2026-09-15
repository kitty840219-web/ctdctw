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
BRAND_LOGO='brand-ctdc.png'
shutil.copy(ROOT/'content/brand/ctdc-mark.png',ASSETS/BRAND_LOGO)
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
def page(name,title,body,prefix=''):
 nav=''.join(f'<a href="{prefix}{url}"'+(' aria-current="page"' if url==name else '')+f'>{label}</a>' for url,label in navs[1:])
 txt=f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}｜CTDC 臺灣・美淑琳設計顧問</title><meta name="description" content="美淑琳設計顧問有限公司，CTDC 臺灣。整合設計、工程與專案管理，讓空間的每一個細節，回應生活。"><meta name="theme-color" content="#f4f3ef"><link rel="stylesheet" href="{prefix}style.css"><link rel="icon" href="{prefix}favicon.svg" type="image/svg+xml"><script src="{prefix}site.js" defer></script></head><body id="top"><a class="skip" href="#main">跳至主要內容</a><header><a class="brand" href="{prefix}index.html" aria-label="CTDC 臺灣首頁"><div><img class="logo-mark" src="{prefix}assets/{BRAND_LOGO}" alt="CTDC"><small>DESIGN · TAIWAN</small></div><div class="brand-name">美淑琳<br>設計顧問有限公司</div></a><button class="menu" aria-controls="nav" aria-expanded="false">選單 ☰</button><nav id="nav" aria-label="主要導覽">{nav}</nav></header><main id="main">{body}</main><footer><div class="footer-top"><div><a class="brand" href="{prefix}index.html"><div><img class="logo-mark" src="{prefix}assets/{BRAND_LOGO}" alt="CTDC"><small>DESIGN · TAIWAN</small></div></a><p class="footer-info" style="margin-top:22px">美淑琳設計顧問有限公司<br>統一編號 60677831</p></div><div class="footer-nav">{nav}</div></div><div class="footer-bottom"><span>© 2026 CTDC Taiwan. All rights reserved.</span><span>空間有形，生活無限。</span></div></footer><a class="backtop" href="#top" aria-label="回到頁首">↑</a></body></html>'''
 (DIST/name).parent.mkdir(parents=True,exist_ok=True);(DIST/name).write_text(txt,encoding='utf-8')
def photo(file,alt,cls='',eager=False,prefix=''):
 return f'<img class="{cls}" src="{prefix}assets/{file}" alt="{alt}" loading="'+('eager' if eager else 'lazy')+'" decoding="async">'
def heading(title,en):return f'<div class="wrap breadcrumb"><a href="index.html">首頁</a> / {title}</div><div class="page-head"><h1>{title}</h1><p class="eyebrow">{en}</p></div>'
def cards(items):
 return ''.join(f'<a class="project" data-category="{c["category"]}" href="projects/{c["id"]}.html"><div class="image">{photo(c["photos"][0],c["title"]+"案例照片")}</div><div class="project-meta"><div><small>{cats[c["category"]]}</small><h3>{c["title"]}</h3></div><span aria-hidden="true">↗</span></div></a>' for c in items)
services=[('專案管理','串聯設計、技術與施工團隊，整合進度、預算、品質及現場協調，讓每個環節都有清楚的安排。'),('工程施工','從住宅、商業到辦公場域，重視施工細節、材料品質與現場執行，將圖面轉化為真實空間。'),('深化設計','回應空間規劃與品牌形象，整理設計細節、施工圖面與材料運用，讓想像具備落地的條件。'),('軟裝執行','透過家具、織品與飾品的搭配，延續空間的設計語彙，讓使用感受與視覺層次相互呼應。'),('家具訂製','依照空間需求，整合訂製家具、地毯及金屬展示道具，讓尺寸、材質與細節形成一致的風格。')]
def rows():return '<div class="service-list">'+''.join(f'<article class="service-row"><span class="num">0{i+1}</span><h3>{t}</h3><p>{d}</p></article>' for i,(t,d) in enumerate(services))+'</div>'
def band():return '<section class="contact-band"><div class="wrap"><div><p class="eyebrow">LET’S CREATE TOGETHER</p><h2>從一個想法，<br>開始一段空間的旅程。</h2></div><a class="text-link" href="contact.html">聯絡我們</a></div></section>'
hero=next((c for c in cases if c['id']=='163'),cases[0]);secondary=next((c for c in cases if c['id']=='162'),cases[0]);featured=[c for c in cases if c['id'] in ['163','162','164']]
page('index.html','首頁',f'''<section class="hero"><div class="hero-copy reveal"><p class="eyebrow">CTDC DESIGN / TAIWAN</p><h1>讓空間，<br>回應生活。</h1><p>關於裝修，<br>我們比您更在意細節。</p><a class="text-link" href="works.html">探索精選案例</a></div><div class="hero-photo">{photo(hero['photos'][0],hero['title'],eager=True)}<span>{hero['title']} / CTDC PROJECT</span></div></section><section class="section wrap intro"><div class="intro-visual">{photo(secondary['photos'][0],secondary['title'])}</div><div><p class="eyebrow">ABOUT CTDC</p><h2>設計的感性，<br>工程的理性。</h2><p class="body-copy">在想像與實踐之間，我們用細節連結兩者。<br>美淑琳設計顧問有限公司，承接 CTDC 對空間品質的重視，在臺灣展開設計與工程的對話。</p><p class="body-copy">從一張圖面、一種材質，到生活中的每次觸碰，讓空間的美感與使用感受，一起被好好完成。</p><a class="text-link" href="about.html">關於我們</a></div></section><section class="section wash"><div class="wrap"><div class="section-head"><div><p class="eyebrow">SELECTED WORKS</p><h2>空間裡的故事</h2></div><a class="text-link" href="works.html">所有案例</a></div><div class="project-grid">{cards(featured)}</div><p class="note" style="margin-top:30px">CTDC 品牌歷年案例，作品地點與執行範圍詳見各案例。</p></div></section><section class="section wrap"><div class="section-head"><div><p class="eyebrow">OUR SERVICES</p><h2>從構想到實現</h2></div></div>{rows()}</section>{band()}''')
page('about.html','關於我們',heading('關於我們','ABOUT CTDC')+f'''<section class="wrap about-layout"><div>{photo(secondary['photos'][0],'CTDC 空間作品','organic',True)}</div><div><p class="eyebrow">DESIGN MEETS CRAFT</p><h2 class="quote">「設計是感性的，<br>工程施作是理性的。」</h2><p class="body-copy">而我們的工作，是細膩地連結這兩種思維。</p><p class="body-copy">CTDC 由蕭世雄於 2015 年創立於上海，核心團隊結合設計、工程、專案管理與品牌行銷，服務涵蓋商業空間、辦公空間、私人會所及住宅。</p><p class="body-copy">美淑琳設計顧問有限公司於 2025 年在臺灣成立，延續品牌對品質與細節的堅持，將累積的經驗帶入在地的空間實踐。</p></div></section><section class="section wash"><div class="wrap"><p class="eyebrow">WHAT WE BELIEVE</p><h2>好的空間，始於細節。</h2><div class="principles"><article><h3>誠信</h3><p>以清楚的溝通建立信任，理解每一個需求，認真對待每一次託付。</p></article><article><h3>品質</h3><p>從材料、工法到現場執行，將細緻的要求落實在每一個環節。</p></article><article><h3>創新</h3><p>讓經驗與新的想法相遇，尋找設計者、建造者與使用者之間的共鳴。</p></article></div></div></section>{band()}''')
page('services.html','服務項目',heading('服務項目','OUR SERVICES')+f'<section class="wrap" style="padding-bottom:90px"><h2>完整思考，細緻執行。</h2><p class="body-copy">整合設計、施工與專案管理，陪伴空間從構想到完成。</p>{rows()}</section><section class="section wash"><div class="wrap"><p class="eyebrow">PROJECT PROCESS</p><h2>有條理地，完成每個階段。</h2><div class="process">'+''.join(f'<article><span class="num">0{i+1}</span><h3>{t}</h3><p>{d}</p></article>' for i,(t,d) in enumerate([('需求與規劃','理解需求、場地條件及預算，討論合適的執行方向。'),('設計與準備','深化圖面、確認材料及施工計畫，安排團隊與進度。'),('施工與管理','協調現場作業，追蹤進度、品質與執行細節。'),('驗收與交付','檢視成果、整理交付資料，依專案約定安排後續服務。')]))+'</div></div></section>'+band())
page('works.html','案例分享',heading('案例分享','SELECTED WORKS')+'<section class="wrap" style="padding-bottom:100px"><div class="filters" aria-label="案例分類"><button class="active" data-filter="all" aria-pressed="true">全部作品</button>'+''.join(f'<button data-filter="{k}" aria-pressed="false">{v}</button>' for k,v in cats.items())+'</div><div class="project-grid">'+cards(cases)+'</div><p class="note" style="margin-top:45px">本頁收錄 CTDC 品牌歷年案例，並非全數由臺灣公司承作。各作品之地點與負責範圍依原官網資料標示。</p></section>')
page('contact.html','聯絡我們',heading('聯絡我們','CONTACT')+f'''<section class="wrap contact-layout"><div><p class="eyebrow">CTDC TAIWAN</p><h2>期待，<br>下一個空間故事。</h2><p class="body-copy">美淑琳設計顧問有限公司</p><dl><dt>統一編號</dt><dd>60677831</dd><dt>聯絡地址</dt><dd>台北市中山區建國北路二段186巷3號1樓</dd><dt>聯絡人</dt><dd>蕭先生</dd><dt>電子郵件</dt><dd><a class="text-link" href="mailto:ctdc@ctdcdesign.com" style="gap:10px">ctdc@ctdcdesign.com</a></dd><dt>對外電話</dt><dd>整理中，將於正式上線前更新。</dd><dt>CTDC 品牌網站</dt><dd><a class="text-link" href="https://www.ctdcdesign.com/cn/" target="_blank" rel="noopener">前往品牌官網</a></dd></dl></div>{photo(hero['photos'][-1],'CTDC 室內空間細節')}</section>''')
for c in cases:
 info=''.join(f'<div><p class="eyebrow">{trad(c["info"][i])}</p><p>{trad(c["info"][i+1])}</p></div>' for i in range(0,len(c['info'])-1,2))
 body=f'<div class="wrap"><div class="breadcrumb"><a href="../works.html">案例分享</a> / {cats[c["category"]]}</div><div class="detail-title"><p class="eyebrow">CTDC PROJECT / {cats[c["category"]]}</p><h1>{c["title"]}</h1></div><div class="gallery">'+''.join(photo(p,c['title']+f'・空間照片 {i+1}',eager=i==0,prefix='../') for i,p in enumerate(c['photos']))+f'</div><div class="detail-info">{info}</div><p class="note">CTDC 品牌歷年作品。資料與照片來源：<a href="{c["url"]}" target="_blank" rel="noopener">CTDC 原官網案例</a>。</p><a class="text-link" style="margin:25px 0 80px" href="../works.html">返回案例分享</a></div>'
 page('projects/'+c['id']+'.html',c['title'],body,'../')
(DIST/'favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f4f3ef"/><text x="32" y="46" text-anchor="middle" font-family="Georgia,serif" font-size="45" fill="#292a27">C</text></svg>')
(ROOT/'content/published-cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2))
print(f'Built {len(cases)+5} pages with {len(list(ASSETS.glob("*.webp")))} local images')

# CTDC 臺灣網站

美淑琳設計顧問有限公司的獨立網站專案。原始儲存庫： https://github.com/kitty840219-web/ctdctw

## 目錄

- `dist/`：可直接部署的網站，包含繁體中文頁面、樣式、互動及本機圖片，也含周邊商品商店（`shop.html`、`product.html`、`cart.html`、`checkout.html`、`order-status.html`）。
- `content/`：案例資料與網站實際採用的案例清單。
- `archive/`：原官網中文文字與圖片備份、來源記錄（原文維持原網站字體）。
- `build.py`：由案例資料產生 HTML，使用 Python 3、Pillow 與 opencc-python-reimplemented（簡轉繁，s2tw）；已存在的圖片不會重複轉檔。
- `shop-worker/`：周邊商品商店的後端 API（Cloudflare Worker + D1 資料庫），含商品、庫存、訂單與綠界金流串接。獨立於下面的聯絡表單 Worker 部署。詳見 `shop-worker/README.md`。
- `admin/`：商店後台管理介面，獨立的靜態網站（不是 `dist/` 的一部分），部署到自己的網址，登入後管理商品、庫存、訂單與後台帳號。詳見 `admin/README.md`。
- `cloudflare-worker/`：聯絡表單的轉信 Worker（LINE + Email），與商店 API 是兩個獨立的 Worker。
- `.github/workflows/pages.yml`：推送 main 後自動部署 GitHub Pages。
- `.openai/hosting.json`：Sites 預覽服務設定。

## 本機預覽

在專案根目錄執行 `python3 -m http.server 8765 --directory dist`，開啟 http://127.0.0.1:8765 。

## 更新

一般文案與版面在 `build.py`，樣式在 `dist/style.css`，互動在 `dist/site.js`。案例資料在 `content/cases.json`。
原始圖片優先由同層 `CTDC官網素材/圖片` 讀取；移轉後可使用專案內 `archive/圖片`（已備份 27 個案例共 284 張原始圖與 40 篇原官網文字）。安裝 Pillow 與 opencc-python-reimplemented 後執行 `python3 build.py`，檢查並提交更新後的 `dist`。

## 周邊商品商店

新增了可下單購買、含結帳與後台管理的周邊商品功能，架構上分三塊：

1. **`dist/shop.html` 等商店頁**：靜態頁面 + 前端 JS（`dist/site.js` 內），商品、庫存都是即時向 API 拉取，不是 build.py 產生的靜態內容。
2. **`shop-worker/`**：Cloudflare Worker + D1 資料庫，管商品、庫存、訂單，並串接綠界（ECPay）金流。目前程式碼已可用綠界官方公開的測試商店完整跑過一次下單流程；正式收款前需要完成綠界特約商店申請（見下方「上線前須補齊」）。
3. **`admin/`**：獨立的後台管理網站，登入後可管理商品/庫存/訂單，並依角色（`super_admin` / `manager` / `staff`）分權限。

部署步驟、密鑰設定、角色說明都寫在 `shop-worker/README.md` 與 `admin/README.md`，請照順序（先 `shop-worker`，再 `admin`）部署。

## 上線前須補齊

- 臺灣對外電話、電子郵件、LINE 或其他正式聯絡管道（地址已採用台北市中山區建國北路二段186巷3號1樓，電話、Email 已補上，見 `contact.html`）。
- 臺灣正式網域及 DNS 管理帳號。
- 確認品牌字樣、臺灣服務範圍、公司介紹與作品照片適用於臺灣網站。
- 歷年案例保留所在地與原官網負責範圍，未宣稱為臺灣公司全部承作。
- **綠界（ECPay）特約商店申請**：周邊商品的結帳目前接的是綠界官方公開的測試商店（不會真的收到錢）。要正式收款，需要先到綠界申請特約商店（需要公司登記資料、銀行帳戶，審核通常要幾天），拿到正式的 MerchantID／HashKey／HashIV 後，照 `shop-worker/README.md` 的步驟換成正式金鑰。
- **周邊商品的實際商品資料**：目前後台裡沒有任何商品，需要有人登入後台（`admin/`）建立商品、規格（尺寸/顏色）、價格與庫存。
- **出貨流程**：後台目前只能標記訂單狀態與填寫物流追蹤碼，實際包裝、寄送、退換貨規則需要公司自行安排，網站上也還沒有退換貨政策頁面。

## 部署與移交

請閱讀 `HANDOVER.md`。這是獨立專案，不依賴亦未修改 `claude-` Repository。

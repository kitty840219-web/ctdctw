# 周邊商品商店 API（Cloudflare Worker + D1）

獨立於 `cloudflare-worker/`（聯絡表單）之外的第二個 Worker，負責商品、庫存、訂單與金流。主網站的 `dist/shop.html` 等頁面，以及 `admin/` 後台，都是呼叫這個 API。

## 架構

- **資料庫**：Cloudflare D1（SQLite），結構見 `schema.sql`。
- **公開 API**（給主網站商店頁）：`GET /api/products`、`GET /api/products/:slug`、`POST /api/orders`、`GET /api/orders/:orderNo`、`POST /api/payment/notify`（綠界回呼）。
- **後台 API**（給 `admin/`）：`/admin/api/*`，需登入，依角色（`staff` / `manager` / `super_admin`）授權。
- **金流**：綠界 ECPay「全方位金流」AioCheckOut。`ecpay.js` 內含 CheckMacValue 簽章（MD5，因 Workers 的 Web Crypto 不支援 MD5，`md5.js` 是純 JS 實作，已用 Node 內建 crypto 驗證過雜湊值正確）。

## 部署步驟

### 1. 建立 D1 資料庫

```
cd shop-worker
npx wrangler d1 create ctdc-tw-shop
```

把輸出的 `database_id` 填回 `wrangler.toml` 的 `REPLACE_WITH_YOUR_D1_DATABASE_ID`。

```
npx wrangler d1 execute ctdc-tw-shop --remote --file=schema.sql
```

### 2. 設定金流密鑰

**先用綠界官方公開的測試商店測試整個流程**（不會真的扣款）：

```
npx wrangler secret put ECPAY_HASH_KEY
# 貼上 5294y06JbISpM5x9
npx wrangler secret put ECPAY_HASH_IV
# 貼上 v77hoKGq4kWxNNIS
```

`wrangler.toml` 裡的 `ECPAY_MERCHANT_ID = "2000132"` 也是綠界公開的測試商店代號，先不用改。測試信用卡卡號、ATM／超商代碼等，見綠界官方文件的「測試環境」頁面。

**正式上線前**（需要先完成綠界特約商店申請，見 `HANDOVER.md`）：

1. 把 `wrangler.toml` 的 `ECPAY_ENV` 改成 `"production"`、`ECPAY_MERCHANT_ID` 改成正式商店代號。
2. 用正式的 HashKey / HashIV 重新執行上面兩個 `wrangler secret put`（會覆蓋掉測試值）。

### 3. 設定管理員 bootstrap 密鑰、建立第一個後台帳號

```
npx wrangler secret put BOOTSTRAP_SECRET
# 自己隨便設一組高強度亂碼，僅用一次
```

```
npx wrangler deploy
```

部署後，把印出的 workers.dev 網址填回 `wrangler.toml` 的 `SHOP_API_ORIGIN`，重新 `wrangler deploy` 一次（讓綠界的 ReturnURL 打得到正確網址）。

接著用這組 bootstrap 密鑰建立第一個 `super_admin`（只能成功一次，資料庫裡沒有任何管理員時才允許）：

```
curl -X POST https://<你的 workers.dev 網址>/admin/api/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{"secret":"<BOOTSTRAP_SECRET>","email":"you@example.com","password":"至少10碼的密碼"}'
```

之後就能用這組帳密登入 `admin/` 後台，並在「帳號管理」頁新增其他人（`manager` 可管商品/庫存/訂單，`staff` 只能看訂單、標記出貨）。建議部署完後把 `BOOTSTRAP_SECRET` 這個 secret 刪掉或換掉：`npx wrangler secret delete BOOTSTRAP_SECRET`。

### 4. CORS 白名單

`worker.js` 最上面的 `SHOP_ALLOWED_ORIGINS`（主網站）與 `ADMIN_ALLOWED_ORIGINS`（後台網站）要換成實際網域，改完要重新 `wrangler deploy`。

## 綠界回呼會打到哪裡

- `ReturnURL`（伺服器對伺服器通知，必須回 `1|OK` 否則綠界會重打）指向這個 Worker 自己的 `/api/payment/notify`。
- `OrderResultURL`（付款完成後，把顧客瀏覽器導回來）指向主網站的 `order-status.html`。

## 訂單狀態機

`pending_payment`（建立訂單、已預扣庫存）→ `paid`（綠界通知成功）→ `processing` → `shipped` → `completed`；或 `payment_failed` / `cancelled`（都會把預扣的庫存還回去）。超過 30 分鐘沒收到綠界通知的訂單，由排程（`crons`，每 15 分鐘跑一次）自動取消並還庫存，避免有人建立訂單後放著不付款、卡住庫存。

## 本機測試

```
npx wrangler dev
```

會用本機模擬的 D1（記得先對本機資料庫也跑一次 schema：`npx wrangler d1 execute ctdc-tw-shop --local --file=schema.sql`）。

# 後台管理（獨立網站）

純前端 SPA（無需打包工具），呼叫 `shop-worker/` 提供的 `/admin/api/*`。跟主網站（`dist/`）是兩個獨立網站，各自有自己的網址。

## 部署（Cloudflare Pages）

先照 `shop-worker/README.md` 把 API 部署好、建立第一個 `super_admin` 帳號，再部署這裡：

```
cd admin
npx wrangler pages deploy . --project-name=ctdc-tw-admin
```

第一次執行會問要不要建立新的 Pages 專案，選是即可。之後每次改完 `admin/` 內的檔案，重新執行同一行指令就會發布新版本。

部署完成後，把印出的網址（例如 `https://ctdc-tw-admin.pages.dev`）填回 `shop-worker/worker.js` 最上面的 `ADMIN_ALLOWED_ORIGINS`，然後回到 `shop-worker/` 重新 `wrangler deploy` 一次，後台 API 才會放行這個網址的跨網域請求。

## 帳號與權限

- **super_admin（系統管理員）**：所有權限，含帳號管理。
- **manager（商品管理員）**：訂單、商品、規格、庫存。
- **staff（客服／出貨人員）**：只能看訂單、標記出貨狀態與填寫物流追蹤碼，不能改價格、庫存或取消訂單（取消會退庫存，屬於 manager 以上才能做的操作）。

在「帳號管理」頁（只有 super_admin 看得到）新增其他人的帳號。

## 安全性備註

- 這個網站本身不含任何密鑰，所有驗證都由 `shop-worker` 的後端處理（帳密雜湊、Session token）。
- 登入的 Session token 存在瀏覽器的 `localStorage`，12 小時後過期需要重新登入。
- 頁面加了 `<meta name="robots" content="noindex,nofollow">` 避免被搜尋引擎收錄，但這不是存取控制——後台網址本身沒有公開連結，但也不是機密，真正的保護來自帳號登入。

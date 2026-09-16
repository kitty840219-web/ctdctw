# 後台管理（獨立網站）

純前端 SPA（無需打包工具），呼叫 `shop-worker/` 提供的 `/admin/api/*`。跟主網站（`dist/`）是分開管理的兩個網站，但目前為了不需要另外申請網域，兩者一起發佈在同一個 GitHub Pages 上（見下方）。

## 部署（目前：跟主網站一起用 GitHub Pages）

`.github/workflows/pages.yml` 會在每次推送 `main` 時，把 `admin/` 整個資料夾原封不動複製到 `dist/admin/` 再一起發佈，所以後台網址是：

```
https://kitty840219-web.github.io/ctdctw/admin/
```

不需要另外執行部署指令，推上 `main` 就會自動更新。網址雖然是公開可連到的，但頁面本身沒有任何機密，且加了 `noindex` 避免被搜尋引擎收錄——真正的保護是登入系統（見下方安全性備註），不是網址保密。

**只有一件事需要另外做**：`shop-worker` 部署好之後，要把後台跨網域請求放行，確認 `shop-worker/worker.js` 最上面的 `ADMIN_ALLOWED_ORIGINS` 有包含 `https://kitty840219-web.github.io`（目前程式碼已經預設寫好這一行了，通常不用改）。

## 部署（之後想搬到自己的網域：Cloudflare Pages）

如果之後想讓後台脫離 GitHub Pages、換成自己的網域，可以改用 Cloudflare Pages：

```
cd admin
npx wrangler pages deploy . --project-name=ctdc-tw-admin
```

第一次執行會問要不要建立新的 Pages 專案，選是即可。部署完成後，把印出的網址（例如 `https://ctdc-tw-admin.pages.dev`）加進 `shop-worker/worker.js` 的 `ADMIN_ALLOWED_ORIGINS`，然後回到 `shop-worker/` 重新 `wrangler deploy` 一次。這一步做完後，建議把 `.github/workflows/pages.yml` 裡複製 `admin/` 的那個步驟拿掉，避免同一個後台有兩個網址同時存在造成混淆。

## 帳號與權限

- **super_admin（系統管理員）**：所有權限，含帳號管理。
- **manager（商品管理員）**：訂單、商品、規格、庫存。
- **staff（客服／出貨人員）**：只能看訂單、標記出貨狀態與填寫物流追蹤碼，不能改價格、庫存或取消訂單（取消會退庫存，屬於 manager 以上才能做的操作）。

在「帳號管理」頁（只有 super_admin 看得到）新增其他人的帳號。

## 安全性備註

- 這個網站本身不含任何密鑰，所有驗證都由 `shop-worker` 的後端處理（帳密雜湊、Session token）。
- 登入的 Session token 存在瀏覽器的 `localStorage`，12 小時後過期需要重新登入。
- 頁面加了 `<meta name="robots" content="noindex,nofollow">` 避免被搜尋引擎收錄，但這不是存取控制——後台網址本身沒有公開連結，但也不是機密，真正的保護來自帳號登入。

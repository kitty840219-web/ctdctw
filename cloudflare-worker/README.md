# 聯絡表單轉信 Worker

接收 `contact.html` 表單送出的 JSON，驗證後同時轉送到 LINE（Messaging API）與 Email（Resend）。

## 部署

```
npx wrangler deploy
```

目前已部署在：https://ctdc-tw-contact-form.kitty840219.workers.dev

## 設定 LINE（Messaging API）

LINE Notify 已於 2025-03-31 終止服務，改用官方帳號的 Messaging API 廣播訊息給所有已加好友的人。

1. 前往 https://manager.line.biz/ 登入，選擇（或建立）一個官方帳號
2. 左側選單「設定」→「Messaging API」，啟用 Messaging API（會自動建立一個對應的 Channel）
3. 前往 https://developers.line.biz/console/ 找到剛剛那個 Channel，進入「Messaging API」分頁
4. 找到「Channel access token」，按「發行」取得長期權杖
5. 讓要接收通知的人（自己或同事）用 LINE 掃官方帳號的 QR code 加好友——沒加好友的人收不到廣播訊息
6. 執行：

```
npx wrangler secret put LINE_CHANNEL_TOKEN
```

貼上權杖即可。

## 設定 Email（Resend）

1. 前往 https://resend.com 註冊（可用 Google 帳號）
2. 「API Keys」→ 建立一組新的 key
3. 執行：

```
npx wrangler secret put RESEND_API_KEY
```

收件信箱設定在 `wrangler.toml` 的 `[vars] NOTIFY_EMAIL`，要換信箱直接改這裡再 `wrangler deploy`。

以上 token／key 都只存在 Cloudflare 的 secret，不會出現在網站原始碼或 git 歷史。

## CORS

`worker.js` 裡 `ALLOWED_ORIGINS` 目前只允許 `https://kitty840219-web.github.io`。換網域後記得更新這裡並重新 `wrangler deploy`。

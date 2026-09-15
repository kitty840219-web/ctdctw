# 聯絡表單轉信 Worker

接收 `contact.html` 表單送出的 JSON，驗證後轉送到 LINE Notify。

## 部署

```
npx wrangler deploy
```

目前已部署在：https://ctdc-tw-contact-form.kitty840219.workers.dev

## 設定 LINE Notify token

1. 前往 https://notify-bot.line.me/ 用 LINE 帳號登入
2. 「發行權杖」，選擇要接收通知的聊天室（個人或群組）
3. 取得權杖後執行：

```
npx wrangler secret put LINE_NOTIFY_TOKEN
```

貼上權杖即可。token 只存在 Cloudflare 的 secret，不會出現在網站原始碼或 git 歷史。

## CORS

`worker.js` 裡 `ALLOWED_ORIGINS` 目前只允許 `https://kitty840219-web.github.io`。換網域後記得更新這裡並重新 `wrangler deploy`。

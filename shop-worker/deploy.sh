#!/usr/bin/env bash
# 一鍵引導部署 shop-worker（商品/庫存/訂單 API + 綠界金流）到 Cloudflare。
# 在有正常網路的電腦上執行（不能在被擋 Cloudflare 網路的環境跑）：
#   cd shop-worker && bash deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "== 1/6 檢查 wrangler =="
if ! command -v npx >/dev/null; then
  echo "找不到 npx，請先安裝 Node.js（https://nodejs.org）再重新執行這個腳本。"
  exit 1
fi
npx wrangler --version

echo
echo "== 2/6 登入 Cloudflare（會開瀏覽器）=="
npx wrangler login

echo
echo "== 3/6 建立 D1 資料庫 =="
echo "接下來會建立資料庫，完成後請把畫面上印出的 database_id 複製起來。"
read -p "按 Enter 繼續..." _
npx wrangler d1 create ctdc-tw-shop
echo
echo "請打開 shop-worker/wrangler.toml，把 database_id 那一行的 REPLACE_WITH_YOUR_D1_DATABASE_ID 換成剛剛印出的值。"
read -p "改好之後按 Enter 繼續..." _

echo
echo "== 4/6 套用資料庫結構 =="
npx wrangler d1 execute ctdc-tw-shop --remote --file=schema.sql

echo
echo "== 5/6 設定密鑰 =="
echo "先用綠界官方公開的測試商店試跑（不會真的扣款）："
echo "ECPAY_HASH_KEY 請貼：5294y06JbISpM5x9"
npx wrangler secret put ECPAY_HASH_KEY
echo "ECPAY_HASH_IV 請貼：v77hoKGq4kWxNNIS"
npx wrangler secret put ECPAY_HASH_IV
echo "BOOTSTRAP_SECRET：自己隨便打一串英數字亂碼（等一下要用來建立第一個後台帳號，之後可以刪除/更換）"
npx wrangler secret put BOOTSTRAP_SECRET

echo
echo "== 6/6 部署 =="
npx wrangler deploy
echo
echo "部署完成。請把上面印出的 workers.dev 網址，填回 wrangler.toml 的 SHOP_API_ORIGIN，並同步更新："
echo "  - admin/admin.js 開頭的 API 常數"
echo "  - dist/site.js 開頭的 SHOP_API 常數（改完要重新執行專案根目錄的 python3 build.py 並提交）"
echo "改完這些之後，重新執行一次「npx wrangler deploy」讓新的網址生效，這個腳本就算完成了。"
echo
echo "接著用你剛剛設定的 BOOTSTRAP_SECRET，建立第一個後台帳號（把下面網址換成你的 workers.dev 網址）："
echo '  curl -X POST https://<你的 workers.dev 網址>/admin/api/bootstrap \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"secret":"<BOOTSTRAP_SECRET>","email":"you@example.com","password":"至少10碼的密碼"}'"'"''
echo
echo "建好帳號後，就能登入 https://kitty840219-web.github.io/ctdctw/admin/ 開始上架商品了。"

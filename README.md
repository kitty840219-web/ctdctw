# CTDC 臺灣網站

美淑琳設計顧問有限公司的獨立網站專案。原始儲存庫： https://github.com/kitty840219-web/ctdctw

## 目錄

- `dist/`：可直接部署的網站，包含繁體中文頁面、樣式、互動及本機圖片。
- `content/`：案例資料與網站實際採用的案例清單。
- `archive/`：原官網中文文字與圖片備份、來源記錄（原文維持原網站字體）。
- `build.py`：由案例資料產生 HTML，使用 Python 3 與 Pillow；已存在的圖片不會重複轉檔。
- `.github/workflows/pages.yml`：推送 main 後自動部署 GitHub Pages。
- `.openai/hosting.json`：Sites 預覽服務設定。

## 本機預覽

在專案根目錄執行 `python3 -m http.server 8765 --directory dist`，開啟 http://127.0.0.1:8765 。

## 更新

一般文案與版面在 `build.py`，樣式在 `dist/style.css`，互動在 `dist/site.js`。案例資料在 `content/cases.json`。
原始圖片優先由同層 `CTDC官網素材/圖片` 讀取；移轉後可使用專案內 `archive/圖片`。安裝 Pillow 後執行 `python3 build.py`，檢查並提交更新後的 `dist`。

## 上線前須補齊

- 臺灣對外電話、電子郵件、實際接待地址、LINE 或其他正式聯絡管道。
- 臺灣正式網域及 DNS 管理帳號。
- 確認品牌字樣、臺灣服務範圍、公司介紹與作品照片適用於臺灣網站。
- 本版聯絡頁明確標示資料整理中，沒有假表單或假成功訊息。
- 歷年案例保留所在地與原官網負責範圍，未宣稱為臺灣公司全部承作。

## 部署與移交

請閱讀 `HANDOVER.md`。這是獨立專案，不依賴亦未修改 `claude-` Repository。

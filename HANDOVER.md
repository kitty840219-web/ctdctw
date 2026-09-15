# 網站維護、部署與公司移交

## 帳號與所有權

GitHub 目前儲存庫：`kitty840219-web/ctdctw`。日後優先使用 GitHub 的 Transfer ownership 功能轉移整個 Repository，保留 commit、branch、issue 與版本歷史；不要只另建資料夾複製檔案。

移交前建立備份：`git clone --mirror <目前儲存庫網址>`，並保存網站 archive、域名與部署清單。由原擁有者與接收方確認公司帳號或 Organization 名稱、權限及可接收狀態，再執行轉移。轉移後重新檢查 Actions、Pages、Secrets、Environment 及 collaborator 權限。

## GitHub 自動部署

`.github/workflows/pages.yml` 直接發佈 `dist/`，不依賴個人電腦及 Python 執行路徑。推送 main 或手動執行工作流程即可部署。
Repository Settings → Pages → Source 需設為 GitHub Actions。若帳號方案或儲存庫可見性不支援 Pages，請保留儲存庫權限，選用公司核准的平台，不應為部署而擅自公開原始碼。
本機修改後需提交生成的 dist，工作流程只部署已提交的檔案。正式網域尚未設定，沒有 CNAME。

## Sites 預覽

Sites 與 GitHub 是分開的部署服務。Sites 專案 ID 保存於 `.openai/hosting.json`；預览預設為擁有者私有。GitHub 轉移不會自動移轉 Sites 帳號、資源或存取權。公司接手時可用 `dist/` 在公司服務重新部署，再切換 DNS。Sites 的暫時推送憑證不應放入儲存庫。

## 網域與 DNS

目前尚無正式臺灣網域，亦未修改既有 ctdcdesign.com。
取得網域後記錄：註冊商、公司管理人、付款及續約帳號、DNS 提供者、現有 A/AAAA/CNAME/TXT/MX 記錄與 SSL 狀態。移轉時保留郵件 MX/TXT，先驗證新網站再調整網站記錄；驗證 HTTPS、www 與非 www 轉址，及所有頁面、圖片與聯絡連結。

## 安全與回復

本版為純靜態網站，不含資料庫、後台、表單收件服務或 API 金鑰。未來增加服務時，將機密存入部署平台的 Secrets，文件只記錄變數名稱與用途。
回復網站可在 GitHub revert 該次 commit 再部署，或在對應平台回復已驗證版本。不要刪除 Git 歷史。

## 內容來源與限制

品牌資料和圖片來自使用者指定的 CTDC 中文官網，存放於 archive。參考網站 j-m-design.com.tw 僅用於白底、留白、排版與照片呈現方向，未複製其商標、文案或作品照片。
本版使用 CTDC 文字字標，非重新設計的正式商標。臺灣聯絡資料、正式網域和品牌文案須由公司提供或確認。

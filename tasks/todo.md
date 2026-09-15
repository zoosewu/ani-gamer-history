# 雲端同步（GitHub Private Repo）與匯入/匯出

adapter 模式：共用核心處理「資料進來後怎麼合併」與「何時進出」，adapter 只負責「存到哪裡」。同步時機為「顯示列表時拉取、資料更新後推送」。

## 待辦

- [x] 0. 環境：安裝 Node 22、加入 vitest@^3.2 與 `test` script
- [x] 1. `src/history/`：types、merge（交換律／結合律／冪等）、parseSnapshot + 測試
- [x] 2. Redux 唯一資料來源：純 reducer、listener middleware 寫入 GM、跨分頁合併；修正最愛切換與重看清除最愛；移除 `globalVar`
- [x] 3. `src/sync/adapter.ts`、`syncEngine.ts`（單一執行、衝突重試）+ 測試
- [x] 4. `jsonFile` adapter + 測試
- [x] 5. `gmRequest`、`base64`、`githubRepo` adapter + 測試；`vite.config.ts` 加 `connect`
- [x] 6. `triggers.ts`（顯示時拉取、更新後推送）、`menu.ts`（Tampermonkey 選單）
- [x] 7. `SettingsDialog`（左導覽／右內容）、首頁齒輪按鈕、沒有紀錄時也顯示區塊
- [x] 8. 更新 readme；lint、test、build 全數通過；檢查 userscript 標頭

## Review

### 驗證結果
- `npm run lint`：通過（原本就有的 lint 錯誤一併修正；`vite.config.ts` 等設定檔加入 ts-standard ignore）
- `npm test`：4 個檔案、48 個測試通過
  - 合併：500 組隨機資料驗證交換律、結合律、冪等；舊資料相容；刪除後重看恢復
  - GitHub adapter：404 建檔、409／422 衝突、超過 1MB 改讀 raw、UTF-8 base64、分支與中文路徑、錯誤訊息
  - syncEngine：衝突重試不遺失資料、無差異不寫入、單一執行
- 真實 GitHub API（公開 repo、不帶 token）：base64 解碼流程與 404 處理正確（臨時測試，已刪除）
- `npm run build`：userscript 標頭含 `@connect api.github.com` 與所需的 `@grant`；React 等仍由 `@require` 載入，未被打包
- Playwright 端對端（兩個 browser context 模擬兩台電腦 + 假 GitHub Contents API）13 個情境全部通過：
  設定與測試連線、B 新電腦拉取、連續操作只推送一次、顯示時拉取、開始看動畫推送但進度不推送、
  跨分頁刪除不被影片分頁覆蓋、暫停自動同步與選單文字、409 衝突重試、匯出不含 Token、匯入合併並推送、中斷同步

### 未能在此環境驗證
- 真正的 Tampermonkey 與動畫瘋頁面（巴哈 CSS 下齒輪按鈕的位置、material icon 顯示）
- 使用真實 Token 對 private repo 寫入

### 追加修正：在巴哈真實 CSS 下的版面
- dialog 上方空白：巴哈全站 `section { padding-top: 24px }` 套到 `.agh-content`；另有 `p`、`h3` 的 line-height。改以 `.agh-dialog :where(...)` 將元素樣式改回繼承
  - 驗證：`.agh-content` padding-top 24px → 0；標題文字距 dialog 頂端 19px，與左側導覽標題 20px 對齊
- 首頁齒輪偏下：巴哈 `.watch-more-block` 為 `align-items: flex-end`，改為工具列 `align-self: center`
  - 驗證（截圖像素量測實際筆畫中心）：icon 相對文字由偏下 1px → 0px、狀態文字由 1.5px → 0.5px；換 Noto Sans TC、LXGW WenKai TC、Huninn 當中文 fallback 字型結果相同
- 限制：此環境沒有微軟正黑體，無法以使用者實際字型量測

### 與規劃的差異
- 新增 `src/sync/http.ts`（HTTP 型別）與 `src/sync/syncService.ts`（連接 store 與 syncEngine），讓 adapter 與 engine 測試不依賴 `$`
- 新增 `src/sync/syncStorage.ts`、`syncPersistence.ts`：同步設定與狀態存在 GM storage 並跨分頁同步
- 手動「立即同步」從 Tampermonkey 選單執行時，以 `GM_notification` 顯示結果

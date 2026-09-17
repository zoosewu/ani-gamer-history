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

## 追加功能：用剪貼簿搬移雲端設定（2026-09-16）
- `src/sync/settingsTransfer.ts`：AES-GCM 加密，金鑰由兩張表 XOR 還原後經 PBKDF2 推導，避免密鑰以明文出現在 build 產物；輸出 `AGH1.` 前綴的 base64url
- `src/sync/clipboard.ts`：複製用 `GM_setClipboard`（不受使用者手勢限制）；讀取用 `navigator.clipboard.readText()`，失敗時 dialog 顯示手動貼上欄位
- `src/sync/adapter.ts`：新增可選的 `exportSettings` / `importSettings`，預設依 `fields` 取值（去空白、去空值）
- 貼上後只填入表單，由使用者按「儲存並同步」套用；不帶 `autoSync`；沒有有效期限
- 安全界線：金鑰在公開腳本內，任何人都能解開，只防手滑外洩；已寫在 readme
- 驗證：單元測試 8 個（來回轉換、竄改偵測、格式錯誤、非字串欄位過濾、adapter 覆寫）；端對端 16 個情境（含 A 複製 → C 手動貼上 → 儲存後拉到資料、B 直接讀剪貼簿）

## 追加：修正上次觀看標記 + 介面調整 + anime1（2026-09-16）
- **Bug 根因**：`VideoIndex.css` 沒有被任何檔案 import，`.saw-custom` 樣式從未注入；且該樣式與巴哈原生 `.season .saw` 幾乎相同會互相重疊
- **新標記**：在 `<li>` 內注入 `.agh-mark`（綠色角標），不使用 `li::after`，與巴哈的「播放中」（青）、「上次觀看」（粉）並存；用 `data-ani-video-sn` 對應集數；訂閱 store 與 MutationObserver，換集、雲端同步、站方重畫都會更新
- **另一個 bug（由端對端測試發現）**：標記原本插在 `<a>` 內，使 `innerHTML` 讀出的集數被污染，導致播放期間同步的防抖動被無限重設而永遠不上傳。改插 `<li>` 並改用 `textContent`
- **介面**：移除「測試連線」（改為儲存前自動檢查並保留 private 警告）、複製/貼上移到欄位上方、儲存鍵唯一置底、檔案路徑與分支收進「進階設定」、自動同步改 toggle、中斷同步移到同步狀態頁
- **anime1**：`source` / `seriesId` 欄位、合併鍵改為「來源 + 標題」、紀錄放在不綁使用者的 `@shared` bucket、首頁未登入也顯示、卡片用文字佔位與來源徽章、anime1 文章與列表頁標記上次觀看
- **驗證**：單元測試 56 → 72；端對端 16 → 20 個情境；真實巴哈與 anime1 CSS 下的標記截圖（含兩站標記同格／不同格）

## 追加：依來源隱藏顯示、不宣傳網站支援（2026-09-17）
- readme 移除 anime1 的專屬說明與 TODO 項目
- 新增每台電腦的顯示偏好 `preferences.hiddenSources`（不上傳雲端），跨分頁同步；抽出共用的 `src/gmPersistence.ts`
- 設定 dialog 的「顯示」頁只在有動畫瘋以外來源的紀錄時出現，依實際來源動態列出開關（未來網站自動適用）；隱藏只影響首頁清單，仍會記錄與同步
- 首頁讀使用者 id 改用 `textContent`，與影片頁一致
- toggle 的透明 checkbox 改疊在軌道上方，點擊直接落在控制項
- 驗證：單元測試 72 → 77；端對端 20 → 21 個情境（顯示頁出現條件、隱藏後首頁過濾、重新整理保留、偏好不觸發雲端推送）；真實巴哈 CSS 下確認來源徽章位置

## 追加：書籤式上次觀看標記（2026-09-17）
- 設計由比較頁選定：動畫瘋用「書籤」、anime1 採用推薦方案
- 共用 `src/pages/marker.css`：琥珀色書籤（避開動畫瘋的青、粉與 anime1 的綠），支援動畫瘋深色模式
- 動畫瘋分集按鈕：書籤掛在格子右上；滑過顯示「本機紀錄・第 N 集・看到 mm:ss / mm:ss」
- anime1 系列頁／文章頁：書籤在標題左側（曾改到最右側，使用者看過後決定改回左側）、日期旁「上次看到…」；文章頁打開其他集時顯示「上次看到第 N 集 →」
- anime1 首頁列表：以 `?cat=系列 id` 對應，書籤掛在該列上緣並接「看到第 N 集」；DataTables 換頁重畫時自動重新標記
- 驗證：單元測試 77 → 84；端對端 21 個情境；真實巴哈與 anime1 CSS 下檢查位置（書籤貼齊標題列左緣、與標題文字間隔 10px 不重疊）、同格並存、深色模式、列表換頁

## 追加：一個 PR 多個 commit 也能產生正確的 CHANGELOG（2026-09-17）
- `.github/workflows/changelog-override.yml`：PR 開啟、推新 commit、編輯描述時，把 conventional commits 寫進 PR 描述的 `BEGIN_COMMIT_OVERRIDE`（release-please 官方支援；squash 合併時取代 squash commit 訊息）
- `.github/scripts/changelog-override.cjs`：略過非 conventional、`fixup!`/`squash!`、重複訊息；保留 `BREAKING CHANGE`；有標記註解才由 workflow 維護，手動區塊不覆蓋；只處理本 repo 分支、跳過 Release PR
- 驗證：單元測試 11 個；以 release-please 17.11.2 的 `parseConventionalCommits` 驗證——沒有覆寫時 1 筆、用本 repo 真實的兩個 commit 自動覆寫後 2 筆、重大變更正確標記、手動覆寫優先
- 上線後修正：PR #15 的描述文字提到關鍵字，導致腳本誤判為手動區塊、release-please 也會讀成 0 筆。改為區塊放在描述最上方（`<details>` 收合）、手動區塊須為單獨成行的開始與結束標記；以 PR #15 真實描述驗證修正後為 1 筆

# 巴哈姆特動畫瘋觀看紀錄功能
動畫瘋的觀看紀錄 90 天就會消滅了，為了記錄自己曾經看過的動畫而做了這個小套件，將觀看紀錄存在本機內，也可以透過 GitHub Private Repository 在多台電腦之間同步。
# 安裝方法
1. 安裝[Tampermonkey](https://www.tampermonkey.net/)
2. [點我安裝套件](https://github.com/zoosewu/ani-gamer-history/releases/latest/download/ani-gamer-history.user.js)
# 使用方法
1. 紀錄動畫：在分級確認的地方點選同意的時候會將當下的動畫記錄起來
2. 顯示上次觀看：在動畫頁面會顯示上次觀看，即便已經超過 90 天
3. 顯示歷史紀錄：在首頁的本季新番下面會多一個本機歷史紀錄的列表，會從新到舊排序觀看紀錄。
4. 移除歷史紀錄：在首頁的本機歷史紀錄動畫右上角可以移除觀看紀錄。(無法復原，請慎用)
5. 最愛：在首頁的本機歷史紀錄動畫右上角可以加入最愛，最愛會排在列表最前面。
6. 同步設定：點首頁「本機歷史紀錄」標題右邊的齒輪，或 Tampermonkey 選單的「開啟同步設定」。
# 雲端同步（GitHub Private Repository）
所有資料合併都在腳本內完成，不需要架設伺服器。
1. 在 GitHub 建立一個 **Private** repository（例如 `ani-gamer-history-data`）。
2. 到 Settings → Developer settings → Personal access tokens → Fine-grained tokens 建立 Token：
   - Repository access 選「Only select repositories」，只勾剛剛建立的 repository
   - Repository permissions → Contents 設為「Read and write」
3. 打開同步設定的「雲端平台」頁，填入 Token 與 `owner/repo`，按「測試連線」確認後按「儲存並同步」。
4. 其他電腦重複步驟 3。

同步時機：
- 開啟首頁顯示歷史紀錄時，從雲端取得紀錄並與本機合併
- 開始看動畫（含換集）、移除、切換最愛、匯入之後，約 2 秒後上傳
- 播放中每秒更新的進度不會單獨上傳，會在下一次同步時一起帶上
- 可以在同步設定或 Tampermonkey 選單暫停自動同步，或手動「立即同步」

注意：
- Token 存在 Tampermonkey 的儲存空間，匯出的 JSON 不包含 Token
- 每次上傳會在 repository 產生一個 commit，可以在 GitHub 上查看歷史紀錄
- 請務必使用 Private repository，否則任何人都看得到你的觀看紀錄
# 在另一台電腦快速設定
設定好第一台之後，不必重新申請 Token：
1. 在「雲端平台」頁按 **複製設定**（Tampermonkey 選單也有「複製同步設定」），平台與 Token 會加密成一段 `AGH1.…` 的字串放進剪貼簿
2. 在另一台電腦打開同一個畫面，按 **貼上設定**。瀏覽器不允許讀取剪貼簿時，畫面會出現輸入欄位讓你手動貼上
3. 確認欄位內容後按 **儲存並同步**

加密金鑰就放在腳本裡，只能防止不小心貼到別的地方時被一眼看懂。**任何人拿到這段字串都能解開**，請當成 Token 本身看待，不要公開張貼；真的外流就到 GitHub 撤銷該 Token。
# 備份
同步設定的「備份」頁可以匯出 / 匯入 JSON。匯入時會與本機紀錄合併，不會覆蓋或刪除現有紀錄。匯出也可以從 Tampermonkey 選單執行。
# 開發
```bash
npm ci
npm run dev    # 開發模式
npm test       # 單元測試
npm run build  # 產生 dist/ani-gamer-history.user.js
```
新增同步平台：實作 `src/sync/adapter.ts` 的 `CloudAdapterDefinition`，並加入 `src/sync/cloudAdapters.ts`。
# 發佈
commit 訊息請使用 [Conventional Commits](https://www.conventionalcommits.org/lang/zh-hant/)（`feat:`、`fix:` 等），版本號與 CHANGELOG 由 release-please 依 commit 自動產生：
1. push 到 master 後，GitHub Actions 會自動建立或更新一個「chore: release x.y.z」的 Release PR
2. 合併該 PR 會建立 tag 與 GitHub Release，並自動 build 出 userscript 上傳為附檔
3. 附檔名稱固定為 `ani-gamer-history.user.js`，Tampermonkey 由 releases/latest 取得更新

`feat:` 會提升次版號、`fix:` 提升修訂號；`chore:`、`ci:`、`docs:`、`test:` 不會發版。
# TODO
- [X] 雲端同步的功能（GitHub Private Repository）
- [X] 刪除不想看的動畫
- [ ] 移除整個歷史紀錄
- [X] 匯入/匯出功能
- [X] 設定頁面（同步設定）
- [ ] 設定頁面可以啟用/關閉相關功能
- [ ] 其他同步平台

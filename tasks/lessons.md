# Lessons

## 2026-09-15 雲端同步規劃

- **設定介面要先確認使用者心中的樣子，不要只給二選一**：提出「Tampermonkey 選單 + prompt()」時，使用者兩次跳過選項要求釐清，最後自己描述了「首頁齒輪 → 左導覽右內容的 dialog」。
  - 規則：UI 型態的問題先說明各載體的能力限制（例如 Tampermonkey 選單只能放可點擊的文字項目、沒有表單），再讓使用者描述期望，而不是直接丟選擇題。
- **比較平台時要涵蓋使用者點名的所有對象**：使用者說「github & gist & cloudflare kv」時，GitHub（private repo）是獨立選項，不是 Gist 的同義詞；最後選的正是 private repo。
  - 規則：使用者列出的名詞逐一對應成比較表的欄位，不自行合併。
- **注入到第三方網站的 UI，必須在該網站真實的 CSS 下驗證**：dialog 在假頁面上看起來正常，但巴哈全站 CSS 對裸元素下了樣式（`section { padding-top: 24px }`、`p { line-height: 2em }`、`h3 { line-height: 1.5em }`），造成 dialog 上方多一塊空白；標題列 `.watch-more-block` 的 `align-items: flex-end` 讓齒輪偏下。使用者實際看了才發現。
  - 規則：注入的元件在自己的根元素下，用 `:where()` 把網站可能影響的元素樣式改回繼承（specificity 等同單一 class，後面的 class 樣式仍能覆蓋）。
  - 規則：交付前抓目標網站的真實 HTML + CSS，用 Playwright 渲染，以 CDP `CSS.getMatchedStylesForNode` 列出非自家規則的影響；對齊問題用截圖像素量測實際筆畫位置，不要只看元素框。
- **Tampermonkey 腳本的同步頻率要跟資料寫入頻率分開設計**：影片頁每秒寫入進度，推送時機要綁在「有意義的事件」（開始看、換集、刪除、最愛、匯入），不能綁在 state 變更。

## 2026-09-16 標記與 anime1

- **插進第三方 DOM 的元素會污染他們的讀取方式**：把標記 `<span>` 加到分集按鈕的 `<a>` 裡，導致 `getAnimeStatus()` 用 `innerHTML` 讀到 `1<span…>`，每秒都判定「換集」，同步的防抖動計時器被無限重設，播放期間永遠不會上傳。
  - 規則：注入的元素放在不會被對方讀取的容器（這裡改放 `<li>`），而且自己讀取頁面文字時一律用 `textContent`，不要用 `innerHTML`。
- **測試替身要忠於真實行為**：GM storage 是「同一腳本跨網站共用」，但替身用 `localStorage`（按網域隔離），導致 anime1 分頁看不到動畫瘋的資料，測試失敗的原因其實在測試本身。
  - 規則：替身的語意要對照真實 API 的文件，跨網域、跨分頁這類特性要一起模擬。
- **先確認再修**：一度以為 `filter(fp.lt(0))` 參數順序寫反是 bug，實測 `fp.lt(0)("1") === true` 才發現是對的，真正原因是 CSS 從未被 import。
  - 規則：懷疑某行有問題時，先用一行指令驗證假設，不要直接改。

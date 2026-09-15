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

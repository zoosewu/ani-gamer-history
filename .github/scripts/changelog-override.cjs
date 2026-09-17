// 依 PR 上的 commits 產生 release-please 的 BEGIN_COMMIT_OVERRIDE 區塊。
// squash 合併後，release-please 會用這個區塊取代 squash commit 的訊息，
// 讓同一個 PR 裡的多個 commit 各自成為一筆 CHANGELOG。

const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?: \S/
const AUTOSQUASH = /^(fixup|squash|amend)! /
const BREAKING = /^BREAKING[ -]CHANGE: /
const MARKER = '<!-- changelog-override：由 workflow 依 commit 自動產生；要手動調整請刪除這一行 -->'
const SUMMARY = '<summary>CHANGELOG（依 commit 自動產生）</summary>'

// workflow 維護的區塊（一定帶有標記）
const MANAGED_BLOCK = /<details>\n<summary>CHANGELOG（依 commit 自動產生）<\/summary>\n\n<!-- changelog-override：[^\n]*-->\n```\nBEGIN_COMMIT_OVERRIDE\n[\s\S]*?\nEND_COMMIT_OVERRIDE\n```\n\n<\/details>\n*/g
// 使用者手寫的區塊：關鍵字要單獨成行，文字裡順帶提到不算
const MANUAL_BLOCK = /^[ \t]*BEGIN_COMMIT_OVERRIDE[ \t]*$[\s\S]*?^[ \t]*END_COMMIT_OVERRIDE[ \t]*$/m

// 一個 commit 訊息轉成一筆紀錄；不是 conventional commit 時回傳 null
const toEntry = (message) => {
  const [subject = '', ...body] = message.split(/\r?\n/)
  const header = subject.trim()
  if (AUTOSQUASH.test(header) || !CONVENTIONAL.test(header)) return null
  const breaking = body.map((line) => line.trim()).filter((line) => BREAKING.test(line))
  // 重大變更說明要和標題隔一行，才會被當成同一筆紀錄的 footer
  return breaking.length === 0 ? header : `${header}\n\n${breaking.join('\n')}`
}

// 每筆之間空一行：release-please 以「空行 + 行首類型」切分成多筆
const buildOverride = (messages) => {
  const entries = [...new Set(messages.map(toEntry).filter((entry) => entry !== null))]
  if (entries.length === 0) return null
  return `BEGIN_COMMIT_OVERRIDE\n${entries.join('\n\n')}\nEND_COMMIT_OVERRIDE`
}

// 回傳更新後的 PR 描述；不需要更新時回傳 null
const applyOverride = (body, messages) => {
  const current = body ?? ''
  const rest = current.replace(MANAGED_BLOCK, '').trim()
  // 使用者自己寫的覆寫區塊優先，不去動它
  if (MANUAL_BLOCK.test(rest)) return null

  const override = buildOverride(messages)
  // 放在描述最上方：release-please 從第一個 BEGIN_COMMIT_OVERRIDE 開始讀，
  // 描述其他地方提到這個字時也不會讀錯
  const block = override === null
    ? ''
    : `<details>\n${SUMMARY}\n\n${MARKER}\n\`\`\`\n${override}\n\`\`\`\n\n</details>`
  const next = [block, rest].filter((part) => part !== '').join('\n\n')
  return next.trim() === current.trim() ? null : next
}

module.exports = { MARKER, toEntry, buildOverride, applyOverride }

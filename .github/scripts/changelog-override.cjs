// 依 PR 上的 commits 產生 release-please 的 BEGIN_COMMIT_OVERRIDE 區塊。
// squash 合併後，release-please 會用這個區塊取代 squash commit 的訊息，
// 讓同一個 PR 裡的多個 commit 各自成為一筆 CHANGELOG。

const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?: \S/
const AUTOSQUASH = /^(fixup|squash|amend)! /
const BREAKING = /^BREAKING[ -]CHANGE: /
const MARKER = '<!-- changelog-override：由 workflow 依 commit 自動產生；要手動調整請刪除這一行 -->'
const MANAGED_BLOCK = /\n*<!-- changelog-override：[^\n]*-->\nBEGIN_COMMIT_OVERRIDE[\s\S]*?END_COMMIT_OVERRIDE\n*/

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
  // 使用者自己寫的覆寫區塊（沒有標記）優先，不去動它
  if (current.includes('BEGIN_COMMIT_OVERRIDE') && !current.includes(MARKER)) return null

  const override = buildOverride(messages)
  const withoutBlock = current.replace(MANAGED_BLOCK, '\n').trimEnd()
  const next = override === null
    ? withoutBlock
    : `${withoutBlock}${withoutBlock === '' ? '' : '\n\n'}${MARKER}\n${override}`
  return next.trim() === current.trim() ? null : next
}

module.exports = { MARKER, toEntry, buildOverride, applyOverride }

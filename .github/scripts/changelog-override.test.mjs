import { describe, expect, it } from 'vitest'
import override from './changelog-override.cjs'

const { MARKER, toEntry, buildOverride, applyOverride } = override

const managed = (lines) =>
  `<details>\n<summary>CHANGELOG（依 commit 自動產生）</summary>\n\n${MARKER}\n\`\`\`\nBEGIN_COMMIT_OVERRIDE\n${lines}\nEND_COMMIT_OVERRIDE\n\`\`\`\n\n</details>`

describe('toEntry', () => {
  it('只取 conventional commit 的標題', () => {
    expect(toEntry('fix(home): full width titles\n\nLonger explanation')).toBe('fix(home): full width titles')
    expect(toEntry('feat!: drop old storage format')).toBe('feat!: drop old storage format')
  })

  it('略過不符合格式與 autosquash 的 commit', () => {
    expect(toEntry('wip')).toBeNull()
    expect(toEntry('Merge branch \'master\' into fix/x')).toBeNull()
    expect(toEntry('fixup! fix(home): full width titles')).toBeNull()
    expect(toEntry('feature: not a real type')).toBeNull()
  })

  it('保留重大變更說明，並和標題隔一行', () => {
    expect(toEntry('feat(sync): new format\n\nDetails\n\nBREAKING CHANGE: old backups cannot be imported'))
      .toBe('feat(sync): new format\n\nBREAKING CHANGE: old backups cannot be imported')
  })
})

describe('buildOverride', () => {
  it('每筆之間空一行，重複的訊息只保留一次', () => {
    expect(buildOverride(['fix(a): one', 'wip', 'fix(b): two', 'fix(a): one'])).toBe(
      'BEGIN_COMMIT_OVERRIDE\nfix(a): one\n\nfix(b): two\nEND_COMMIT_OVERRIDE'
    )
  })

  it('沒有任何 conventional commit 時回傳 null', () => {
    expect(buildOverride(['wip', 'update'])).toBeNull()
  })
})

describe('applyOverride', () => {
  const commits = ['fix(anime1): left bookmark', 'fix(home): full width titles']
  const block = managed('fix(anime1): left bookmark\n\nfix(home): full width titles')

  it('把收合的覆寫區塊放在描述最上方', () => {
    expect(applyOverride('修正兩個版面問題', commits)).toBe(`${block}\n\n修正兩個版面問題`)
  })

  it('空白描述時只放覆寫區塊', () => {
    expect(applyOverride(null, commits)).toBe(block)
  })

  it('描述文字裡提到關鍵字時不算手動區塊，仍會加上自動區塊', () => {
    const prose = 'Add a workflow that writes every commit into a BEGIN_COMMIT_OVERRIDE block.'
    expect(applyOverride(prose, commits)).toBe(`${block}\n\n${prose}`)
  })

  it('推了新的 commit 時只替換自動區塊，保留其他描述', () => {
    const first = applyOverride('說明文字', commits.slice(0, 1))
    const second = applyOverride(first, commits)
    expect(second).toBe(applyOverride('說明文字', commits))
    expect(second.match(/BEGIN_COMMIT_OVERRIDE/g)).toHaveLength(1)
  })

  it('內容沒變時回傳 null，避免多餘的編輯', () => {
    expect(applyOverride(applyOverride('說明文字', commits), commits)).toBeNull()
  })

  it('commit 都不是 conventional 時移除自動區塊', () => {
    expect(applyOverride(applyOverride('說明文字', commits), ['wip'])).toBe('說明文字')
  })

  it('使用者手動寫的覆寫區塊不會被改動', () => {
    const manual = '說明\n\nBEGIN_COMMIT_OVERRIDE\nfeat: 手動調整的描述\nEND_COMMIT_OVERRIDE'
    expect(applyOverride(manual, commits)).toBeNull()
  })

  it('刪掉標記後，原本的自動區塊就視為手動維護', () => {
    const edited = applyOverride('說明', commits).replace(`${MARKER}\n`, '')
    expect(applyOverride(edited, ['fix: 另一個 commit'])).toBeNull()
  })
})

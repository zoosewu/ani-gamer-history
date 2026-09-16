import { describe, expect, it } from 'vitest'
import { AdapterSettings } from './adapter'
import { decodeSettingsTransfer, encodeSettingsTransfer } from './settingsTransfer'

const transfer = {
  adapterId: 'github-repo',
  settings: { token: 'github_pat_secret_value', repository: 'me/ani-gamer-history-data' }
}

describe('settingsTransfer', () => {
  it('加密後可以原樣還原，字串裡看不到 Token 或平台名稱', async () => {
    const text = await encodeSettingsTransfer(transfer)
    expect(text.startsWith('AGH1.')).toBe(true)
    expect(text).not.toContain('github_pat_secret_value')
    expect(text).not.toContain('github-repo')
    expect(await decodeSettingsTransfer(text)).toEqual(transfer)
  })

  it('每次加密的結果都不同', async () => {
    expect(await encodeSettingsTransfer(transfer)).not.toBe(await encodeSettingsTransfer(transfer))
  })

  it('允許前後有空白或換行', async () => {
    const text = await encodeSettingsTransfer(transfer)
    expect(await decodeSettingsTransfer(`  ${text}\n`)).toEqual(transfer)
  })

  it('不是設定字串時給明確訊息', async () => {
    await expect(decodeSettingsTransfer('hello')).rejects.toThrow('不是同步設定')
    await expect(decodeSettingsTransfer('')).rejects.toThrow('不是同步設定')
    await expect(decodeSettingsTransfer('https://ani.gamer.com.tw/')).rejects.toThrow('不是同步設定')
  })

  it('內容被竄改或不完整時回報損毀', async () => {
    const text = await encodeSettingsTransfer(transfer)
    const tail = text.slice(-4)
    await expect(decodeSettingsTransfer(text.slice(0, -4) + (tail === 'AAAA' ? 'BBBB' : 'AAAA'))).rejects.toThrow('已損毀')
    await expect(decodeSettingsTransfer('AGH1.AAAA')).rejects.toThrow('已損毀')
    await expect(decodeSettingsTransfer('AGH1.!!!!')).rejects.toThrow('已損毀')
  })

  it('只保留字串型別的設定欄位', async () => {
    const dirty = { adapterId: 'github-repo', settings: { token: 'abc', count: 3 } as unknown as AdapterSettings }
    expect(await decodeSettingsTransfer(await encodeSettingsTransfer(dirty))).toEqual({ adapterId: 'github-repo', settings: { token: 'abc' } })
  })
})

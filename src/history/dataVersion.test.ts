import { describe, expect, it } from 'vitest'
import { formatDataVersion, isNewerThanSupported, legacySchemaVersion, parseDataVersion } from './dataVersion'

const v = (text: string): ReturnType<typeof parseDataVersion> => parseDataVersion(text)

describe('parseDataVersion', () => {
  it('只接受 MAJOR ≥ 1 的 MAJOR.MINOR.PATCH', () => {
    expect(v('2.10.3')).toEqual({ major: 2, minor: 10, patch: 3 })
    expect(formatDataVersion({ major: 2, minor: 10, patch: 3 })).toBe('2.10.3')
    ;['0.1.0', '2.0', '02.0.0', 'v2.0.0', '2.0.0-beta', ''].forEach((text) => expect(v(text)).toBeNull())
    expect(parseDataVersion(2)).toBeNull()
  })
})

describe('isNewerThanSupported', () => {
  const supported = { major: 2, minor: 1, patch: 0 }
  it('MAJOR 或 MINOR 比較新時拒絕，只有 PATCH 比較新時接受', () => {
    expect(isNewerThanSupported({ major: 3, minor: 0, patch: 0 }, supported)).toBe(true)
    expect(isNewerThanSupported({ major: 2, minor: 2, patch: 0 }, supported)).toBe(true)
    expect(isNewerThanSupported({ major: 2, minor: 1, patch: 9 }, supported)).toBe(false)
    expect(isNewerThanSupported({ major: 2, minor: 0, patch: 5 }, supported)).toBe(false)
    expect(isNewerThanSupported({ major: 1, minor: 9, patch: 9 }, supported)).toBe(false)
  })
})

describe('legacySchemaVersion', () => {
  it('2.0.x 讓 0.8.0、0.9.0 照常讀取，之後一律讓它拒絕', () => {
    expect(legacySchemaVersion({ major: 2, minor: 0, patch: 4 })).toBe(2)
    expect(legacySchemaVersion({ major: 2, minor: 1, patch: 0 })).toBe(3)
    expect(legacySchemaVersion({ major: 3, minor: 0, patch: 0 })).toBe(3)
  })
})

import { describe, expect, it } from 'vitest'
import { defaultPreferences, isMarkerVisible, isSourceVisible, parsePreferences } from './preferences'

describe('preferences', () => {
  it('格式不對時回到預設值', () => {
    expect(parsePreferences(null)).toEqual(defaultPreferences)
    expect(parsePreferences('oops')).toEqual(defaultPreferences)
    expect(parsePreferences({ hiddenSources: 'anime1' })).toEqual(defaultPreferences)
  })

  it('只保留字串、去重並排序', () => {
    expect(parsePreferences({ hiddenSources: ['b', 'anime1', 3, 'anime1'], hiddenMarkers: ['anime1', 'ani-gamer', 'anime1'] }))
      .toEqual({ hiddenSources: ['anime1', 'b'], hiddenMarkers: ['ani-gamer', 'anime1'] })
  })

  it('舊版沒有 hiddenMarkers 時預設全部顯示', () => {
    expect(parsePreferences({ hiddenSources: ['anime1'] })).toEqual({ hiddenSources: ['anime1'], hiddenMarkers: [] })
  })

  it('一個欄位格式不對時不影響其他欄位', () => {
    expect(parsePreferences({ hiddenSources: 'oops', hiddenMarkers: ['anime1'] })).toEqual({ hiddenSources: [], hiddenMarkers: ['anime1'] })
  })

  it('判斷來源與標記是否顯示', () => {
    expect(isSourceVisible(defaultPreferences, 'anime1')).toBe(true)
    expect(isSourceVisible({ ...defaultPreferences, hiddenSources: ['anime1'] }, 'anime1')).toBe(false)
    expect(isMarkerVisible(defaultPreferences, 'ani-gamer')).toBe(true)
    expect(isMarkerVisible({ ...defaultPreferences, hiddenMarkers: ['ani-gamer'] }, 'ani-gamer')).toBe(false)
    expect(isMarkerVisible({ ...defaultPreferences, hiddenMarkers: ['ani-gamer'] }, 'anime1')).toBe(true)
  })
})

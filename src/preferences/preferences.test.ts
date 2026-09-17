import { describe, expect, it } from 'vitest'
import { defaultPreferences, isSourceVisible, parsePreferences } from './preferences'

describe('preferences', () => {
  it('格式不對時回到預設值', () => {
    expect(parsePreferences(null)).toEqual(defaultPreferences)
    expect(parsePreferences('oops')).toEqual(defaultPreferences)
    expect(parsePreferences({ hiddenSources: 'anime1' })).toEqual(defaultPreferences)
  })

  it('只保留字串、去重並排序', () => {
    expect(parsePreferences({ hiddenSources: ['b', 'anime1', 3, 'anime1'] })).toEqual({ hiddenSources: ['anime1', 'b'] })
  })

  it('判斷來源是否顯示', () => {
    expect(isSourceVisible(defaultPreferences, 'anime1')).toBe(true)
    expect(isSourceVisible({ hiddenSources: ['anime1'] }, 'anime1')).toBe(false)
  })
})

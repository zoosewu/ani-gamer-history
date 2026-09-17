import { describe, expect, it } from 'vitest'
import { Anime } from './types'
import { animeKey, animeUrl, listExtraSources, sourceLabel, sourceOf } from './source'

const anime = (overrides: Partial<Anime> = {}): Anime => ({
  id: '42', timestamp: 1, title: '測試動畫', episodePicUrl: '', animePicUrl: '', episode: '1', videoWatchTime: 0, videoTotalTime: 0, ...overrides
})

describe('source', () => {
  it('沒有 source 的舊資料視為動畫瘋', () => {
    expect(sourceOf(anime())).toBe('ani-gamer')
    expect(sourceOf(anime({ source: 'anime1' }))).toBe('anime1')
  })

  it('依來源組出連結', () => {
    expect(animeUrl(anime())).toBe('animeVideo.php?sn=42')
    expect(animeUrl(anime({ source: 'anime1', id: '30152' }))).toBe('https://anime1.me/30152')
  })

  it('同名不同來源的 key 不同', () => {
    expect(animeKey(anime())).not.toBe(animeKey(anime({ source: 'anime1' })))
    expect(animeKey(anime())).toBe(animeKey(anime({ source: 'ani-gamer' })))
  })

  it('只列出動畫瘋以外、實際有紀錄的來源', () => {
    expect(listExtraSources({})).toEqual([])
    expect(listExtraSources({ tester: [anime()] })).toEqual([])
    expect(listExtraSources({ tester: [anime()], '@shared': [anime({ source: 'anime1' }), anime({ source: 'anime1', title: '另一部' })] })).toEqual(['anime1'])
  })

  it('未知來源的標籤直接使用來源名稱', () => {
    expect(sourceLabel('anime1')).toBe('anime1')
    expect(sourceLabel('ani-gamer')).toBe('動畫瘋')
    expect(sourceLabel('future-site')).toBe('future-site')
  })
})

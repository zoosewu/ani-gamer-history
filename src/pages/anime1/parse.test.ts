import { describe, expect, it } from 'vitest'
import { Anime } from '@/history/types'
import { matchesRecord, parseApiReq, parsePostId, parseSeriesIdFromHref, stripEpisodeSuffix } from './parse'

const record = (overrides: Partial<Anime> = {}): Anime => ({
  source: 'anime1',
  id: '30152',
  seriesId: '1898',
  timestamp: 1,
  title: 'LIAR GAME 詐欺遊戲',
  episodePicUrl: '',
  animePicUrl: '',
  episode: '24',
  videoWatchTime: 0,
  videoTotalTime: 0,
  ...overrides
})

describe('parseApiReq', () => {
  it('解出系列 id 與集數', () => {
    const value = encodeURIComponent(JSON.stringify({ c: '1898', e: '24', t: 1789544709, p: 0, s: 'abc' }))
    expect(parseApiReq(value)).toEqual({ seriesId: '1898', episode: '24' })
  })

  it('數字型別也接受，集數可以是小數或特別篇', () => {
    expect(parseApiReq(encodeURIComponent(JSON.stringify({ c: 1898, e: 24.5 })))).toEqual({ seriesId: '1898', episode: '24.5' })
    expect(parseApiReq(encodeURIComponent(JSON.stringify({ c: '1898', e: 'OVA' })))).toEqual({ seriesId: '1898', episode: 'OVA' })
  })

  it('格式不對時回傳 undefined', () => {
    expect(parseApiReq(null)).toBeUndefined()
    expect(parseApiReq('')).toBeUndefined()
    expect(parseApiReq('not-json')).toBeUndefined()
    expect(parseApiReq(encodeURIComponent(JSON.stringify({ e: '24' })))).toBeUndefined()
  })
})

describe('parseSeriesIdFromHref', () => {
  it('從列表連結取出系列 id', () => {
    expect(parseSeriesIdFromHref('//anime1.me/?cat=1898')).toBe('1898')
    expect(parseSeriesIdFromHref('https://anime1.me/?page=2&cat=42')).toBe('42')
  })

  it('不是系列連結時回傳空字串', () => {
    expect(parseSeriesIdFromHref('https://anime1.me/30152')).toBe('')
    expect(parseSeriesIdFromHref('')).toBe('')
  })
})

describe('parsePostId', () => {
  it('從 article id 取出文章編號', () => {
    expect(parsePostId('post-30152')).toBe('30152')
    expect(parsePostId('post-16772')).toBe('16772')
  })

  it('格式不對時回傳空字串', () => {
    expect(parsePostId('comments')).toBe('')
    expect(parsePostId('post-abc')).toBe('')
  })
})

describe('stripEpisodeSuffix', () => {
  it('去掉標題結尾的集數', () => {
    expect(stripEpisodeSuffix('LIAR GAME 詐欺遊戲 [24]')).toBe('LIAR GAME 詐欺遊戲')
    expect(stripEpisodeSuffix('無職轉生 [OVA]')).toBe('無職轉生')
  })

  it('標題本身含中括號時只去掉最後一組', () => {
    expect(stripEpisodeSuffix('【我推的孩子】 [12]')).toBe('【我推的孩子】')
  })

  it('沒有集數時原樣回傳', () => {
    expect(stripEpisodeSuffix('動畫列表')).toBe('動畫列表')
  })
})

describe('matchesRecord', () => {
  const info = { seriesId: '1898', episode: '24', title: 'LIAR GAME 詐欺遊戲', postId: '30152' }

  it('系列 id 與集數都相同才算命中', () => {
    expect(matchesRecord(record(), info)).toBe(true)
    expect(matchesRecord(record({ episode: '23' }), info)).toBe(false)
    expect(matchesRecord(record({ seriesId: '999' }), info)).toBe(false)
  })

  it('舊紀錄沒有系列 id 時改用標題比對', () => {
    expect(matchesRecord(record({ seriesId: undefined }), info)).toBe(true)
    expect(matchesRecord(record({ seriesId: undefined, title: '別的動畫' }), info)).toBe(false)
  })
})

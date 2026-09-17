import { describe, expect, it } from 'vitest'
import { describeProgress, formatPlaybackTime } from './time'

describe('formatPlaybackTime', () => {
  it('未滿一小時顯示分:秒', () => {
    expect(formatPlaybackTime(0)).toBe('0:00')
    expect(formatPlaybackTime(922.7)).toBe('15:22')
    expect(formatPlaybackTime(1440)).toBe('24:00')
  })

  it('超過一小時顯示時:分:秒', () => {
    expect(formatPlaybackTime(3725)).toBe('1:02:05')
  })

  it('不合法的數字視為 0', () => {
    expect(formatPlaybackTime(NaN)).toBe('0:00')
    expect(formatPlaybackTime(-5)).toBe('0:00')
  })
})

describe('describeProgress', () => {
  it('有總長度時顯示看到的時間與總長度', () => {
    expect(describeProgress({ videoWatchTime: 922, videoTotalTime: 1440 })).toBe('15:22 / 24:00')
  })

  it('沒有總長度時只顯示看到的時間', () => {
    expect(describeProgress({ videoWatchTime: 922, videoTotalTime: 0 })).toBe('15:22')
  })
})

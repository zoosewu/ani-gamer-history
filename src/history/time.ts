import { Anime } from './types'

const pad = (value: number): string => String(value).padStart(2, '0')

// 播放時間：未滿一小時顯示 m:ss，否則 h:mm:ss
export const formatPlaybackTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`
}

// 「15:22 / 24:00」；不知道總長度時只顯示看到的時間
export const describeProgress = ({ videoWatchTime, videoTotalTime }: Pick<Anime, 'videoWatchTime' | 'videoTotalTime'>): string =>
  videoTotalTime > 0
    ? `${formatPlaybackTime(videoWatchTime)} / ${formatPlaybackTime(videoTotalTime)}`
    : formatPlaybackTime(videoWatchTime)

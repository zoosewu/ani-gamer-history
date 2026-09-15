import React from 'react'
import ReactDOM from 'react-dom/client'
import { filter, map, of, Subscription } from 'rxjs'
import fp from 'lodash/fp'
import { Anime } from '@/history/types'
import { isRemoved } from '@/history/merge'
import { isNotNil } from '@/util'
import { store } from '../redux/store'
import { Provider } from 'react-redux'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { removeAnime, toggleFavorite } from '../redux/animeHistorySlice'
import { openSettings } from '../settings/openSettings'
import { SyncIndicator } from '../settings/SyncIndicator'
import { requestCloudSync } from '@/sync/syncService'
import './HomeIndex.css'

export default (URL: URL): Subscription => of(URL)
  .pipe(
    map(fp.get('pathname')),
    filter(fp.eq('/'))
  )
  .subscribe((pathname) => {
    init(pathname)
  })
interface AnimeCartPayload {
  userId: string
  anime: Anime
}

const AnimeCard = ({ userId, anime: { id, title, episodePicUrl, animePicUrl, episode, videoWatchTime, videoTotalTime, removeTime, isFavorite } }: AnimeCartPayload): JSX.Element => {
  const dispatch = useAppDispatch()
  // goto href={`animeVideo.php?sn=${id}`}
  const handleClick = (): void => {
    window.location.href = `animeVideo.php?sn=${id}`
  }
  const leftMinutes = Math.max(Math.floor((videoTotalTime - videoWatchTime) / 60), 0)
  return (
    <div className='continue-watch-card' style={{ transition: '1s', paddingBottom: 'unset', height: 'unset', minWidth: '100px' }}>
      <a className='img-block' data-gtm-category='首頁' data-gtm-event='點擊繼續觀看卡片' tabIndex={0}>
        <div style={{ pointerEvents: 'none' }}>
          <div className='img-bg-blur-bg is-next' style={{ backgroundImage: `url('${episodePicUrl}')`, visibility: 'hidden' }} />
          <div className='img-bg-blur-bg' style={{ backgroundImage: `url('${animePicUrl}')` }} />
          <img className='card-img is-next lazyloaded' style={{ visibility: 'hidden' }} src={episodePicUrl} data-src={episodePicUrl} alt={title} />
          <img className='card-img lazyloaded' src={animePicUrl} data-src={animePicUrl} alt={title} />
          <a className='line-gradient' style={{ pointerEvents: 'auto' }} onClick={() => handleClick()} href={`animeVideo.php?sn=${id}`} />
          <i className='btn-delete material-icons-round' data-gtm-category='首頁' data-gtm-event='點擊移除繼續觀看卡片' style={{ pointerEvents: 'auto' }} onClick={() => dispatch(removeAnime({ userId, animeTitle: title }))}>close</i>
          <div
            className={'btn-card-block btn-favorite btn-not-active' + (isFavorite ?? false ? ' btn-is-active' : '')}
            style={{
              width: '40px',
              height: '40px',
              position: 'absolute',
              top: '-4px',
              right: '32px',
              pointerEvents: 'auto',
              transition: '500ms',
              zIndex: 4
            }}
            onClick={() => dispatch(toggleFavorite({ userId, animeTitle: title }))}
          />
        </div>
      </a>
      <a className='content-block' href={`animeVideo.php?sn=${id}`} data-gtm-category='首頁' data-gtm-event='點擊繼續觀看卡片' tabIndex={0}>
        <div className='img-progress-block' style={{ pointerEvents: 'none' }}>
          <div className='info-row'>
            <div className='episode-block'>
              <img src='https://i2.bahamut.com.tw/anime/pic-tv.svg' alt='pic-tv' />
              <p className='episode-watched' data-episode={`第 ${episode} 集`}>第 {episode} 集</p>
            </div>
            {videoTotalTime > 0 && (
              <p className='time-left' data-time={`剩餘 ${leftMinutes} 分`}>剩餘 {leftMinutes} 分</p>
            )}
          </div>
          {videoTotalTime > 0 && videoWatchTime > 0 && (
            <div className='progress-bar'>
              <div className='progress' style={{ width: `${(videoWatchTime / videoTotalTime) * 100}%` }} data-progress={`${(videoWatchTime / videoTotalTime) * 100}`} />
            </div>
          )}
        </div>
        <div className='content' style={{ pointerEvents: 'none' }}>
          <p className='anime-name'>
            {title}
          </p>
        </div>
      </a>
    </div>
  )
}

interface MainContainerPayload {
  userId: string
}
const MainContainer = ({ userId }: MainContainerPayload): JSX.Element => {
  const animeHistory = useAppSelector((state) => state.animeHistory)
  const histories = animeHistory[userId] ?? []
  const filtered = histories.filter(anime => !isRemoved(anime))
  const favs = filtered.filter(a => a.isFavorite === true).sort((a, b) => b.timestamp - a.timestamp)
  const others = filtered.filter(a => a.isFavorite !== true).sort((a, b) => b.timestamp - a.timestamp)
  const sorted = [...favs, ...others]

  const Histories = sorted.map(anime => <AnimeCard key={anime.title} userId={userId} anime={anime} />)
  return (
    <div id='watched-anime' className='continue-watch-area ani-gamer-history'>
      <div className='theme-title-block'>
        <div className='watch-more-block'>
          <h1 className='theme-title'>本機歷史紀錄</h1>
          <div className='agh-title-tools'>
            <SyncIndicator />
            <button type='button' className='agh-gear' title='同步設定' aria-label='同步設定' onClick={() => openSettings()}>
              <i className='material-icons-round'>settings</i>
            </button>
          </div>
        </div>
      </div>
      {sorted.length === 0 && <p className='agh-empty'>尚無紀錄</p>}
      <div
        id='continue-watch'
        className='continue-watch-list slick-initialized slick-slider'
      >
        <div aria-live='polite' className='slick-list draggable'>
          <div
            style={{
              opacity: '1',
              width: '100%',
              transform: 'translate3d(0px, 0px, 0px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '16px',
              transition: '1s'
            }}
            role='listbox'
          >{Histories}
          </div>
        </div>
      </div>
    </div>
  )
}
const init = (pathname: string): Subscription => of(pathname).pipe(
  map(() => document.getElementsByClassName('user-id')[0]?.innerHTML),
  filter(isNotNil)
).subscribe((userId) => {
  const app = document.getElementById('blockContinueWatch') ?? document.getElementById('blockVideoInSeason')
  const container = document.createElement('div')
  app?.after(container)
  const root = ReactDOM.createRoot(container)
  root.render(
    <Provider store={store}>
      <MainContainer userId={userId} />
    </Provider>
  )
  // 要顯示列表時，先從雲端取得最新紀錄
  void requestCloudSync('display')
})

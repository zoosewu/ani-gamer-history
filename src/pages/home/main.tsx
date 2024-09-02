import React from 'react'
import ReactDOM from 'react-dom/client'
import { filter, map, of, Subscription } from 'rxjs'
import fp from 'lodash/fp'
import { Anime } from '@/util.interface'
import { globalVar, isNotNil } from '@/util'
import { RootState, store } from '../redux/store'
import { Provider, useDispatch, useSelector } from 'react-redux'
import { removeAnime } from '../redux/animeHistorySlice'

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
const AnimeCard = ({ userId, anime }: AnimeCartPayload): JSX.Element => {
  const { id, title, animePicUrl, episode } = anime
  const dispatch = useDispatch()
  return (
    <div
      className='continue-watch-container slick-slide slick-active'
      data-video-sn={id}
      data-slick-index='3'
      aria-hidden='false'
      style={{ width: '250px', transition: '1s' }}
      tabIndex={-1}
      role='option'
      aria-describedby='slick-slide13'
    >
      <div className='continue-watch-card'>
        <a
          className='img-block'
          // href={'animeVideo.php?sn=' + id}
          data-gtm-category='首頁'
          data-gtm-event='點擊繼續觀看卡片'
          tabIndex={0}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{ pointerEvents: 'none' }}>
            <div
              className='img-bg-blur-bg'
              style={{ backgroundImage: `url(${animePicUrl})` }}
            />
            <img
              className='card-img lazyloaded'
              src={animePicUrl}
              data-src={animePicUrl}
              alt={title}
              style={{ pointerEvents: 'auto' }}
              onClick={() => (window.location.href = `animeVideo.php?sn=${id}`)}
            />
            <div className='line-gradient' />
            <i
              className='btn-delete material-icons-round'
              data-gtm-category='首頁'
              data-gtm-event='點擊移除繼續觀看卡片'
              style={{ pointerEvents: 'auto' }}
              onClick={() => dispatch(removeAnime({ userId, animeTitle: title }))}
            >close
            </i>
            <div className='img-progress-block'>
              <div className='info-row'>
                <div className='episode-block'>
                  <img
                    src='https://i2.bahamut.com.tw/anime/pic-tv.svg'
                    alt='pic-tv'
                  />
                  <p className='episode-watched'>第{episode}集</p>
                </div>
              </div>
              {/* <div className='progress-bar'>
                <div className='progress' style={{ width: '0%' }} />
              </div> */}
            </div>
          </div>
        </a>
        <div className='content-block'>
          <div className='content'>
            <a
              className='anime-name'
              href='animeVideo.php?sn=39290'
              data-gtm-category='首頁'
              data-gtm-event='點擊繼續觀看卡片'
              tabIndex={0}
            >
              <p className='anime-name_always-show'>{title}</p>
              <p className='anime-name_for-marquee'>{title}</p>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

interface MainContainerPayload {
  userId: string
}
const MainContainer = ({ userId }: MainContainerPayload): JSX.Element => {
  const animeHistory = useSelector((state: RootState) => state.animeHistory)
  const histories = animeHistory[userId]
  const historiesDOM = histories.map((anime) => (
    <AnimeCard
      key={anime.title}
      userId={userId}
      anime={anime}
    />
  ))
  return (
    <div id='watched-anime' className='continue-watch-area'>
      <div className='theme-title-block'>
        <div className='watch-more-block'>
          <h1 className='theme-title'>本機歷史紀錄</h1>
        </div>
      </div>
      <div
        id='continue-watch'
        className='continue-watch-list slick-initialized slick-slider'
      >
        <div aria-live='polite' className='slick-list draggable'>
          <div
            className='slick-track'
            style={{ opacity: '1', width: '100%', transform: 'translate3d(0px, 0px, 0px)' }}
            role='listbox'
          >{historiesDOM}
          </div>
        </div>
      </div>
    </div>
  )
}
const init = (pathname: string): Subscription => of(pathname).pipe(
  map(() => document.getElementsByClassName('user-id')[0]?.innerHTML),
  filter(isNotNil),
  filter((userId) => globalVar?.animeHistory?.[userId] != null)
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
})

// ==UserScript==
// @name         GA
// @namespace    https://github.com/zoosewu
// @version      0.0.1
// @description  快速Training
// @author       Zoosewu
// @match        https://ani.gamer.com.tw/*
// @icon         https://i2.bahamut.com.tw/anime/logo.svg1
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/rxjs/7.8.1/rxjs.umd.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.fp.min.js
// @require      https://unpkg.com/react@18/umd/react.development.js
// @require      https://unpkg.com/react-dom@18/umd/react-dom.development.js
//// @require      https://unpkg.com/react@18/umd/react.production.min.js
//// @require      https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
// ==/UserScript==
/* global rxjs, _*/

// Init
const log = console.log;
const fp = _.noConflict();
let animeHistory = JSON.parse(GM_getValue("animeHistory", "{}"));
log("Init GAnime", animeHistory);

// utilities
const observeOnMutation = (config) => (target) =>
  new rxjs.Observable((observer) => {
    const mutation = new MutationObserver((mutations) =>
      observer.next(mutations)
    );
    mutation.observe(target, config);

    const unsubscribe = () => mutation.disconnect();
    return unsubscribe;
  });

toArray = (arrayLike) => Array.apply(null, arrayLike);

// general method

const updateAnimeHistory = ({
  userId,
  id,
  time,
  title,
  pictureUrl,
  episode,
}) => {
  log("New History", { id, time, title, pictureUrl, episode });

  const histories =
    animeHistory[userId]?.filter((anime) => anime.title !== title) || [];

  const newHistories = [...histories, { id, time, title, pictureUrl, episode }];

  animeHistory = { ...animeHistory, [userId]: newHistories };
  GM_setValue("animeHistory", JSON.stringify(animeHistory));

  log("Updated History", animeHistory);
};

/// -- In Video Page
let lastEpisode = 0;

const isInVideoPage$ = rxjs
  .of(new URL(document.URL))
  .pipe(rxjs.map(fp.get("pathname")), rxjs.filter(fp.eq("/animeVideo.php")));

const updateCurrentEpisodeButtonStyle = (button) => {
  // button.style.color = "var(--anime-tertiary-color)";
  log("updateCurrentEpisodeButtonStyle", button.parentElement.classList.value);
  button.parentElement.classList.add("saw");
  log("updateCurrentEpisodeButtonStyle", button.parentElement.classList.value);
  lastEpisode = button.innerHTML;
};
const removeLastEpisodeButtonStyle = (button) => {
  log("removeLastEpisodeButtonStyle", button.parentElement.classList);
  button.parentElement.classList.remove("saw");
  // button.style.color = "";
};
const getEpisodeButton = (episode) =>
  rxjs
    .from(document.querySelectorAll(".season a"))
    .pipe(rxjs.filter((e) => e.innerHTML === episode));
isInVideoPage$
  .pipe(
    // rxjs.tap((e) => log("1", e)),
    rxjs.map(() => document.getElementsByClassName("user-id")[0]?.innerHTML),
    rxjs.map((userId) => animeHistory[userId]),
    rxjs.filter(fp.negate(fp.isNil)),
    rxjs.switchMap((histories) => rxjs.from(histories)),
    rxjs.filter(
      fp.pipe(
        fp.get("title"),
        fp.eq(document.querySelector("img.data-img")?.alt) // TODO: refactor this to lazy load
      )
    ),
    rxjs.map(fp.get("episode")),
    rxjs.filter(fp.lt(0)),
    rxjs.delay(1000),
    rxjs.switchMap(getEpisodeButton)
  )
  .subscribe(updateCurrentEpisodeButtonStyle);

const updateEpisode = (episode) =>
  getEpisodeButton(lastEpisode)
    .pipe(
      rxjs.tap(removeLastEpisodeButtonStyle),
      rxjs.switchMap(() => getEpisodeButton(episode))
    )
    .subscribe(updateCurrentEpisodeButtonStyle);

const mutation$ = isInVideoPage$.pipe(
  rxjs.map(() => document.getElementById("ani_video")),
  rxjs.switchMap(observeOnMutation({ childList: true })),
  rxjs.switchMap((e) => rxjs.from(e))
);

mutation$
  .pipe(
    rxjs.map(fp.get("addedNodes")),
    rxjs.map(toArray),
    rxjs.switchMap((e) => rxjs.from(e)),
    rxjs.filter((node) => node.classList.value.includes("R18")),
    rxjs.map(() => document.getElementById("adult")),
    rxjs.switchMap((element) => rxjs.fromEvent(element, "click"))
  )
  .subscribe(() => {
    const userId = document.getElementsByClassName("user-id")[0].innerHTML;
    const id = new URL(document.URL).searchParams.get("sn");
    const time = new Date().getTime();
    const img = document.querySelector("img.data-img");
    const title = img.alt;
    const pictureUrl = img.src;
    const episode = document.querySelector(".playing a").innerHTML;
    updateAnimeHistory({ userId, id, time, title, pictureUrl, episode });
    updateEpisode(episode);
  });

// -- In Home Page
const isInHomePage$ = rxjs
  .of(new URL(document.URL))
  .pipe(rxjs.map(fp.get("pathname")), rxjs.filter(fp.eq("/")));

const AnimeCard = ({ id, title, pictureUrl, episode }) => {
  return (
    <div
      class="continue-watch-container slick-slide slick-active"
      data-video-sn={id}
      data-slick-index="3"
      aria-hidden="false"
      style="width: 254px"
      tabindex="-1"
      role="option"
      aria-describedby="slick-slide13"
    >
      <div class="continue-watch-card">
        <a
          class="img-block"
          href={'animeVideo.php?sn=' + id}
          data-gtm-category="首頁"
          data-gtm-event="點擊繼續觀看卡片"
          tabindex="0"
        >
          <div style="pointer-events: none">
            <div
              class="img-bg-blur-bg"
              style={{ 'background-image': url(${pictureUrl}) }}
            ></div>
            <img
              class="card-img lazyloaded"
              src={pictureUrl}
              data-src={pictureUrl}
              alt={title}
            />
            <div class="line-gradient"></div>
            <i
              class="btn-delete material-icons-round"
              data-gtm-category="首頁"
              data-gtm-event="點擊移除繼續觀看卡片"
              style="pointer-events: auto"
            >close</i>
            <div class="img-progress-block">
              <div class="info-row">
                <div class="episode-block">
                  <img
                    src="https://i2.bahamut.com.tw/anime/pic-tv.svg"
                    alt="pic-tv"
                  />
                  <p class="episode-watched">第{episode}集</p>
                </div>
                <p class="time-left">剩餘 - 分</p>
              </div>
              <div class="progress-bar">
                <div class="progress" style="width: 95.652173913043%"></div>
              </div>
            </div>
          </div>
        </a>
        <div class="content-block">
          <div class="content">
            <a
              class="anime-name"
              href="animeVideo.php?sn=39290"
              data-gtm-category="首頁"
              data-gtm-event="點擊繼續觀看卡片"
              tabindex="0"
            >
              <p class="anime-name_always-show">{title}</p>
              <p class="anime-name_for-marquee">{title}</p>
            </a>
          </div>
        </div>
      </div >
    </div >
  );
};
const HomePageContainer = ({ histories }) => {
  const historiesDOM = histories.map(({ id, title, pictureUrl, episode }) => (
    <AnimeCard
      id={id}
      title={title}
      pictureUrl={pictureUrl}
      episode={episode}
    />
  ));
  return (
    <div id="watched-anime" class="continue-watch-area">
      <div class="theme-title-block">
        <div class="watch-more-block">
          <h1 class="theme-title">歷史紀錄</h1>
        </div>
      </div>
      <div
        id="continue-watch"
        class="continue-watch-list slick-initialized slick-slider"
      >
        <div aria-live="polite" class="slick-list draggable">
          <div
            class="slick-track"
            style="opacity: 1; width: 1080px; transform: translate3d(0px, 0px, 0px)"
            role="listbox"
          >{historiesDOM}</div>
        </div>
      </div>
    </div>
  )
}
isInHomePage$.pipe(
  rxjs.map(() => document.getElementsByClassName("user-id")[0]?.innerHTML),
  rxjs.filter(fp.negate(fp.isNil)),
  rxjs.map((userId) => animeHistory[userId]),
  rxjs.filter(fp.negate(fp.isNil)),
).subscribe((histories) => {
  const app = document.getElementById('blockContinueWatch') ?? document.getElementById('blockVideoInSeason');
  const container = document.createElement('div');
  app?.after(container);
  const root = ReactDOM.createRoot(container);
  root.render(<MyApp histories={histories} />);
})
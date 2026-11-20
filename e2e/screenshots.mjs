// 產生作品集用的截圖（docs/screenshots/）：1280 × 800、16:10。
// 在動畫瘋的真實頁面上跑 build 出來的 userscript，資料全部是示範資料。
// 用法：npm run build && npm run screenshots
import { chromium } from 'playwright'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const DIST = new URL('../dist/ani-gamer-history.user.js', import.meta.url)
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname

const VIEWPORT = { width: 1280, height: 800 }
// 示範用的使用者 id，不使用真實帳號
const DEMO_USER = 'demo'
const now = Date.UTC(2026, 9, 18, 21, 30)

const userscript = await readFile(DIST, 'utf8')
const requires = [...userscript.matchAll(/^\/\/ @require\s+(\S+)$/gm)].map((match) => match[1])
const libs = await Promise.all(requires.map(async (url) => {
  const response = await fetch(url)
  assert.equal(response.status, 200, url)
  return await response.text()
}))

// 腳本只會用到 GM storage，其餘 API 給最小替身；雲端同步在截圖時不會真的連線
const gmStubs = (initial) => {
  const values = new Map(Object.entries(initial))
  window.__seed = (key, value) => values.set(key, value)
  window.GM_getValue = (key, defaultValue) => values.has(key) ? values.get(key) : defaultValue
  window.GM_setValue = (key, value) => values.set(key, value)
  window.GM_deleteValue = (key) => values.delete(key)
  window.GM_addValueChangeListener = () => '1'
  window.GM_registerMenuCommand = () => 'menu'
  window.GM_unregisterMenuCommand = () => {}
  window.GM_setClipboard = () => {}
  window.GM_notification = () => {}
  window.GM_addStyle = (css) => {
    const style = document.createElement('style')
    style.textContent = css
    ;(document.head ?? document.documentElement).append(style)
    return style
  }
  // 最小的假雲端：讓自動同步真的跑完一次，狀態才會停在「已同步」而不是一直轉
  window.GM_xmlhttpRequest = (details) => {
    const reply = (status, body) => setTimeout(() => details.onload?.({ status, responseText: JSON.stringify(body), response: JSON.stringify(body) }), 60)
    if (details.method === 'PUT') return reply(201, { content: { sha: 'demo' } })
    if (details.url.includes('/contents/')) return reply(404, { message: 'Not Found' })
    return reply(200, { full_name: 'demo/anime-history', private: true })
  }
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: VIEWPORT, locale: 'zh-TW', timezoneId: 'Asia/Taipei', deviceScaleFactor: 1 })

// 廣告與分析會蓋住版面，而且和這個腳本無關
const BLOCKED = /doubleclick|googlesyndication|google-analytics|googletagmanager|adservice|facebook|scorecardresearch/
await context.route('**/*', async (route) => {
  const url = route.request().url()
  if (BLOCKED.test(url)) return await route.abort()
  return await route.continue()
})

const openPage = async (url, seed = {}, beforeScript) => {
  const page = await context.newPage()
  await page.addInitScript(gmStubs, {})
  page.on('pageerror', (error) => console.error('  page error:', error.message))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  // 先放進示範資料，再注入腳本（腳本載入時就會讀取 GM storage）
  await page.evaluate(([entries, user]) => {
    entries.forEach(([key, value]) => window.__seed(key, value))
    document.querySelectorAll('.user-id').forEach((node) => { node.textContent = user })
  }, [Object.entries(seed), DEMO_USER])
  if (beforeScript !== undefined) await page.evaluate(beforeScript)
  for (const lib of libs) await page.addScriptTag({ content: lib })
  await page.addScriptTag({ content: userscript })
  return page
}

// 站方固定在畫面邊緣的公告列、浮動按鈕，以及被擋掉的廣告留下的空白都會干擾截圖
const hideOverlays = async (page) => await page.evaluate(() => {
  document.querySelectorAll('iframe, ins, .anime-ad, [id^="div-gpt"], [id*="ad_"], [class*="ad-slot"]').forEach((element) => element.remove())
  document.querySelectorAll('body *').forEach((element) => {
    const style = window.getComputedStyle(element)
    if (style.position !== 'fixed' && style.position !== 'sticky') return
    const box = element.getBoundingClientRect()
    if (box.height > 0 && box.width > 0) element.style.display = 'none'
  })
})

// 截圖規範限制單張 1 MB 以下；PNG 太大時改存 WebP（規範允許的另一種格式）
const MAX_BYTES = 1024 * 1024

const toWebp = async (png) => {
  const page = await context.newPage()
  await page.goto('about:blank')
  const dataUrl = await page.evaluate(async (base64) => {
    const image = new window.Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    canvas.getContext('2d').drawImage(image, 0, 0)
    return canvas.toDataURL('image/webp', 0.92)
  }, png.toString('base64'))
  await page.close()
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

const snapshot = async (page, name) => {
  await page.evaluate(async () => await document.fonts.ready)
  await page.waitForTimeout(500)
  const png = await page.screenshot()
  const webp = png.length > MAX_BYTES ? await toWebp(png) : null
  const extension = webp !== null && webp.length < png.length ? 'webp' : 'png'
  await writeFile(`${OUT}${name}.${extension}`, extension === 'webp' ? webp : png)
  // 換格式時清掉上一次產生的另一種副檔名
  await rm(`${OUT}${name}.${extension === 'webp' ? 'png' : 'webp'}`, { force: true })
  console.log(`  ${name}.${extension}（${(((extension === 'webp' ? webp : png).length) / 1024).toFixed(0)} KB）`)
}

const history = (records) => JSON.stringify({
  app: 'ani-gamer-history',
  dataVersion: '2.0.0',
  schemaVersion: 2,
  exportedAt: now,
  history: records
})

try {
  await mkdir(OUT, { recursive: true })

  // ---------- 從真實首頁取得示範用的動畫（標題與封面都用站上現有的新番） ----------
  const probe = await context.newPage()
  await probe.goto('https://ani.gamer.com.tw/', { waitUntil: 'domcontentloaded' })
  const samples = await probe.evaluate(() => [...document.querySelectorAll('.anime-card-block')]
    .map((card) => {
      // 本季新番卡片：.anime-name 是動畫名稱，.anime-episode 之類的集數不要當成標題
      const title = card.querySelector('.anime-name')?.textContent?.trim() ?? ''
      // 卡片裡第一張圖是時鐘圖示，封面要用圖庫網域上的那張
      const image = card.querySelector('img[data-src*="p2.bahamut.com.tw"], img[src*="p2.bahamut.com.tw"]')
      const src = image?.getAttribute('data-src') ?? image?.getAttribute('src') ?? ''
      const sn = new URL(card.href, window.location.origin).searchParams.get('sn')
      return { sn, title, animePicUrl: src.startsWith('//') ? `https:${src}` : src }
    })
    .filter((item) => !/^第\s*\d+\s*集$/.test(item.title))
    .filter((item) => item.title !== '' && item.animePicUrl !== '' && item.sn !== null)
    .filter((item, index, list) => list.findIndex((other) => other.title === item.title) === index)
    .slice(0, 11))
  await probe.close()
  assert.ok(samples.length >= 6, `動畫瘋首頁只取到 ${samples.length} 部動畫，無法產生示範資料`)
  console.log(`取得 ${samples.length} 部示範動畫：${samples.map((item) => item.title).join('、')}`)

  const watched = samples.map((item, index) => ({
    source: 'ani-gamer',
    id: item.sn,
    title: item.title,
    timestamp: now - index * 36e5,
    episode: String(((index * 3) % 11) + 2),
    episodePicUrl: item.animePicUrl,
    animePicUrl: item.animePicUrl,
    videoWatchTime: 300 + index * 120,
    videoTotalTime: 1420,
    ...(index === 1 ? { isFavorite: true, favoriteTime: now } : {}),
    // 其中一筆寫了備註，卡片上才看得到備註圖示
    ...(index === 2 ? { note: '第 8 集的對決很精彩，之後要重看一次', noteTime: now } : {})
  }))
  const demoHistory = history({ [DEMO_USER]: watched })
  const demoSeed = {
    history: demoHistory,
    syncSettings: { adapterId: 'github-repo', autoSync: true, adapters: { 'github-repo': { token: 'demo', repository: 'demo/anime-history' } } },
    syncStatus: { lastSyncAt: now, ok: true, message: '雲端已是最新' }
  }

  // ---------- 01 首頁的本機歷史紀錄（封面） ----------
  const home = await openPage('https://ani.gamer.com.tw/', demoSeed)
  await home.locator('#watched-anime .continue-watch-card').first().waitFor()
  await hideOverlays(home)
  await home.evaluate(() => {
    const block = document.querySelector('#watched-anime')
    window.scrollTo({ top: block.getBoundingClientRect().top + window.scrollY - 12 })
  })
  await snapshot(home, '01-home-history')

  // ---------- 02 同步設定 ----------
  await home.locator('.agh-gear').click()
  const dialog = home.locator('dialog.agh-dialog[open]')
  await dialog.waitFor()
  await snapshot(home, '02-settings-sync')

  // ---------- 03 功能頁（顯示開關） ----------
  await dialog.locator('.agh-nav-item', { hasText: '功能' }).click()
  await snapshot(home, '03-settings-features')
  await home.close()

  // ---------- 04 影片頁分集清單上的書籤 ----------
  const [first] = samples
  const video = await openPage(`https://ani.gamer.com.tw/animeVideo.php?sn=${first.sn}`, demoSeed)
  const bookmark = video.locator('.season .agh-bookmark')
  await bookmark.waitFor({ timeout: 15000 }).catch(() => console.error('  影片頁沒有出現書籤，請確認示範紀錄的集數存在'))
  await hideOverlays(video)
  // 播放器不會真的播放，把載入中的動畫藏起來，畫面才不會像壞掉
  await video.evaluate(() => {
    document.querySelectorAll('.vjs-loading-spinner, .vjs-text-track-display, [class*="loading"]').forEach((element) => { element.style.display = 'none' })
  })
  await video.evaluate(() => {
    // 播放器與「選集」一起入鏡：書籤在清單上，上方是實際的影片頁
    const season = document.querySelector('.season')
    const bottom = season.getBoundingClientRect().bottom + window.scrollY
    window.scrollTo({ top: Math.max(bottom - 760, 0) })
  })
  await snapshot(video, '04-episode-bookmark')
  await video.close()

  await writeFile(`${OUT}captions.json`, `${JSON.stringify({
    '01-home-history': { 'zh-TW': '動畫瘋首頁下方的本機歷史紀錄，依時間排序並可加入最愛', en: 'Local watch history added below the Bahamut Anime home page, sorted by time with favorites pinned' },
    '02-settings-sync': { 'zh-TW': '同步設定：透過 GitHub Private Repository 在多台電腦之間同步', en: 'Sync settings: keep the history in sync across computers through a private GitHub repository' },
    '03-settings-features': { 'zh-TW': '功能設定：可以關閉分集清單上的上次觀看標記', en: 'Feature settings: the last-watched markers can be turned off per site' },
    '04-episode-bookmark': { 'zh-TW': '分集清單上的書籤標出本機紀錄看到的那一集', en: 'A bookmark on the episode list marks the episode kept in the local history' }
  }, null, 2)}\n`, 'utf8')
  console.log('  captions.json')
  console.log('完成')
} catch (error) {
  console.error('FAILED', error)
  process.exitCode = 1
} finally {
  await browser.close()
}

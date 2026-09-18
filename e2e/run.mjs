// 端對端測試：兩台「電腦」（兩個 browser context，各自的 GM storage）+ 假的 GitHub Contents API
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

// 先執行 npm run build，測試的是實際發佈的 userscript
const DIST = new URL('../dist/ani-gamer-history.user.js', import.meta.url)
const OUT = new URL('./out/', import.meta.url).pathname
await mkdir(OUT, { recursive: true })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const stripScripts = (html) => html.replace(/<script\b[\s\S]*?<\/script>/gi, '')
const anime1Post = stripScripts(await readFile(new URL('./fixtures/anime1/post.html', import.meta.url), 'utf8'))
const anime1Category = stripScripts(await readFile(new URL('./fixtures/anime1/category.html', import.meta.url), 'utf8'))
const userscript = await readFile(DIST, 'utf8')
const requires = [...userscript.matchAll(/^\/\/ @require\s+(\S+)$/gm)].map((match) => match[1])
const libs = await Promise.all(requires.map(async (url) => {
  const response = await fetch(url)
  assert.equal(response.status, 200, url)
  return await response.text()
}))

// ---------- 假的 GitHub ----------
const REMOTE_KEY = 'me/data:ani-gamer-history.json'
const github = { files: new Map(), commits: [], responses: [], beforePut: null }
const encode = (text) => Buffer.from(text, 'utf8').toString('base64').replace(/.{60}/g, '$&\n')
const decode = (base64) => Buffer.from(base64.replace(/\s/g, ''), 'base64').toString('utf8')
const startedAt = Date.now()
const timeline = []
const reply = (method, url, status, body) => {
  github.responses.push({ method, url, status })
  timeline.push(`${((Date.now() - startedAt) / 1000).toFixed(1)}s ${method} ${status}`)
  return { status, text: JSON.stringify(body) }
}

const fakeGithub = async ({ method, url, headers, data }) => {
  if (headers?.Authorization !== 'Bearer good-token') return reply(method, url, 401, { message: 'Bad credentials' })
  const { pathname } = new URL(url)
  const repo = pathname.match(/^\/repos\/([^/]+\/[^/]+)$/)
  if (repo !== null && method === 'GET') return reply(method, url, 200, { full_name: repo[1], private: true })
  const contents = pathname.match(/^\/repos\/([^/]+\/[^/]+)\/contents\/(.+)$/)
  if (contents === null) return reply(method, url, 404, { message: 'Not Found' })
  const key = `${contents[1]}:${decodeURIComponent(contents[2])}`
  if (method === 'GET') {
    const file = github.files.get(key)
    if (file === undefined) return reply(method, url, 404, { message: 'Not Found' })
    return reply(method, url, 200, { type: 'file', sha: file.sha, encoding: 'base64', content: encode(file.text) })
  }
  if (method === 'PUT') {
    if (github.beforePut !== null) {
      const hook = github.beforePut
      github.beforePut = null
      hook(key)
    }
    const body = JSON.parse(data)
    const file = github.files.get(key)
    if (file !== undefined && body.sha === undefined) return reply(method, url, 422, { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' })
    if (file !== undefined && body.sha !== file.sha) return reply(method, url, 409, { message: `is at ${file.sha} but expected ${body.sha}` })
    const next = { sha: randomUUID(), text: decode(body.content) }
    timeline.push(`${((Date.now() - startedAt) / 1000).toFixed(1)}s PUT內容 ${Object.entries(JSON.parse(next.text).history).map(([k, v]) => `${k}:[${v.map((i) => i.title).join('|')}]`).join(' ')}`)
    github.files.set(key, next)
    github.commits.push({ key, message: body.message, snapshot: JSON.parse(next.text) })
    return reply(method, url, file === undefined ? 201 : 200, { content: { sha: next.sha } })
  }
  return reply(method, url, 405, {})
}
const remoteSnapshot = () => {
  const file = github.files.get(REMOTE_KEY)
  return file === undefined ? null : JSON.parse(file.text)
}
const remoteList = () => remoteSnapshot()?.history.tester ?? []
const remoteTitles = () => remoteList().filter((a) => !(a.removeTime >= a.timestamp)).map((a) => a.title)

// ---------- Tampermonkey API 替身 ----------
// GM storage 是「同一個腳本跨網站共用」，不是按網域隔離，所以這裡用 Node 端的
// 每台機器一份資料，再透過 __gmWrite 同步到該機器的其他分頁（模擬跨分頁通知）
const gmStubs = (initial) => {
  const values = new Map(Object.entries(initial))
  const listeners = []
  window.__gmApply = (key, value, remote) => {
    const oldValue = values.get(key)
    values.set(key, value)
    listeners.filter((l) => l.key === key).forEach((l) => l.callback(key, oldValue, value, remote))
  }
  window.GM_getValue = (key, defaultValue) => values.has(key) ? values.get(key) : defaultValue
  window.GM_setValue = (key, value) => {
    window.__gmApply(key, value, false)
    window.__gmWrite(key, value).catch((error) => console.error(error))
  }
  window.GM_deleteValue = (key) => {
    values.delete(key)
    window.__gmWrite(key, undefined).catch((error) => console.error(error))
  }
  window.GM_addValueChangeListener = (key, callback) => {
    listeners.push({ key, callback })
    return String(listeners.length)
  }
  let menuId = 0
  window.__menu = []
  window.GM_registerMenuCommand = (caption, onClick) => {
    const id = `menu-${++menuId}`
    window.__menu.push({ id, caption, onClick })
    return id
  }
  window.GM_unregisterMenuCommand = (id) => { window.__menu = window.__menu.filter((item) => item.id !== id) }
  window.__clipboard = ''
  window.GM_setClipboard = (data) => { window.__clipboard = data }
  window.__setClipboardRead = (text) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: async () => text === null ? Promise.reject(new Error('denied')) : text }
    })
  }
  window.__setClipboardRead(null)
  window.__notifications = []
  window.GM_notification = (details) => { window.__notifications.push(details.text) }
  window.GM_addStyle = (css) => {
    const style = document.createElement('style')
    style.textContent = css
    ;(document.head ?? document.documentElement).append(style)
    return style
  }
  window.GM_xmlhttpRequest = (details) => {
    window.__fakeGithub({ method: details.method, url: details.url, headers: details.headers, data: details.data })
      .then((response) => details.onload?.({ status: response.status, responseText: response.text, response: response.text }))
      .catch((error) => details.onerror?.(error))
  }
}

// ---------- 假的動畫瘋頁面 ----------
const page = (body) => `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>ani</title></head><body style="font-family: sans-serif; background:#f0f2f5">${body}</body></html>`
const homeHtml = (loggedIn = true) => page(`
  ${loggedIn ? '<div class="user-id" style="display:none">tester</div>' : ''}
  <div id="blockContinueWatch"><h2>繼續觀看（巴哈原生區塊）</h2></div>`)
const videoHtml = (title) => page(`
  <div class="user-id" style="display:none">tester</div>
  <img class="data-img" alt="${title}" src="https://ani.gamer.com.tw/episode.jpg">
  <div id="video-container" data-video-poster="https://ani.gamer.com.tw/poster.jpg"></div>
  <div class="season"><ul><li class="playing"><a href="#">1</a></li><li><a href="#">2</a></li></ul></div>
  <video id="ani_video_html5_api"></video>
  <button id="adult">同意</button>`)

const pageErrors = []
const browser = await chromium.launch()

const newMachine = async (name) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, locale: 'zh-TW', timezoneId: 'Asia/Taipei' })
  context.machineName = name
  context.gmValues = new Map()
  context.gmPages = new Set()
  await context.exposeFunction('__fakeGithub', fakeGithub)
  await context.exposeBinding('__gmWrite', async ({ page: source }, key, value) => {
    if (value === undefined) context.gmValues.delete(key)
    else context.gmValues.set(key, value)
    for (const other of context.gmPages) {
      if (other === source || other.isClosed()) continue
      await other.evaluate(([k, v]) => { window.__gmApply(k, v, true) }, [key, value]).catch(() => {})
    }
  })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.host === 'anime1.me') {
      // 用實際抓下來的 anime1 頁面
      const body = url.pathname.startsWith('/category') ? anime1Category : anime1Post
      return await route.fulfill({ contentType: 'text/html', body })
    }
    if (url.host !== 'ani.gamer.com.tw') return await route.abort()
    if (url.pathname === '/') return await route.fulfill({ contentType: 'text/html', body: homeHtml(url.searchParams.get('guest') === null) })
    if (url.pathname === '/animeVideo.php') return await route.fulfill({ contentType: 'text/html', body: videoHtml(url.searchParams.get('title')) })
    return await route.abort()
  })
  return context
}

const openPage = async (context, path, beforeScript, origin = 'https://ani.gamer.com.tw') => {
  const tab = await context.newPage()
  await tab.addInitScript(gmStubs, Object.fromEntries(context.gmValues))
  context.gmPages.add(tab)
  tab.on('close', () => context.gmPages.delete(tab))
  tab.on('pageerror', (error) => pageErrors.push(`${context.machineName}: ${error.message}`))
  tab.on('console', (msg) => { if (msg.text().startsWith('[agh-debug]')) console.log(`      ${context.machineName}/${new URL(tab.url()).pathname} ${msg.text()}`) })
  tab.on('dialog', (dialog) => { dialog.accept().catch(() => {}) })
  await tab.goto(`${origin}${path}`)
  if (beforeScript !== undefined) await tab.evaluate(beforeScript)
  for (const lib of libs) await tab.addScriptTag({ content: lib })
  await tab.addScriptTag({ content: userscript })
  return tab
}

const waitFor = async (predicate, message, timeout = 10000) => {
  const start = Date.now()
  for (;;) {
    const value = await predicate()
    if (value) return value
    if (Date.now() - start > timeout) throw new Error(`Timed out: ${message}`)
    await sleep(100)
  }
}
const cards = async (tab) => await tab.locator('#watched-anime .anime-name').allTextContents()
const card = (tab, title) => tab.locator('#watched-anime .continue-watch-card', { has: tab.locator('.anime-name', { hasText: title }) })
const menuCaptions = async (tab) => await tab.evaluate(() => window.__menu.map((item) => item.caption))
const runMenu = async (tab, caption) => await tab.evaluate((c) => { window.__menu.find((item) => item.caption === c).onClick() }, caption)
const dialogOf = (tab) => tab.locator('dialog.agh-dialog[open]')
const field = (dialog, label) => dialog.locator('.agh-field', { has: dialog.page().locator('.agh-field-label', { hasText: label }) }).locator('input')
const expectMessage = async (dialog, text) => await dialog.locator('.agh-message', { hasText: text }).waitFor({ timeout: 10000 })
// 本機只存一份資料，格式和雲端檔案相同（含資料版本）
const HISTORY_KEY = 'history'
const localSnapshot = async (tab) => JSON.parse(await tab.evaluate((key) => window.GM_getValue(key, 'null'), HISTORY_KEY))
const localHistory = async (tab) => (await localSnapshot(tab))?.history ?? {}
// 模擬另一個分頁（例如已更新的腳本）寫入 GM storage：這台機器的所有分頁都會收到通知
const externalWrite = async (context, key, value) => {
  context.gmValues.set(key, value)
  for (const tab of context.gmPages) {
    if (!tab.isClosed()) await tab.evaluate(([k, v]) => { window.__gmApply(k, v, true) }, [key, value]).catch(() => {})
  }
}

let stepNo = 0
const step = async (name, fn) => {
  stepNo++
  timeline.push(`--- 步驟 ${stepNo}：${name}`)
  process.stdout.write(`${String(stepNo).padStart(2)}. ${name} … `)
  await fn()
  console.log('ok')
}

const now = Date.now()
const legacyHistory = (seedNow) => {
  const legacy = {
    tester: [
      { id: '101', timestamp: seedNow - 5000, title: '葬送的芙莉蓮', episodePicUrl: '', animePicUrl: '', episode: '3', videoWatchTime: 100, videoTotalTime: 1400, isFavorite: false },
      { id: '202', timestamp: seedNow - 10000, title: '藥師少女的獨語', episodePicUrl: '', animePicUrl: '', episode: '5', videoWatchTime: 0, videoTotalTime: 1400 }
    ]
  }
  return JSON.stringify(legacy)
}

let aHome, bHome, aVideo
try {
  const A = await newMachine('A')
  const B = await newMachine('B')

  await step('A 首頁：舊資料（含 isFavorite:false）正常顯示、有齒輪、選單 4 項、未設定時不發請求', async () => {
    A.gmValues.set('animeHistory', legacyHistory(now))
    aHome = await openPage(A, '/')
    await waitFor(async () => (await cards(aHome)).length === 2, 'A shows 2 cards')
    assert.deepEqual(await cards(aHome), ['葬送的芙莉蓮', '藥師少女的獨語'])
    assert.equal(await aHome.locator('.agh-gear').count(), 1)
    assert.equal(await aHome.locator('.agh-sync-indicator').count(), 0)
    assert.deepEqual(await menuCaptions(aHome), ['⚙ 開啟同步設定', '↻ 立即同步', '⏸ 暫停自動同步', '⧉ 複製同步設定', '⤓ 匯出 JSON'])
    await sleep(500)
    assert.equal(github.responses.length, 0)
    // 舊欄位升級後寫進新欄位（含資料版本），再刪掉舊欄位
    assert.deepEqual((await localHistory(aHome)).tester.map((a) => a.title), ['葬送的芙莉蓮', '藥師少女的獨語'])
    assert.equal((await localSnapshot(aHome)).dataVersion, '2.0.0')
    await waitFor(() => !A.gmValues.has('animeHistory'), '舊欄位已刪除')
  })

  await step('A 齒輪開 dialog：左側導覽 4 頁；Token 錯誤時不會儲存也不會寫入雲端', async () => {
    await aHome.locator('.agh-gear').click()
    const dialog = dialogOf(aHome)
    await dialog.waitFor()
    assert.deepEqual(await dialog.locator('.agh-nav-item').allTextContents(), ['同步狀態', '雲端平台', '功能', '備份'])
    // 還沒有其他網站的紀錄：只有動畫瘋的標記開關，不出現「首頁清單」
    await dialog.locator('.agh-nav-item', { hasText: '功能' }).click()
    assert.deepEqual(await dialog.locator('.agh-section-title').allTextContents(), ['上次觀看標記'])
    assert.deepEqual(await dialog.locator('.agh-summary dt').allTextContents(), ['動畫瘋'])
    await dialog.locator('.agh-nav-item', { hasText: '同步狀態' }).click()
    await aHome.screenshot({ path: `${OUT}01-status-unconfigured.png` })
    await dialog.getByRole('button', { name: '前往設定' }).click()
    assert.equal(await dialog.locator('.agh-title').textContent(), '雲端平台')
    assert.equal(await dialog.getByRole('button', { name: '儲存並同步' }).isDisabled(), true)
    await field(dialog, 'Token').fill('bad-token')
    await field(dialog, 'Repository').fill('me/data')
    await dialog.getByRole('button', { name: '儲存並同步' }).click()
    await expectMessage(dialog, '尚未儲存')
    await expectMessage(dialog, 'Token 無效')
    assert.equal(github.commits.length, 0, 'Token 錯誤時不該寫入雲端')
    await field(dialog, 'Token').fill('good-token')
    await aHome.screenshot({ path: `${OUT}02-cloud-tested.png` })
  })

  await step('A 儲存並同步：建立雲端檔案（1 個 commit），首頁顯示同步狀態，Esc 關閉 dialog', async () => {
    const dialog = dialogOf(aHome)
    await dialog.getByRole('button', { name: '儲存並同步' }).click()
    await expectMessage(dialog, '已儲存並完成同步')
    assert.equal(github.commits.length, 1)
    assert.deepEqual(remoteTitles(), ['葬送的芙莉蓮', '藥師少女的獨語'])
    await dialog.locator('.agh-nav-item', { hasText: '同步狀態' }).click()
    await aHome.screenshot({ path: `${OUT}03-status-synced.png` })
    await aHome.keyboard.press('Escape')
    await aHome.locator('dialog.agh-dialog').waitFor({ state: 'detached' })
    await aHome.locator('.agh-sync-indicator', { hasText: '已同步' }).waitFor()
  })

  await step('B 新電腦：沒有紀錄也顯示區塊；從選單開設定，儲存後拉到 A 的紀錄且不產生 commit', async () => {
    bHome = await openPage(B, '/')
    await bHome.locator('.agh-empty', { hasText: '尚無紀錄' }).waitFor()
    await runMenu(bHome, '⚙ 開啟同步設定')
    const dialog = dialogOf(bHome)
    await dialog.waitFor()
    await dialog.locator('.agh-nav-item', { hasText: '雲端平台' }).click()
    await field(dialog, 'Token').fill('good-token')
    await field(dialog, 'Repository').fill('me/data')
    await dialog.getByRole('button', { name: '儲存並同步' }).click()
    await expectMessage(dialog, '雲端已是最新')
    await waitFor(async () => (await cards(bHome)).length === 2, 'B pulled 2 cards')
    assert.equal(github.commits.length, 1)
    await bHome.keyboard.press('Escape')
  })

  await step('B 切換最愛 + 刪除：2 秒後只推送一次，雲端反映兩個變更', async () => {
    await card(bHome, '藥師少女的獨語').locator('.btn-favorite').dispatchEvent('click')
    await card(bHome, '葬送的芙莉蓮').locator('.btn-delete').dispatchEvent('click')
    await waitFor(async () => (await cards(bHome)).join() === '藥師少女的獨語', 'B list updated')
    await sleep(500)
    assert.equal(github.commits.length, 1, '不應立即推送')
    await waitFor(() => github.commits.length === 2, 'B pushed', 8000)
    await sleep(2500)
    assert.equal(github.commits.length, 2, '連續操作只推送一次')
    const remote = remoteList()
    assert.equal(remote.find((a) => a.title === '藥師少女的獨語').isFavorite, true)
    assert.ok(remote.find((a) => a.title === '葬送的芙莉蓮').removeTime >= remote.find((a) => a.title === '葬送的芙莉蓮').timestamp)
  })

  await step('A 重開首頁：顯示時拉取，看到 B 的變更，內容相同不推送', async () => {
    await aHome.close()
    aHome = await openPage(A, '/')
    await waitFor(async () => (await cards(aHome)).join() === '藥師少女的獨語', 'A pulled B changes')
    await sleep(800)
    assert.equal(github.commits.length, 2)
  })

  await step('A 影片頁開始看：推送一次；首頁分頁即時出現新卡片；播放中每秒進度不推送', async () => {
    aVideo = await openPage(A, `/animeVideo.php?sn=303&title=${encodeURIComponent('膽大黨')}`, () => {
      const video = document.getElementById('ani_video_html5_api')
      Object.defineProperty(video, 'paused', { get: () => window.__paused === true, configurable: true })
    })
    await aVideo.click('#adult')
    await waitFor(async () => (await cards(aHome)).includes('膽大黨'), 'home tab got new card via cross-tab', 8000)
    await waitFor(() => remoteTitles().includes('膽大黨'), 'A pushed watch start', 8000)
    const commits = github.commits.length
    await sleep(4000)
    assert.equal(github.commits.length, commits, '進度更新不應推送')
  })

  await step('A 跨分頁：影片分頁每秒寫入時，首頁分頁的刪除不會被覆蓋', async () => {
    await card(aHome, '藥師少女的獨語').locator('.btn-delete').dispatchEvent('click')
    await sleep(3500)
    const stored = (await localHistory(aVideo)).tester.find((a) => a.title === '藥師少女的獨語')
    assert.ok(stored.removeTime >= stored.timestamp, '刪除應保留在本機儲存')
    assert.deepEqual(await cards(aHome), ['膽大黨'])
    await waitFor(() => !remoteTitles().includes('藥師少女的獨語'), 'removal pushed', 8000)
  })

  await step('選單暫停自動同步：文字與順序正確、其他分頁同步更新、暫停時不推送、手動同步仍可用', async () => {
    await runMenu(aHome, '⏸ 暫停自動同步')
    const expected = ['⚙ 開啟同步設定', '↻ 立即同步', '▶ 恢復自動同步', '⧉ 複製同步設定', '⤓ 匯出 JSON']
    await waitFor(async () => JSON.stringify(await menuCaptions(aHome)) === JSON.stringify(expected), 'menu caption updated')
    await waitFor(async () => JSON.stringify(await menuCaptions(aVideo)) === JSON.stringify(expected), 'other tab menu updated')
    await aVideo.evaluate(() => { window.__paused = true })
    const commits = github.commits.length
    await card(aHome, '膽大黨').locator('.btn-favorite').dispatchEvent('click')
    await sleep(3000)
    assert.equal(github.commits.length, commits, '暫停時不應推送')
    await runMenu(aHome, '↻ 立即同步')
    await waitFor(() => github.commits.length === commits + 1, 'manual sync pushed')
    await waitFor(async () => (await aHome.evaluate(() => window.__notifications)).some((text) => text.startsWith('同步完成')), 'notification shown')
    await runMenu(aHome, '▶ 恢復自動同步')
  })

  await step('衝突：推送前其他裝置剛寫入 → 409 → 重新合併後推送，兩邊資料都保留', async () => {
    github.beforePut = (key) => {
      const file = github.files.get(key)
      const snapshot = JSON.parse(file.text)
      snapshot.history.tester.push({ id: '404', timestamp: Date.now(), title: '來自其他裝置', episodePicUrl: '', animePicUrl: '', episode: '1', videoWatchTime: 0, videoTotalTime: 0 })
      github.files.set(key, { sha: randomUUID(), text: JSON.stringify(snapshot) })
      github.commits.push({ key, message: 'other device', snapshot })
    }
    const conflictsBefore = github.responses.filter((r) => r.status === 409).length
    await card(aHome, '膽大黨').locator('.btn-favorite').dispatchEvent('click')
    const localFavorite = (await localHistory(aHome)).tester.find((a) => a.title === '膽大黨').isFavorite
    await waitFor(() => github.responses.filter((r) => r.status === 409).length === conflictsBefore + 1, '409 happened', 8000)
    await waitFor(() => remoteTitles().includes('來自其他裝置') && remoteList().find((a) => a.title === '膽大黨').isFavorite === localFavorite, 'merged push after conflict', 8000)
    await waitFor(async () => (await cards(aHome)).includes('來自其他裝置'), 'A shows other device record')
  })

  await step('B 從選單匯出 JSON：檔名格式正確、不含 Token', async () => {
    await bHome.close()
    bHome = await openPage(B, '/')
    await waitFor(async () => (await cards(bHome)).includes('來自其他裝置'), 'B pulled latest')
    const [download] = await Promise.all([bHome.waitForEvent('download'), runMenu(bHome, '⤓ 匯出 JSON')])
    assert.match(download.suggestedFilename(), /^ani-gamer-history-\d{8}-\d{4}\.json$/)
    const text = await readFile(await download.path(), 'utf8')
    assert.ok(!text.includes('good-token'))
    const exported = JSON.parse(text)
    assert.equal(exported.app, 'ani-gamer-history')
    exported.history.tester.push({ id: '505', timestamp: Date.now(), title: '匯入的動畫', episodePicUrl: '', animePicUrl: '', episode: '2', videoWatchTime: 0, videoTotalTime: 0 })
    await writeFile(`${OUT}import.json`, JSON.stringify(exported))
  })

  await step('B dialog 備份頁匯入：合併進本機、首頁出現、之後推送到雲端', async () => {
    await bHome.locator('.agh-gear').click()
    const dialog = dialogOf(bHome)
    await dialog.locator('.agh-nav-item', { hasText: '備份' }).click()
    const [chooser] = await Promise.all([bHome.waitForEvent('filechooser'), dialog.getByRole('button', { name: '匯入 JSON' }).click()])
    await chooser.setFiles(`${OUT}import.json`)
    await expectMessage(dialog, '已匯入並與本機紀錄合併')
    await bHome.screenshot({ path: `${OUT}04-backup-imported.png` })
    await waitFor(async () => (await cards(bHome)).includes('匯入的動畫'), 'imported card shown')
    await waitFor(() => remoteTitles().includes('匯入的動畫'), 'import pushed', 8000)
  })

  let copied = ''
  await step('A 複製同步設定：剪貼簿內容有前綴、看不到 Token 與平台名稱', async () => {
    await aHome.locator('.agh-gear').click()
    const dialog = dialogOf(aHome)
    await dialog.waitFor()
    await dialog.locator('.agh-nav-item', { hasText: '雲端平台' }).click()
    await dialog.getByRole('button', { name: '複製設定' }).click()
    await expectMessage(dialog, '已複製設定到剪貼簿')
    copied = await aHome.evaluate(() => window.__clipboard)
    assert.ok(copied.startsWith('AGH1.'), copied.slice(0, 20))
    assert.ok(!copied.includes('good-token'))
    assert.ok(!copied.includes('github-repo'))
    assert.ok(!copied.includes('me/data'))
    await aHome.screenshot({ path: `${OUT}06-cloud-copy-paste.png` })
    await aHome.keyboard.press('Escape')
    await aHome.locator('dialog.agh-dialog').waitFor({ state: 'detached' })
  })

  await step('C 新電腦：剪貼簿被瀏覽器擋住時改用手動貼上，讀入後儲存即可同步', async () => {
    const C = await newMachine('C')
    const cHome = await openPage(C, '/')
    await cHome.locator('.agh-empty', { hasText: '尚無紀錄' }).waitFor()
    await cHome.locator('.agh-gear').click()
    const dialog = dialogOf(cHome)
    await dialog.waitFor()
    await dialog.locator('.agh-nav-item', { hasText: '雲端平台' }).click()
    await dialog.getByRole('button', { name: '貼上設定' }).click()
    await expectMessage(dialog, '請在下方欄位貼上設定字串')
    await dialog.locator('textarea.agh-textarea').fill(copied)
    await dialog.getByRole('button', { name: '讀入' }).click()
    await expectMessage(dialog, '已讀入設定')
    assert.equal(await field(dialog, 'Token').inputValue(), 'good-token')
    assert.equal(await field(dialog, 'Repository').inputValue(), 'me/data')
    const commits = github.commits.length
    await dialog.getByRole('button', { name: '儲存並同步' }).click()
    await expectMessage(dialog, '已儲存並完成同步')
    await cHome.keyboard.press('Escape')
    await waitFor(async () => (await cards(cHome)).includes('匯入的動畫'), 'C pulled everything')
    assert.equal(github.commits.length, commits, 'C 只是拉取，不應產生 commit')
  })

  await step('B 剪貼簿可讀時直接貼上，不需要手動輸入', async () => {
    await bHome.evaluate((text) => { window.__setClipboardRead(text) }, copied)
    // 上一步的 dialog 仍開著，直接切到雲端平台頁
    const dialog = dialogOf(bHome)
    await dialog.waitFor()
    await dialog.locator('.agh-nav-item', { hasText: '雲端平台' }).click()
    await dialog.getByRole('button', { name: '貼上設定' }).click()
    await expectMessage(dialog, '已讀入設定')
    assert.equal(await dialog.locator('textarea.agh-textarea').count(), 0, '可直接讀取時不需要顯示貼上欄位')
    assert.equal(await field(dialog, 'Token').inputValue(), 'good-token')
  })

  await step('A 在 anime1 文章頁播放：紀錄寫進不綁使用者的 bucket，並推送到雲端', async () => {
    const aAnime1 = await openPage(A, '/30152', () => {
      const video = document.querySelector('video')
      Object.defineProperty(video, 'paused', { get: () => window.__playing !== true, configurable: true })
      Object.defineProperty(video, 'currentTime', { get: () => 125, configurable: true })
      window.__playing = true
    }, 'https://anime1.me')
    const commits = github.commits.length
    await waitFor(async () => {
      const history = await localHistory(aAnime1)
      return history['@shared']?.some((item) => item.title === 'LIAR GAME 詐欺遊戲')
    }, 'anime1 紀錄寫入本機', 8000)
    const record = (await localHistory(aAnime1))['@shared'][0]
    assert.equal(record.source, 'anime1')
    assert.equal(record.seriesId, '1898')
    assert.equal(record.episode, '24')
    assert.equal(record.id, '30152')
    await waitFor(() => github.commits.length > commits, 'anime1 紀錄推送到雲端', 10000)
    assert.ok(remoteSnapshot().history['@shared'].some((item) => item.source === 'anime1'))
    await aAnime1.close()
  })

  await step('動畫瘋首頁未登入時也看得到 anime1 的紀錄（含來源徽章與連結）', async () => {
    const guest = await openPage(A, '/?guest=1')
    await waitFor(async () => (await cards(guest)).includes('LIAR GAME 詐欺遊戲'), '未登入也顯示 anime1 卡片')
    assert.deepEqual(await cards(guest), ['LIAR GAME 詐欺遊戲'], '未登入不應顯示綁定使用者的紀錄')
    const card = guest.locator('#watched-anime .continue-watch-card').first()
    assert.equal(await card.locator('.agh-source-badge').textContent(), 'anime1')
    assert.equal(await card.locator('.agh-placeholder span').textContent(), 'LIAR GAME 詐欺遊戲')
    assert.equal(await card.locator('.content-block').getAttribute('href'), 'https://anime1.me/30152')
    await guest.close()
  })

  await step('B 同步後，anime1 系列頁出現上次觀看標記', async () => {
    const bAnime1 = await openPage(B, '/category/liar-game', undefined, 'https://anime1.me')
    // B 尚未同步到這筆，所以一開始不該有標記
    await sleep(500)
    assert.equal(await bAnime1.locator('.entry-header.agh-bookmarked').count(), 0)
    await runMenu(bAnime1, '↻ 立即同步')
    await waitFor(async () => await bAnime1.locator('.entry-header.agh-bookmarked').count() === 1, 'B 同步後出現標記', 10000)
    const marked = await bAnime1.locator('.entry-header.agh-bookmarked .entry-title').textContent()
    assert.match(marked.trim(), /\[24\]$/)
    assert.equal(await bAnime1.locator('.entry-header.agh-bookmarked .agh-bookmark').getAttribute('title'), '本機紀錄・第 24 集・看到 2:05')
    await bAnime1.close()
  })

  await step('同名但不同來源的兩筆各自獨立', async () => {
    const aVideo2 = await openPage(A, `/animeVideo.php?sn=777&title=${encodeURIComponent('LIAR GAME 詐欺遊戲')}`, () => {
      const video = document.getElementById('ani_video_html5_api')
      Object.defineProperty(video, 'paused', { get: () => window.__paused === true, configurable: true })
    })
    await aVideo2.click('#adult')
    await waitFor(async () => {
      const history = await localHistory(aVideo2)
      return history.tester?.some((item) => item.title === 'LIAR GAME 詐欺遊戲')
    }, '動畫瘋也記錄了同名動畫', 8000)
    await aVideo2.evaluate(() => { window.__paused = true })
    const guest = await openPage(A, '/')
    await waitFor(async () => (await cards(guest)).filter((title) => title === 'LIAR GAME 詐欺遊戲').length === 2, '首頁出現兩張同名卡片')
    const hrefs = await guest.locator('#watched-anime .continue-watch-card .content-block').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))
    assert.ok(hrefs.includes('https://anime1.me/30152'))
    assert.ok(hrefs.includes('animeVideo.php?sn=777'))
    await guest.close()
    await aVideo2.close()
  })

  await step('有其他網站的紀錄後「功能」頁才出現「首頁清單」段落；關閉後首頁隱藏該來源，重新整理後仍保留', async () => {
    const tab = await openPage(A, '/')
    const liarCards = async () => (await cards(tab)).filter((title) => title === 'LIAR GAME 詐欺遊戲').length
    await waitFor(async () => await liarCards() === 2, '一開始兩個來源都顯示')
    await tab.locator('.agh-gear').click()
    const dialog = dialogOf(tab)
    await dialog.waitFor()
    assert.deepEqual(await dialog.locator('.agh-nav-item').allTextContents(), ['同步狀態', '雲端平台', '功能', '備份'])
    await dialog.locator('.agh-nav-item', { hasText: '功能' }).click()
    assert.deepEqual(await dialog.locator('.agh-section-title').allTextContents(), ['上次觀看標記', '首頁清單'])
    assert.deepEqual(await dialog.locator('.agh-section').nth(0).locator('dt').allTextContents(), ['動畫瘋', 'anime1'])
    assert.deepEqual(await dialog.locator('.agh-section').nth(1).locator('dt').allTextContents(), ['anime1'])
    await tab.screenshot({ path: `${OUT}07-features-page.png` })
    await dialog.getByLabel('在首頁顯示 anime1 的紀錄').uncheck()
    await waitFor(async () => await liarCards() === 1, '隱藏 anime1 後只剩動畫瘋的卡片')
    assert.equal(await tab.locator('#watched-anime .agh-source-badge').count(), 0)
    await tab.keyboard.press('Escape')

    const reopened = await openPage(A, '/')
    await sleep(800)
    assert.equal((await cards(reopened)).filter((title) => title === 'LIAR GAME 詐欺遊戲').length, 1, '重新整理後仍隱藏')
    assert.deepEqual(await reopened.evaluate(() => window.GM_getValue('preferences', null)), { hiddenSources: ['anime1'], hiddenMarkers: [] })
    const commits = github.commits.length
    await reopened.locator('.agh-gear').click()
    const dialog2 = dialogOf(reopened)
    await dialog2.locator('.agh-nav-item', { hasText: '功能' }).click()
    await dialog2.getByLabel('在首頁顯示 anime1 的紀錄').check()
    await waitFor(async () => (await cards(reopened)).filter((title) => title === 'LIAR GAME 詐欺遊戲').length === 2, '重新顯示')
    await sleep(2500)
    assert.equal(github.commits.length, commits, '顯示偏好只存本機，不應觸發雲端推送')
    await reopened.close()
    await tab.close()
  })

  await step('功能頁：關閉上次觀看標記後，動畫瘋分集書籤與 anime1 標記立即消失，仍會繼續記錄；重新整理後保留，不觸發雲端推送', async () => {
    const video = await openPage(A, `/animeVideo.php?sn=303&title=${encodeURIComponent('膽大黨')}`)
    const series = await openPage(A, '/category/liar-game', undefined, 'https://anime1.me')
    const videoMarks = () => video.locator('.season .agh-bookmark').count()
    const seriesMarks = () => series.locator('.entry-header.agh-bookmarked').count()
    await waitFor(async () => await videoMarks() === 1, '影片頁一開始有分集書籤')
    await waitFor(async () => await seriesMarks() === 1, 'anime1 系列頁一開始有標記')

    const commits = github.commits.length
    const home = await openPage(A, '/')
    await home.locator('.agh-gear').click()
    const dialog = dialogOf(home)
    await dialog.locator('.agh-nav-item', { hasText: '功能' }).click()
    await dialog.getByLabel('在 動畫瘋 顯示上次觀看標記').uncheck()
    await waitFor(async () => await videoMarks() === 0, '關閉後其他分頁的分集書籤立即消失')
    assert.equal(await seriesMarks(), 1, '只關閉動畫瘋，anime1 的標記仍在')
    await dialog.getByLabel('在 anime1 顯示上次觀看標記').uncheck()
    await waitFor(async () => await seriesMarks() === 0, '關閉後 anime1 的標記立即消失')
    assert.equal(await series.locator('.agh-bookmark-meta').count(), 0)
    assert.deepEqual(await home.evaluate(() => window.GM_getValue('preferences', null)), { hiddenSources: [], hiddenMarkers: ['ani-gamer', 'anime1'] })
    await sleep(2500)
    assert.equal(github.commits.length, commits, '標記開關只存本機，不應觸發雲端推送')

    // 關閉標記不影響記錄：在 anime1 文章頁繼續看，進度照常寫入，頁面上也不畫標記
    const post = await openPage(A, '/30152', () => {
      const element = document.querySelector('video')
      Object.defineProperty(element, 'paused', { get: () => window.__playing !== true, configurable: true })
      Object.defineProperty(element, 'currentTime', { get: () => 300, configurable: true })
      window.__playing = true
    }, 'https://anime1.me')
    await waitFor(async () => (await localHistory(post))['@shared'].find((item) => item.id === '30152')?.videoWatchTime === 300, '關閉標記時仍會記錄進度', 8000)
    assert.equal(await post.locator('.agh-bookmark').count(), 0)
    await post.evaluate(() => { window.__playing = false })

    const reloaded = await openPage(A, `/animeVideo.php?sn=303&title=${encodeURIComponent('膽大黨')}`)
    await sleep(800)
    assert.equal(await reloaded.locator('.season .agh-bookmark').count(), 0, '重新整理後仍關閉')
    await dialog.getByLabel('在 動畫瘋 顯示上次觀看標記').check()
    await dialog.getByLabel('在 anime1 顯示上次觀看標記').check()
    await waitFor(async () => await reloaded.locator('.season .agh-bookmark').count() === 1, '重新開啟後分集書籤出現')
    await waitFor(async () => await seriesMarks() === 1, '重新開啟後 anime1 標記出現')
    await home.keyboard.press('Escape')
    for (const tab of [video, series, home, post, reloaded]) await tab.close()
  })

  await step('首頁同步時間在齒輪右邊', async () => {
    const home = await openPage(A, '/')
    const indicator = home.locator('.agh-sync-indicator')
    await indicator.waitFor()
    const gearBox = await home.locator('.agh-gear').boundingBox()
    const indicatorBox = await indicator.boundingBox()
    assert.ok(indicatorBox.x >= gearBox.x + gearBox.width, `同步時間 x=${indicatorBox.x} 應在齒輪（右緣 ${gearBox.x + gearBox.width}）右邊`)
    await home.close()
  })

  await step('資料版本：只有舊欄位（含被舊版剝掉來源的 anime1 副本）的電腦更新後只顯示一筆，只剩一份含版本號的資料', async () => {
    const D = await newMachine('D')
    const reported = { id: '29681', title: '暴怒千金發誓復仇。 ～憑藉魔導書之力打垮祖國～', timestamp: now - 1000, episode: '5b', episodePicUrl: '', animePicUrl: '', videoWatchTime: 1.203466, videoTotalTime: 1425.024 }
    const legacy = JSON.stringify({ '@shared': [{ source: 'anime1', ...reported, seriesId: '1959' }, { source: 'ani-gamer', ...reported }] })
    D.gmValues.set('animeHistory', legacy)
    const tab = await openPage(D, '/')
    await waitFor(async () => (await cards(tab)).includes(reported.title), 'D 顯示 anime1 紀錄')
    await sleep(500)
    assert.equal((await cards(tab)).filter((title) => title === reported.title).length, 1, '只有一張卡片')
    const shared = (await localHistory(tab))['@shared']
    assert.equal(shared.length, 1)
    assert.equal(shared[0].source, 'anime1')
    assert.equal(shared[0].seriesId, '1959')
    assert.equal((await localSnapshot(tab)).dataVersion, '2.0.0')
    await waitFor(() => !D.gmValues.has('animeHistory'), '舊欄位已刪除，只剩一份最新版的資料')
    assert.deepEqual([...D.gmValues.keys()].filter((key) => key.startsWith('animeHistory') || key === HISTORY_KEY), [HISTORY_KEY])
    await tab.close()
    await D.close()
  })

  await step('資料版本：雲端資料由更新版本建立時顯示「無法同步」與「請更新腳本」連結，不合併也不寫回', async () => {
    const original = github.files.get(REMOTE_KEY)
    const newer = { ...JSON.parse(original.text), dataVersion: '2.1.0', schemaVersion: 3 }
    newer.history.tester = [...(newer.history.tester ?? []), { source: 'ani-gamer', id: '999', title: '未來版本的紀錄', timestamp: now, episode: '1', episodePicUrl: '', animePicUrl: '', videoWatchTime: 0, videoTotalTime: 1 }]
    github.files.set(REMOTE_KEY, { sha: original.sha, text: JSON.stringify(newer) })
    const commits = github.commits.length
    const puts = () => github.responses.filter((r) => r.method === 'PUT').length
    const putsBefore = puts()
    const tab = await openPage(A, '/')
    const indicator = tab.locator('.agh-sync-indicator')
    await indicator.filter({ hasText: '無法同步' }).waitFor({ timeout: 10000 })
    assert.equal(await indicator.locator('a').textContent(), '請更新腳本')
    assert.equal(await indicator.locator('a').getAttribute('href'), 'https://github.com/zoosewu/ani-gamer-history/releases/latest/download/ani-gamer-history.user.js')
    await sleep(2500)
    assert.equal(github.commits.length, commits, '不應寫回雲端')
    assert.equal(puts(), putsBefore, '不應發出 PUT')
    assert.equal((await cards(tab)).includes('未來版本的紀錄'), false, '不應合併進本機')
    await tab.locator('.agh-gear').click()
    const dialog = dialogOf(tab)
    await dialog.locator('.agh-summary dd', { hasText: '無法同步' }).locator('a', { hasText: '請更新腳本' }).waitFor()
    await expectMessage(dialog, '請先更新腳本')
    await tab.screenshot({ path: `${OUT}06-update-required.png` })
    await tab.keyboard.press('Escape')
    await tab.close()
    github.files.set(REMOTE_KEY, original)
  })

  await step('資料版本：本機資料由較新版本建立時拒絕使用：首頁提示更新、不顯示清單、不寫入本機、不發雲端請求', async () => {
    const E = await newMachine('E')
    const newer = JSON.stringify({ app: 'ani-gamer-history', dataVersion: '2.1.0', schemaVersion: 3, exportedAt: 1, history: { tester: [{ source: 'ani-gamer', id: '1', title: '未來版本的紀錄', timestamp: now, episode: '1', episodePicUrl: '', animePicUrl: '', videoWatchTime: 0, videoTotalTime: 1, note: '新欄位' }] } })
    E.gmValues.set(HISTORY_KEY, newer)
    E.gmValues.set('syncSettings', { adapterId: 'github-repo', autoSync: true, adapters: { 'github-repo': { token: 'good-token', repository: 'me/data' } } })
    const responses = github.responses.length
    const tab = await openPage(E, '/')
    await tab.locator('#watched-anime .agh-empty', { hasText: '資料版本 2.1.0' }).waitFor()
    assert.equal(await tab.locator('#watched-anime .agh-empty a').textContent(), '請更新腳本')
    assert.equal(await tab.locator('#watched-anime .continue-watch-card').count(), 0)
    assert.equal(await tab.locator('.agh-sync-indicator').textContent(), '無法使用請更新腳本')
    await tab.screenshot({ path: `${OUT}08-local-locked.png` })
    await sleep(2500)
    assert.equal(github.responses.length, responses, '不應發出任何雲端請求')
    assert.equal(E.gmValues.get(HISTORY_KEY), newer, '不應改寫本機資料')
    await tab.locator('.agh-gear').click()
    await dialogOf(tab).locator('.agh-message', { hasText: '請先更新腳本' }).waitFor()
    await tab.close()
    await E.close()
  })

  await step('資料版本：已開著的分頁收到較新版本寫入的資料後停止寫入，之後看動畫也不會蓋掉', async () => {
    const F = await newMachine('F')
    const video = await openPage(F, `/animeVideo.php?sn=404&title=${encodeURIComponent('孤獨搖滾！')}`, () => {
      const element = document.getElementById('ani_video_html5_api')
      Object.defineProperty(element, 'paused', { get: () => window.__paused === true, configurable: true })
    })
    await video.click('#adult')
    await waitFor(async () => (await localHistory(video)).tester?.some((item) => item.title === '孤獨搖滾！'), '開始看動畫後寫入本機', 8000)
    const newer = JSON.stringify({ app: 'ani-gamer-history', dataVersion: '3.0.0', schemaVersion: 3, exportedAt: 1, history: {} })
    await externalWrite(F, HISTORY_KEY, newer)
    // 影片分頁每秒都會更新進度；鎖定後不應再寫入
    await sleep(3000)
    assert.equal(F.gmValues.get(HISTORY_KEY), newer, '鎖定後不應蓋掉較新版本的資料')
    const home = await openPage(F, '/')
    await home.locator('#watched-anime .agh-empty', { hasText: '資料版本 3.0.0' }).waitFor()
    await video.evaluate(() => { window.__paused = true })
    await video.close()
    await home.close()
    await F.close()
  })

  await step('B 中斷同步：清除 Token、首頁狀態消失；手機寬度版面截圖', async () => {
    const dialog = dialogOf(bHome)
    await dialog.locator('.agh-nav-item', { hasText: '同步狀態' }).click()
    await dialog.getByRole('button', { name: '中斷同步' }).click()
    // 中斷後狀態頁會變回「尚未設定」，中斷按鈕也跟著消失
    await dialog.locator('.agh-summary dd', { hasText: '尚未設定' }).waitFor()
    await dialog.getByRole('button', { name: '中斷同步' }).waitFor({ state: 'detached' })
    const settings = await bHome.evaluate(() => window.GM_getValue('syncSettings', null))
    assert.equal(settings.adapterId, null)
    assert.deepEqual(settings.adapters, {})
    await bHome.setViewportSize({ width: 400, height: 760 })
    await bHome.screenshot({ path: `${OUT}05-status-mobile-disconnected.png` })
    await bHome.keyboard.press('Escape')
    await bHome.locator('.agh-sync-indicator').waitFor({ state: 'detached' })
  })

  assert.deepEqual(pageErrors, [], 'no uncaught page errors')
  console.log(`\nALL PASSED — commits: ${github.commits.length}, responses: ${github.responses.length}, 409s: ${github.responses.filter((r) => r.status === 409).length}`)
} catch (error) {
  console.log('FAILED')
  console.error(error)
  console.error('時間軸:'); timeline.forEach((line) => console.error('   ' + line))
  console.error('commits:', github.commits.map((c) => c.message))
  console.error('remote buckets:', JSON.stringify(Object.entries(remoteSnapshot()?.history ?? {}).map(([k, v]) => [k, v.map((i) => `${i.source}:${i.title}`)])))
  for (const [name, tab] of [['aHome', aHome], ['aVideo', aVideo], ['bHome', bHome]]) {
    if (tab === undefined || tab.isClosed()) continue
    const state = await tab.evaluate(() => ({
      sync: window.GM_getValue('syncStatus', null),
      settings: window.GM_getValue('syncSettings', null),
      local: Object.entries(JSON.parse(window.GM_getValue('history', '{"history":{}}')).history).map(([k, v]) => [k, v.map((i) => `${i.source}:${i.title}`)])
    })).catch(() => null)
    console.error(name, JSON.stringify(state))
  }
  if (pageErrors.length > 0) console.error('page errors:', pageErrors)
  process.exitCode = 1
} finally {
  await browser.close()
}

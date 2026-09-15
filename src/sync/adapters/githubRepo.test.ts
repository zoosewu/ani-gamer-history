import { describe, expect, it } from 'vitest'
import { createSnapshot } from '@/history/merge'
import { HistorySnapshot } from '@/history/types'
import { ConflictError } from '../adapter'
import { decodeBase64Utf8, encodeBase64Utf8 } from '../base64'
import { HttpClient, HttpRequest, HttpResponse } from '../http'
import { createGithubRepoAdapter, testGithubRepo } from './githubRepo'

type Handler = (request: HttpRequest) => HttpResponse

const createClient = (handlers: Handler[]): { client: HttpClient, requests: HttpRequest[] } => {
  const requests: HttpRequest[] = []
  const client: HttpClient = async (request) => {
    requests.push(request)
    const handler = handlers.shift()
    if (handler === undefined) throw new Error(`unexpected request ${request.method} ${request.url}`)
    return handler(request)
  }
  return { client, requests }
}

const json = (status: number, body: unknown): Handler => () => ({ status, text: JSON.stringify(body) })

// GitHub 回傳的 base64 每 60 字元換行
const githubBase64 = (text: string): string => encodeBase64Utf8(text).replace(/.{60}/g, '$&\n')

const fileResponse = (snapshot: HistorySnapshot, sha = 'sha-1'): Handler =>
  json(200, { type: 'file', sha, encoding: 'base64', content: githubBase64(JSON.stringify(snapshot)) })

const putBody = (request: HttpRequest): { message: string, content: string, sha?: string, branch?: string } => JSON.parse(request.body ?? '')

const settings = { token: ' github_pat_abc ', repository: 'me/data', path: '', branch: '' }
const snapshot = createSnapshot({
  巴哈使用者: [{ id: '42', timestamp: 1700000000000, title: '【我推的孩子】第二季', episodePicUrl: 'e.jpg', animePicUrl: 'a.jpg', episode: '3', videoWatchTime: 60, videoTotalTime: 1440, isFavorite: true, favoriteTime: 5 }]
}, 1700000000001)

const CONTENTS_URL = 'https://api.github.com/repos/me/data/contents/ani-gamer-history.json'

describe('base64', () => {
  it('中文、emoji 與超過分段大小的內容都能還原', () => {
    const text = `葬送的芙莉蓮 🎬 ${'あ'.repeat(40000)}`
    expect(decodeBase64Utf8(githubBase64(text))).toBe(text)
  })
})

describe('GitHub repo adapter', () => {
  it('檔案不存在時 load 回傳 null，之後建立檔案並記住新的 sha', async () => {
    const { client, requests } = createClient([
      json(404, { message: 'Not Found' }),
      json(201, { content: { sha: 'sha-new' } }),
      json(200, { content: { sha: 'sha-next' } })
    ])
    const adapter = createGithubRepoAdapter(settings, client)
    expect(await adapter.load()).toBeNull()
    await adapter.save(snapshot)
    await adapter.save(snapshot)

    expect(requests[0]).toMatchObject({ method: 'GET', url: CONTENTS_URL })
    expect(requests[0].headers).toMatchObject({ Authorization: 'Bearer github_pat_abc', 'Cache-Control': 'no-cache' })
    expect(requests[1]).toMatchObject({ method: 'PUT', url: CONTENTS_URL })
    const created = putBody(requests[1])
    expect(created.sha).toBeUndefined()
    expect(created.branch).toBeUndefined()
    expect(JSON.parse(decodeBase64Utf8(created.content))).toEqual(snapshot)
    expect(putBody(requests[2]).sha).toBe('sha-new')
  })

  it('讀取既有檔案（含中文），寫入時帶上讀到的 sha', async () => {
    const { client, requests } = createClient([fileResponse(snapshot), json(200, { content: { sha: 'sha-2' } })])
    const adapter = createGithubRepoAdapter(settings, client)
    expect(await adapter.load()).toEqual(snapshot)
    await adapter.save(snapshot)
    expect(putBody(requests[1]).sha).toBe('sha-1')
  })

  it('指定分支與含中文、空白的路徑', async () => {
    const { client, requests } = createClient([json(404, {}), json(201, { content: { sha: 's' } })])
    const adapter = createGithubRepoAdapter({ ...settings, path: '/備份/history file.json', branch: 'data' }, client)
    await adapter.load()
    await adapter.save(snapshot)
    const url = 'https://api.github.com/repos/me/data/contents/%E5%82%99%E4%BB%BD/history%20file.json'
    expect(requests[0].url).toBe(`${url}?ref=data`)
    expect(requests[1].url).toBe(url)
    expect(putBody(requests[1]).branch).toBe('data')
  })

  it('超過 1MB 的檔案改用 raw 格式讀取', async () => {
    const { client, requests } = createClient([
      json(200, { type: 'file', sha: 'big', encoding: 'none', content: '' }),
      () => ({ status: 200, text: JSON.stringify(snapshot) })
    ])
    expect(await createGithubRepoAdapter(settings, client).load()).toEqual(snapshot)
    expect(requests[1].headers?.Accept).toBe('application/vnd.github.raw+json')
  })

  it('空檔案視為沒有資料', async () => {
    const { client } = createClient([json(200, { type: 'file', sha: 'empty', encoding: 'base64', content: '' })])
    expect(await createGithubRepoAdapter(settings, client).load()).toBeNull()
  })

  it('409 與提到 sha 的 422 視為衝突，其他 422 不是', async () => {
    const conflict = createClient([json(409, { message: 'is at abc but expected def' })])
    await expect(createGithubRepoAdapter(settings, conflict.client).save(snapshot)).rejects.toBeInstanceOf(ConflictError)

    const created = createClient([json(422, { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' })])
    await expect(createGithubRepoAdapter(settings, created.client).save(snapshot)).rejects.toBeInstanceOf(ConflictError)

    const other = createClient([json(422, { message: 'Validation Failed' })])
    const error = await createGithubRepoAdapter(settings, other.client).save(snapshot).catch((e: unknown) => e)
    expect(error).not.toBeInstanceOf(ConflictError)
    expect((error as Error).message).toContain('422')
  })

  it('HTTP 錯誤轉成可讀的訊息', async () => {
    const { client } = createClient([json(401, { message: 'Bad credentials' })])
    await expect(createGithubRepoAdapter(settings, client).load()).rejects.toThrow('Token 無效')
  })

  it('路徑是資料夾時拋出錯誤', async () => {
    const { client } = createClient([json(200, [{ name: 'a.json' }])])
    await expect(createGithubRepoAdapter(settings, client).load()).rejects.toThrow('不是檔案')
  })

  it('設定不完整時不發送請求', async () => {
    const { client, requests } = createClient([])
    await expect(createGithubRepoAdapter({ ...settings, token: '' }, client).load()).rejects.toThrow('請輸入 Token')
    await expect(createGithubRepoAdapter({ ...settings, repository: 'data' }, client).save(snapshot)).rejects.toThrow('owner/repo')
    expect(requests).toHaveLength(0)
  })
})

describe('testGithubRepo', () => {
  it('連線成功時回報雲端筆數，非 private 時提出警告', async () => {
    const { client } = createClient([json(200, { private: false }), fileResponse(snapshot)])
    const result = await testGithubRepo(settings, client)
    expect(result.ok).toBe(true)
    expect(result.message).toContain('1 筆')
    expect(result.message).toContain('不是 private')
  })

  it('private repo 且沒有檔案時提示會自動建立', async () => {
    const { client } = createClient([json(200, { private: true }), json(404, {})])
    const result = await testGithubRepo(settings, client)
    expect(result).toEqual({ ok: true, message: '連線成功，雲端還沒有資料，第一次同步時會建立檔案。' })
  })

  it('repository 不存在或沒有權限時失敗', async () => {
    const { client } = createClient([json(404, { message: 'Not Found' })])
    expect(await testGithubRepo(settings, client)).toEqual({ ok: false, message: '找不到 repository，或 Token 沒有這個 repository 的權限' })
  })

  it('網路錯誤時回傳失敗而不是拋出', async () => {
    const client: HttpClient = async () => { throw new Error('網路錯誤') }
    expect(await testGithubRepo(settings, client)).toEqual({ ok: false, message: '網路錯誤' })
  })
})

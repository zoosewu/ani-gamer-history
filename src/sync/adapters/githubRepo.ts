import { parseSnapshot } from '@/history/merge'
import { AdapterSettings, CloudAdapterDefinition, ConflictError, HistoryAdapter, TestResult } from '../adapter'
import { decodeBase64Utf8, encodeBase64Utf8 } from '../base64'
import { HttpClient, HttpResponse } from '../http'

const API = 'https://api.github.com'
export const DEFAULT_PATH = 'ani-gamer-history.json'

interface GithubRepoSettings {
  token: string
  repository: string
  path: string
  branch: string
}

const toSettings = (settings: AdapterSettings): GithubRepoSettings => {
  const value = (key: string): string => (settings[key] ?? '').trim()
  return {
    token: value('token'),
    repository: value('repository'),
    path: value('path') === '' ? DEFAULT_PATH : value('path').replace(/^\/+/, ''),
    branch: value('branch')
  }
}

const validate = ({ token, repository }: GithubRepoSettings): string | null => {
  if (token === '') return '請輸入 Token'
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) return 'Repository 格式應為 owner/repo'
  return null
}

const githubHeaders = (token: string, accept = 'application/vnd.github+json'): Record<string, string> => ({
  Accept: accept,
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  // GitHub API 回應帶 max-age=60，不關掉快取可能拿到舊的 sha
  'Cache-Control': 'no-cache'
})

const parseJson = (text: string, message: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(message)
  }
}

const describeError = (response: HttpResponse): string => {
  let detail = ''
  try {
    const body = JSON.parse(response.text)
    if (typeof body?.message === 'string') detail = body.message
  } catch {}
  switch (response.status) {
    case 401: return 'Token 無效或已過期'
    case 403: return `權限不足或已達 API 次數上限${detail === '' ? '' : `（${detail}）`}`
    case 404: return '找不到 repository，或 Token 沒有這個 repository 的權限'
    default: return `GitHub API 錯誤 ${response.status}${detail === '' ? '' : `：${detail}`}`
  }
}

export const createGithubRepoAdapter = (input: AdapterSettings, request: HttpClient): HistoryAdapter => {
  const settings = toSettings(input)
  const invalid = validate(settings)
  const repoPath = settings.path.split('/').map(encodeURIComponent).join('/')
  const contentsUrl = `${API}/repos/${settings.repository}/contents/${repoPath}`
  const readUrl = settings.branch === '' ? contentsUrl : `${contentsUrl}?ref=${encodeURIComponent(settings.branch)}`
  // 最後一次讀到或寫入的檔案版本，寫入時用來偵測衝突
  let sha: string | undefined

  const assertValid = (): void => {
    if (invalid !== null) throw new Error(invalid)
  }

  const readText = async (): Promise<string | null> => {
    const response = await request({ method: 'GET', url: readUrl, headers: githubHeaders(settings.token) })
    if (response.status === 404) {
      sha = undefined
      return null
    }
    if (response.status !== 200) throw new Error(describeError(response))
    const body = parseJson(response.text, 'GitHub 回應格式錯誤') as { sha?: unknown, content?: unknown, encoding?: unknown }
    if (typeof body.sha !== 'string') throw new Error(`「${settings.path}」不是檔案`)
    sha = body.sha
    if (body.encoding === 'base64' && typeof body.content === 'string') return decodeBase64Utf8(body.content)
    // 超過 1MB 的檔案 content 會是空的，要改用 raw 格式讀取
    const raw = await request({ method: 'GET', url: readUrl, headers: githubHeaders(settings.token, 'application/vnd.github.raw+json') })
    if (raw.status !== 200) throw new Error(describeError(raw))
    return raw.text
  }

  return {
    load: async () => {
      assertValid()
      const text = await readText()
      if (text === null || text.trim() === '') return null
      return parseSnapshot(parseJson(text, '雲端檔案不是有效的 JSON'))
    },
    save: async (snapshot) => {
      assertValid()
      const body = {
        message: `ani-gamer-history sync ${new Date(snapshot.exportedAt).toISOString()}`,
        content: encodeBase64Utf8(`${JSON.stringify(snapshot, null, 2)}\n`),
        sha,
        branch: settings.branch === '' ? undefined : settings.branch
      }
      const response = await request({
        method: 'PUT',
        url: contentsUrl,
        headers: { ...githubHeaders(settings.token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      // 409：sha 不是最新；422 且提到 sha：別台裝置剛建立了檔案
      if (response.status === 409 || (response.status === 422 && /sha/i.test(response.text))) throw new ConflictError()
      if (response.status !== 200 && response.status !== 201) throw new Error(describeError(response))
      const result = parseJson(response.text, 'GitHub 回應格式錯誤') as { content?: { sha?: unknown } }
      sha = typeof result.content?.sha === 'string' ? result.content.sha : undefined
    }
  }
}

export const testGithubRepo = async (input: AdapterSettings, request: HttpClient): Promise<TestResult> => {
  const settings = toSettings(input)
  const invalid = validate(settings)
  if (invalid !== null) return { ok: false, message: invalid }
  try {
    const response = await request({ method: 'GET', url: `${API}/repos/${settings.repository}`, headers: githubHeaders(settings.token) })
    if (response.status !== 200) return { ok: false, message: describeError(response) }
    const repo = parseJson(response.text, 'GitHub 回應格式錯誤') as { private?: unknown }
    const snapshot = await createGithubRepoAdapter(input, request).load()
    const count = snapshot === null ? 0 : Object.values(snapshot.history).reduce((sum, list) => sum + list.length, 0)
    const messages = [
      snapshot === null ? '連線成功，雲端還沒有資料，第一次同步時會建立檔案。' : `連線成功，雲端有 ${count} 筆紀錄。`
    ]
    if (repo.private !== true) messages.push('⚠ 這個 repository 不是 private，任何人都看得到你的觀看紀錄。')
    return { ok: true, message: messages.join('\n') }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export const createGithubRepoDefinition = (request: HttpClient): CloudAdapterDefinition => ({
  id: 'github-repo',
  label: 'GitHub Private Repository',
  instructions: [
    '在 GitHub 建立一個 Private repository（例如 ani-gamer-history-data）。',
    '到 Settings → Developer settings → Fine-grained tokens 建立 Token。',
    'Repository access 選「Only select repositories」，只勾剛剛建立的 repository。',
    'Permissions → Repository permissions → Contents 設為「Read and write」。',
    '把 Token 和 repository 名稱填到下方，按「測試連線」確認後儲存。'
  ],
  fields: [
    { key: 'token', label: 'Token', type: 'password', required: true, placeholder: 'github_pat_…' },
    { key: 'repository', label: 'Repository', type: 'text', required: true, placeholder: 'owner/repo' },
    { key: 'path', label: '檔案路徑', type: 'text', required: false, placeholder: DEFAULT_PATH },
    { key: 'branch', label: '分支', type: 'text', required: false, placeholder: '留空使用預設分支' }
  ],
  create: (settings) => createGithubRepoAdapter(settings, request),
  test: async (settings) => await testGithubRepo(settings, request)
})

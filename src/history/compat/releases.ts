import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { AnimeHistory } from '../types'

// 從 git tag 取出已發佈版本真實的紀錄處理程式碼，給相容性測試使用（見 docs/schema-version.md）。
// tag 不會改變，效果等同把舊版程式碼凍結；每次發佈都會自動納入，不需要手動複製。

export interface ReleasedSnapshot {
  app: string
  schemaVersion: number
  exportedAt: number
  history: AnimeHistory
}

// 每個 tag 的 src/history/merge.ts 與 types.ts 必須提供這些匯出；之後若搬移或改名，要在這裡依版本對應
export interface ReleasedHistory {
  tag: string
  SNAPSHOT_SCHEMA_VERSION: number
  parseSnapshot: (value: unknown) => ReleasedSnapshot
  createSnapshot: (history: AnimeHistory, exportedAt?: number) => ReleasedSnapshot
  mergeHistory: (...histories: AnimeHistory[]) => AnimeHistory
  normalizeHistory: (history: AnimeHistory) => AnimeHistory
}

const ENTRY = [
  "export { parseSnapshot, createSnapshot, mergeHistory, normalizeHistory } from './src/history/merge'",
  "export { SNAPSHOT_SCHEMA_VERSION } from './src/history/types'"
].join('\n')

const MISSING_HISTORY = '相容性測試需要完整的 git 歷史與 tag：請執行 git fetch --tags --unshallow（CI 的 checkout 要設定 fetch-depth: 0）'

const run = (command: string, args: string[], cwd: string, input?: Buffer): Buffer =>
  execFileSync(command, args, { cwd, input, maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] })

const text = (command: string, args: string[], cwd: string): string => run(command, args, cwd).toString().trim()

const hasHistoryCode = (root: string, tag: string): boolean => {
  try {
    run('git', ['cat-file', '-e', `${tag}:src/history/merge.ts`], root)
    return true
  } catch {
    return false
  }
}

const compareVersion = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true })

// 取出 tag 的 src/ 並打包成單一模組；@/ 指向該 tag 自己的 src，不會混進目前的程式碼
const bundleRelease = async (root: string, tag: string): Promise<string> => {
  const commit = text('git', ['rev-parse', `${tag}^{commit}`], root)
  const dir = join(root, '.compat', commit)
  const outfile = join(dir, 'history.mjs')
  if (existsSync(outfile)) return outfile

  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  run('tar', ['-x', '-C', dir], root, run('git', ['archive', commit, 'src'], root))
  const srcDir = join(dir, 'src')
  const partial = join(dir, 'history.partial.mjs')
  await build({
    stdin: { contents: ENTRY, resolveDir: dir, loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    outfile: partial,
    logLevel: 'silent',
    plugins: [{
      name: 'release-src-alias',
      setup (plugin) {
        plugin.onResolve({ filter: /^@\// }, async (args) => {
          const result = await plugin.resolve(`./${args.path.slice(2)}`, { kind: args.kind, resolveDir: srcDir })
          return result.errors.length > 0 ? { errors: result.errors } : { path: result.path }
        })
      }
    }]
  })
  renameSync(partial, outfile)
  return outfile
}

export const loadReleases = async (): Promise<ReleasedHistory[]> => {
  const root = text('git', ['rev-parse', '--show-toplevel'], process.cwd())
  if (text('git', ['rev-parse', '--is-shallow-repository'], root) === 'true') throw new Error(MISSING_HISTORY)
  const tags = text('git', ['tag', '--list'], root).split('\n').filter((tag) => tag !== '' && hasHistoryCode(root, tag)).sort(compareVersion)
  if (tags.length === 0) throw new Error(MISSING_HISTORY)

  const releases: ReleasedHistory[] = []
  for (const tag of tags) {
    const module = await import(pathToFileURL(await bundleRelease(root, tag)).href) as Omit<ReleasedHistory, 'tag'>
    releases.push({ ...module, tag })
  }
  return releases
}

import { DATA_VERSION } from './types'

// 資料版本（MAJOR.MINOR.PATCH），和腳本版本無關；各層級的意義見 docs/schema-version.md
// - MAJOR：既有資料要轉換才能用，舊腳本拒絕，新腳本依 migrations 轉換
// - MINOR：只有新增，舊腳本拒絕（否則會丟掉新欄位），新腳本直接使用
// - PATCH：舊腳本讀寫後完全無損，互相接受
export interface DataVersion {
  major: number
  minor: number
  patch: number
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export const parseDataVersion = (value: unknown): DataVersion | null => {
  if (typeof value !== 'string') return null
  const match = SEMVER.exec(value)
  if (match === null) return null
  const [major, minor, patch] = match.slice(1).map(Number)
  return major >= 1 ? { major, minor, patch } : null
}

export const formatDataVersion = ({ major, minor, patch }: DataVersion): string => `${major}.${minor}.${patch}`

const parsed = parseDataVersion(DATA_VERSION)
if (parsed === null) throw new Error(`DATA_VERSION 格式錯誤：${DATA_VERSION}`)
export const CURRENT_DATA_VERSION: DataVersion = parsed

// 還沒有 dataVersion 的資料（0.8.0 以前）只有整數 schemaVersion，視為 N.0.0
export const fromSchemaVersion = (schemaVersion: number): DataVersion => ({ major: schemaVersion, minor: 0, patch: 0 })

// MAJOR.MINOR 比目前新就不能讀；只有 PATCH 比較新時可以
export const isNewerThanSupported = (version: DataVersion, supported = CURRENT_DATA_VERSION): boolean =>
  version.major > supported.major || (version.major === supported.major && version.minor > supported.minor)

// 給 0.4.0～0.8.0 看的整數版本：它們只認 schemaVersion。
// 資料還是 2.0.x 時寫 2，讓 0.8.0 照常同步；MINOR 或 MAJOR 往上調之後一律寫 3，讓它們拒絕並提示更新
export const legacySchemaVersion = (version = CURRENT_DATA_VERSION): number =>
  version.major === 2 && version.minor === 0 ? 2 : 3

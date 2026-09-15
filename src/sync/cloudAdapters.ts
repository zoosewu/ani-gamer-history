import { CloudAdapterDefinition } from './adapter'
import { createGithubRepoDefinition } from './adapters/githubRepo'
import { gmRequest } from './gmRequest'

// 新增雲端平台時，在這裡加入對應的 adapter 定義
export const cloudAdapters: CloudAdapterDefinition[] = [
  createGithubRepoDefinition(gmRequest)
]

export const findCloudAdapter = (id: string | null): CloudAdapterDefinition | undefined =>
  cloudAdapters.find((definition) => definition.id === id)

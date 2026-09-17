import { SCRIPT_DOWNLOAD_URL } from '@/scriptMeta'

// 打開發佈的 userscript，Tampermonkey 會跳出更新畫面
export const UpdateScriptLink = (): JSX.Element => (
  <a className='agh-link' href={SCRIPT_DOWNLOAD_URL} target='_blank' rel='noreferrer'>請更新腳本</a>
)

// Prompt Encoding 插件入口
// 将 prompt 转换为 Unicode 转义序列以绕过内容审核

import { definePlugin } from '../../core'
import { createPromptEncodingMiddleware } from './middleware'
import {
  promptEncodingConfigFields,
  defaultPromptEncodingConfig,
  type PromptEncodingConfig
} from './config'

export default definePlugin({
  id: 'prompt-encoding',
  name: 'Prompt Unicode 编码',
  description: '将 prompt 转换为 Unicode 转义序列（如 \\u4f60\\u597d）以绕过内容审核',
  version: '1.0.0',

  configFields: promptEncodingConfigFields,
  configDefaults: defaultPromptEncodingConfig,

  middlewares: [
    createPromptEncodingMiddleware()
  ],

  async onLoad(ctx) {
    ctx.logger.info('Prompt encoding plugin loaded')
  }
})

// 导出类型
export type { PromptEncodingConfig } from './config'
export { createPromptEncodingMiddleware } from './middleware'

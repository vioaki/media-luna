// Core API Module
// 统一的 API 注册和管理

// API 工具函数
export {
  getUidFromAuth,
  apiError,
  apiSuccess,
  wrapApiHandler,
  wrapAuthApiHandler
} from './api-utils'

// 重新导出各个 API 注册函数
export { registerChannelApi } from './channel-api'
export { registerPresetApi } from './preset-api'
export { registerTaskApi } from './task-api'
export { registerMiddlewareApi } from './middleware-api'
export { registerConnectorApi } from './connector-api'
export { registerGenerateApi } from './generate-api'
export { registerCacheApi } from './cache-api'
export { registerSettingsApi } from './settings-api'
export { registerPluginApi } from './plugin-api'
export { registerSetupApi } from './setup-api'

import { Context } from 'koishi'
import { registerChannelApi } from './channel-api'
import { registerPresetApi } from './preset-api'
import { registerTaskApi } from './task-api'
import { registerMiddlewareApi } from './middleware-api'
import { registerConnectorApi } from './connector-api'
import { registerGenerateApi } from './generate-api'
import { registerCacheApi } from './cache-api'
import { registerSettingsApi } from './settings-api'
import { registerPluginApi } from './plugin-api'
import { registerSetupApi } from './setup-api'

/**
 * 注册所有 API
 */
export function registerAllApis(ctx: Context): void {
  registerChannelApi(ctx)
  registerPresetApi(ctx)
  registerTaskApi(ctx)
  registerMiddlewareApi(ctx)
  registerConnectorApi(ctx)
  registerGenerateApi(ctx)
  registerCacheApi(ctx)
  registerSettingsApi(ctx)
  registerPluginApi(ctx)
  registerSetupApi(ctx)
}

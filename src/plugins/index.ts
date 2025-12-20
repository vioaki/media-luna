// Plugins Index - 导出所有插件

// 功能插件
export { default as cachePlugin } from './cache'
export { default as presetPlugin } from './preset'
export { default as billingPlugin } from './billing'
export { default as taskPlugin } from './task'
export { default as promptEncodingPlugin } from './prompt-encoding'
export { default as webuiAuthPlugin } from './webui-auth'

// 连接器插件
export { default as dalleConnectorPlugin } from './connector-dalle'
export { default as sdWebuiConnectorPlugin } from './connector-sd-webui'
export { default as fluxConnectorPlugin } from './connector-flux'
export { default as chatApiConnectorPlugin } from './connector-chat-api'

// 导出类型
export type { StorageConfig, LocalCacheConfig } from './cache'
export type { PresetPluginConfig, PresetMiddlewareConfig, RemoteSyncConfig } from './preset'
export type { BillingConfig } from './billing'
export type { TaskPluginConfig } from './task'
export type { PromptEncodingConfig } from './prompt-encoding'
export type { WebuiAuthConfig } from './webui-auth'

// 导出服务
export { CacheService } from './cache'
export { PresetService, RemoteSyncService } from './preset'
export { TaskService } from './task'
export { WebuiAuthService } from './webui-auth'

// 导出中间件工厂
export { createPromptEncodingMiddleware } from './prompt-encoding'

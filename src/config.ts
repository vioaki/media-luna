// Media Luna 配置定义

import { Schema } from 'koishi'

export interface Config {
  // 日志
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export const Config: Schema<Config> = Schema.object({
  logLevel: Schema.union(['debug', 'info', 'warn', 'error'] as const)
    .default('info')
    .description('日志级别')
}).description('Media Luna 配置')

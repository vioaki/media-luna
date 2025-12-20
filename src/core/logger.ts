// Logger - 日志封装
// 直接使用 Koishi 的 Logger，日志级别由 Koishi 配置控制

import { Logger } from 'koishi'
import type { PluginLogger } from './types'

/** 日志级别（兼容旧 API） */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** 设置全局日志级别（已废弃，由 Koishi 配置控制） */
export function setLogLevel(level: LogLevel): void {
  // no-op: 日志级别由 Koishi 配置控制
}

/** 获取全局日志级别（已废弃） */
export function getLogLevel(): LogLevel {
  return 'debug'
}

/**
 * 创建插件日志器
 * 直接使用传入的 Logger，不再 extend，避免日志级别不同步
 */
export function createPluginLogger(baseLogger: Logger, pluginId: string): PluginLogger {
  // 直接使用 baseLogger，在消息前添加前缀
  const prefix = `[${pluginId}]`

  return {
    debug(message: string, ...args: any[]): void {
      baseLogger.debug(`${prefix} ${message}`, ...args)
    },

    info(message: string, ...args: any[]): void {
      baseLogger.info(`${prefix} ${message}`, ...args)
    },

    warn(message: string, ...args: any[]): void {
      baseLogger.warn(`${prefix} ${message}`, ...args)
    },

    error(message: string, ...args: any[]): void {
      baseLogger.error(`${prefix} ${message}`, ...args)
    }
  }
}

/**
 * 创建核心日志器
 */
export function createCoreLogger(baseLogger: Logger): PluginLogger {
  return createPluginLogger(baseLogger, 'core')
}

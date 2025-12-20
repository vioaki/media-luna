// 服务注册中心

import { Context } from 'koishi'
import type { PluginLogger } from '../types'
import { createPluginLogger } from '../logger'

/**
 * 服务注册中心
 *
 * 管理插件注册的服务实例
 */
export class ServiceRegistry {
  private _services: Map<string, any> = new Map()
  private _logger: PluginLogger

  constructor(ctx: Context) {
    this._logger = createPluginLogger(ctx.logger('media-luna'), 'services')
  }

  /**
   * 注册服务
   * @returns 注销函数
   */
  register<T>(name: string, service: T): () => void {
    if (this._services.has(name)) {
      throw new Error(`Service "${name}" is already registered`)
    }

    this._services.set(name, service)
    this._logger.debug('Registered service: %s', name)

    return () => {
      this.unregister(name)
    }
  }

  /** 注销服务 */
  unregister(name: string): void {
    if (!this._services.has(name)) {
      return
    }

    this._services.delete(name)
    this._logger.debug('Unregistered service: %s', name)
  }

  /** 获取服务 */
  get<T>(name: string): T | undefined {
    return this._services.get(name) as T | undefined
  }

  /** 检查服务是否存在 */
  has(name: string): boolean {
    return this._services.has(name)
  }

  /** 获取所有服务名称 */
  list(): string[] {
    return Array.from(this._services.keys())
  }

  /** 清空所有服务 */
  clear(): void {
    this._services.clear()
    this._logger.debug('Cleared all services')
  }
}

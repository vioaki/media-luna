// 连接器注册中心

import { Context } from 'koishi'
import type { ConnectorDefinition } from '../types'

/**
 * 连接器注册中心
 *
 * 管理连接器的注册、注销和查询
 */
export class ConnectorRegistry {
  private _connectors: Map<string, ConnectorDefinition> = new Map()
  private _ctx: Context

  constructor(ctx: Context) {
    this._ctx = ctx
  }

  /**
   * 注册连接器
   * @returns 注销函数
   */
  register(connector: ConnectorDefinition): () => void {
    if (this._connectors.has(connector.id)) {
      throw new Error(`Connector "${connector.id}" is already registered`)
    }

    this._connectors.set(connector.id, connector)
    this._ctx.emit('mediaLuna/connector-added', connector)

    return () => {
      this.unregister(connector.id)
    }
  }

  /** 注销连接器 */
  unregister(id: string): void {
    if (!this._connectors.has(id)) {
      return
    }

    this._connectors.delete(id)
    this._ctx.emit('mediaLuna/connector-removed', id)
  }

  /** 获取连接器 */
  get(id: string): ConnectorDefinition | undefined {
    return this._connectors.get(id)
  }

  /** 检查连接器是否存在 */
  has(id: string): boolean {
    return this._connectors.has(id)
  }

  /** 获取所有连接器 */
  list(): ConnectorDefinition[] {
    return Array.from(this._connectors.values())
  }

  /** 获取连接器摘要信息 */
  listSummary(): Array<{
    id: string
    name: string
    description?: string
    icon?: string
    supportedTypes: string[]
    fields: any[]
    cardFields: any[]
    defaultTags: string[]
  }> {
    return this.list().map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      supportedTypes: c.supportedTypes,
      fields: c.fields,
      cardFields: c.cardFields || [],
      defaultTags: c.defaultTags || []
    }))
  }

  /** 清空所有连接器 */
  clear(): void {
    for (const id of this._connectors.keys()) {
      this._ctx.emit('mediaLuna/connector-removed', id)
    }
    this._connectors.clear()
  }
}

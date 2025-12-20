// 中间件注册中心

import { Context } from 'koishi'
import type { MiddlewareDefinition, CardField } from '../types'
import { MiddlewareDependencyGraph } from './dependency-graph'

/**
 * 中间件注册中心
 *
 * 管理中间件的注册、注销和查询
 */
export class MiddlewareRegistry {
  private _graph: MiddlewareDependencyGraph
  private _ctx: Context

  constructor(ctx: Context) {
    this._ctx = ctx
    this._graph = new MiddlewareDependencyGraph()
  }

  /**
   * 注册中间件
   * @returns 注销函数
   */
  register(middleware: MiddlewareDefinition): () => void {
    if (this._graph.has(middleware.name)) {
      throw new Error(`Middleware "${middleware.name}" is already registered`)
    }

    this._graph.register(middleware)
    this._ctx.emit('mediaLuna/middleware-added', middleware)

    return () => {
      this.unregister(middleware.name)
    }
  }

  /** 注销中间件 */
  unregister(name: string): void {
    if (!this._graph.has(name)) {
      return
    }

    this._graph.unregister(name)
    this._ctx.emit('mediaLuna/middleware-removed', name)
  }

  /** 获取中间件定义 */
  get(name: string): MiddlewareDefinition | undefined {
    return this._graph.get(name)
  }

  /** 检查中间件是否存在 */
  has(name: string): boolean {
    return this._graph.has(name)
  }

  /** 获取所有中间件 */
  list(): MiddlewareDefinition[] {
    return this._graph.getMiddlewares()
  }

  /** 获取依赖图 */
  getGraph(): MiddlewareDependencyGraph {
    return this._graph
  }

  /** 获取所有中间件的卡片展示字段（去重） */
  getCardFields(): CardField[] {
    const fields: CardField[] = []
    const seen = new Set<string>()

    for (const middleware of this._graph.getMiddlewares()) {
      if (middleware.cardFields) {
        for (const field of middleware.cardFields) {
          const key = `${field.source}:${field.key}`
          if (!seen.has(key)) {
            seen.add(key)
            fields.push(field)
          }
        }
      }
    }

    return fields
  }

  /** 清空所有中间件 */
  clear(): void {
    for (const middleware of this._graph.getMiddlewares()) {
      this._ctx.emit('mediaLuna/middleware-removed', middleware.name)
    }
    this._graph.clear()
  }
}

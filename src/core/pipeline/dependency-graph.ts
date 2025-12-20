// 中间件依赖图 - 基于 Kahn 算法的拓扑排序

import type { MiddlewareDefinition, LifecyclePhase } from '../types'
import { LIFECYCLE_PHASES } from '../types'

/** 依赖图节点 */
interface DependencyNode {
  name: string
  middleware: MiddlewareDefinition | null  // null 表示生命周期节点
  phase: LifecyclePhase
}

/**
 * 中间件依赖图
 *
 * 使用 Kahn 算法进行拓扑排序，支持：
 * - before/after 依赖声明
 * - 生命周期阶段约束
 * - 并行执行优化（同层中间件可并行）
 * - 循环依赖检测
 */
export class MiddlewareDependencyGraph {
  /** 所有节点 */
  private _nodes: Map<string, DependencyNode> = new Map()

  /** 依赖边 (from -> Set<to>，表示 from 执行完后 to 可以执行) */
  private _dependencies: Map<string, Set<string>> = new Map()

  /** 缓存的拓扑排序结果 */
  private _cachedOrder: MiddlewareDefinition[][] | null = null

  constructor() {
    this._initLifecycleNodes()
  }

  /** 初始化生命周期节点并建立顺序依赖 */
  private _initLifecycleNodes(): void {
    for (let i = 0; i < LIFECYCLE_PHASES.length; i++) {
      const phase = LIFECYCLE_PHASES[i]
      this._nodes.set(phase, {
        name: phase,
        middleware: null,
        phase: phase
      })
      this._dependencies.set(phase, new Set())

      // 建立生命周期节点间的顺序依赖
      if (i > 0) {
        const prevPhase = LIFECYCLE_PHASES[i - 1]
        this._dependencies.get(prevPhase)!.add(phase)
      }
    }
  }

  /** 注册中间件 */
  register(middleware: MiddlewareDefinition): void {
    this._cachedOrder = null

    const { name, phase, before = [], after = [] } = middleware

    this._nodes.set(name, {
      name,
      middleware,
      phase
    })

    if (!this._dependencies.has(name)) {
      this._dependencies.set(name, new Set())
    }

    // 处理 before 依赖
    for (const target of before) {
      const deps = this._dependencies.get(name) ?? new Set()
      deps.add(target)
      this._dependencies.set(name, deps)
    }

    // 处理 after 依赖
    for (const target of after) {
      const deps = this._dependencies.get(target) ?? new Set()
      deps.add(name)
      this._dependencies.set(target, deps)
    }

    this._addLifecycleConstraints(name, phase)
  }

  /** 注销中间件 */
  unregister(name: string): void {
    this._cachedOrder = null

    this._nodes.delete(name)
    this._dependencies.delete(name)

    for (const deps of this._dependencies.values()) {
      deps.delete(name)
    }
  }

  /** 为中间件添加生命周期约束 */
  private _addLifecycleConstraints(name: string, phase: LifecyclePhase): void {
    const phaseIndex = LIFECYCLE_PHASES.indexOf(phase)

    const deps = this._dependencies.get(phase) ?? new Set()
    deps.add(name)
    this._dependencies.set(phase, deps)

    if (phaseIndex < LIFECYCLE_PHASES.length - 1) {
      const nextPhase = LIFECYCLE_PHASES[phaseIndex + 1]
      const middlewareDeps = this._dependencies.get(name) ?? new Set()
      middlewareDeps.add(nextPhase)
      this._dependencies.set(name, middlewareDeps)
    }
  }

  /**
   * 构建执行顺序（拓扑排序）
   * 返回二维数组，每个内层数组是可以并行执行的中间件
   */
  build(): MiddlewareDefinition[][] {
    if (this._cachedOrder) {
      return this._cachedOrder
    }

    const indegree = new Map<string, number>()
    const tempGraph = new Map<string, Set<string>>()

    for (const name of this._nodes.keys()) {
      indegree.set(name, 0)
      tempGraph.set(name, new Set())
    }

    for (const [from, deps] of this._dependencies.entries()) {
      if (!this._nodes.has(from)) continue

      const depsSet = tempGraph.get(from) ?? new Set()
      for (const to of deps) {
        if (!this._nodes.has(to)) continue
        depsSet.add(to)
        indegree.set(to, (indegree.get(to) ?? 0) + 1)
      }
      tempGraph.set(from, depsSet)
    }

    const levels: MiddlewareDefinition[][] = []
    const visited = new Set<string>()
    let currentLevel: string[] = []

    for (const [name, degree] of indegree.entries()) {
      if (degree === 0) {
        currentLevel.push(name)
      }
    }

    while (currentLevel.length > 0) {
      const levelMiddlewares: MiddlewareDefinition[] = []
      const nextLevel: string[] = []

      for (const current of currentLevel) {
        if (visited.has(current)) continue
        visited.add(current)

        const node = this._nodes.get(current)
        if (node?.middleware) {
          levelMiddlewares.push(node.middleware)
        }

        const successors = tempGraph.get(current) ?? new Set()
        for (const next of successors) {
          const newDegree = indegree.get(next)! - 1
          indegree.set(next, newDegree)
          if (newDegree === 0) {
            nextLevel.push(next)
          }
        }
      }

      if (levelMiddlewares.length > 0) {
        levels.push(levelMiddlewares)
      }
      currentLevel = nextLevel
    }

    // 检测循环依赖
    for (const [node, degree] of indegree.entries()) {
      if (degree > 0) {
        const cycles = this._findAllCycles()
        const relevantCycle = cycles.find(cycle => cycle.includes(node))
        throw new Error(
          `Circular dependency detected involving: ${relevantCycle?.join(' -> ') ?? node}`
        )
      }
    }

    this._cachedOrder = levels
    return levels
  }

  /** 查找所有循环依赖 */
  private _findAllCycles(): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const path: string[] = []

    const dfs = (node: string): void => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), node])
        }
        return
      }

      if (visited.has(node)) return

      visited.add(node)
      recursionStack.add(node)
      path.push(node)

      const deps = this._dependencies.get(node) ?? new Set()
      for (const dep of deps) {
        if (this._nodes.has(dep)) {
          dfs(dep)
        }
      }

      path.pop()
      recursionStack.delete(node)
    }

    for (const node of this._nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node)
      }
    }

    return cycles
  }

  /** 获取所有已注册的中间件 */
  getMiddlewares(): MiddlewareDefinition[] {
    return Array.from(this._nodes.values())
      .filter(node => node.middleware !== null)
      .map(node => node.middleware!)
  }

  /** 检查中间件是否已注册 */
  has(name: string): boolean {
    const node = this._nodes.get(name)
    return node !== undefined && node.middleware !== null
  }

  /** 获取中间件定义 */
  get(name: string): MiddlewareDefinition | undefined {
    return this._nodes.get(name)?.middleware ?? undefined
  }

  /** 清空所有中间件（保留生命周期节点） */
  clear(): void {
    this._cachedOrder = null

    const lifecycleNodes = new Map<string, DependencyNode>()
    const lifecycleDeps = new Map<string, Set<string>>()

    for (const phase of LIFECYCLE_PHASES) {
      lifecycleNodes.set(phase, this._nodes.get(phase)!)
      lifecycleDeps.set(phase, new Set())
    }

    for (let i = 0; i < LIFECYCLE_PHASES.length - 1; i++) {
      lifecycleDeps.get(LIFECYCLE_PHASES[i])!.add(LIFECYCLE_PHASES[i + 1])
    }

    this._nodes = lifecycleNodes
    this._dependencies = lifecycleDeps
  }
}

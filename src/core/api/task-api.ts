// 任务管理 API

import { Context } from 'koishi'
import type { TaskStatus } from '../../plugins/task'
import { getUidFromAuth } from './api-utils'

/**
 * 注册任务管理 API
 */
export function registerTaskApi(ctx: Context): void {
  const console = ctx.console as any

  /** 获取任务服务，如不可用则返回错误响应 */
  const getTaskService = () => {
    const tasks = ctx.mediaLuna.tasks
    if (!tasks) {
      return { error: { success: false, error: 'Task service not available' } }
    }
    return { tasks }
  }

  // 获取任务列表
  console.addListener('media-luna/tasks/list', async (options: {
    uid?: number
    channelId?: number
    status?: TaskStatus
    limit?: number
    offset?: number
  } = {}) => {
    try {
      const { tasks, error } = getTaskService()
      if (error) return error

      const queryOptions = {
        uid: options.uid,
        channelId: options.channelId,
        status: options.status,
        limit: Math.min(options.limit || 50, 100),
        offset: options.offset || 0
      }

      const [list, total] = await Promise.all([
        tasks.query(queryOptions),
        tasks.count({
          uid: queryOptions.uid,
          channelId: queryOptions.channelId,
          status: queryOptions.status
        })
      ])

      return {
        success: true,
        data: {
          items: list,
          total,
          limit: queryOptions.limit,
          offset: queryOptions.offset
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取任务详情
  console.addListener('media-luna/tasks/get', async ({ id }: { id: number }) => {
    try {
      const { tasks, error } = getTaskService()
      if (error) return error

      const task = await tasks.getById(id)
      if (!task) {
        return { success: false, error: 'Task not found' }
      }
      return { success: true, data: task }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 删除任务
  console.addListener('media-luna/tasks/delete', async ({ id }: { id: number }) => {
    try {
      const { tasks, error } = getTaskService()
      if (error) return error

      const deleted = await tasks.delete(id)
      if (!deleted) {
        return { success: false, error: 'Task not found' }
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取任务统计
  console.addListener('media-luna/tasks/stats', async ({ channelId }: { channelId?: number } = {}) => {
    try {
      const { tasks, error } = getTaskService()
      if (error) return error

      const queryOptions = channelId ? { channelId } : {}

      const [total, pending, processing, success, failed] = await Promise.all([
        tasks.count(queryOptions),
        tasks.count({ ...queryOptions, status: 'pending' }),
        tasks.count({ ...queryOptions, status: 'processing' }),
        tasks.count({ ...queryOptions, status: 'success' }),
        tasks.count({ ...queryOptions, status: 'failed' })
      ])

      return {
        success: true,
        data: {
          total,
          byStatus: { pending, processing, success, failed },
          successRate: total > 0 ? (success / total * 100).toFixed(2) + '%' : '0%'
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 清理旧任务
  console.addListener('media-luna/tasks/cleanup', async ({ days }: { days?: number } = {}) => {
    try {
      const { tasks, error } = getTaskService()
      if (error) return error

      const cleanupDays = days ?? 30
      if (cleanupDays < 1) {
        return { success: false, error: 'Days must be at least 1' }
      }

      const beforeDate = new Date()
      beforeDate.setDate(beforeDate.getDate() - cleanupDays)

      const count = await tasks.cleanup(beforeDate)

      return {
        success: true,
        data: {
          deleted: count,
          beforeDate: beforeDate.toISOString()
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取用户最近的任务
  console.addListener('media-luna/tasks/recent', async function (this: any, { uid, limit }: { uid?: number, limit?: number }) {
    try {
      const { tasks, error } = getTaskService()
      if (error) return error

      // 如果没有传入 uid，使用 session 或 webui-auth 的 uid
      const effectiveUid = uid ?? getUidFromAuth(ctx, this.auth)
      if (!effectiveUid) {
        return { success: false, error: 'User ID required (not logged in or not bound)' }
      }

      const list = await tasks.getRecentByUid(effectiveUid, Math.min(limit || 10, 100))
      return { success: true, data: list }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取当前登录用户的任务（自动使用 session uid 或 webui-auth 绑定的 uid）
  console.addListener('media-luna/tasks/my', async function (this: any, options: {
    channelId?: number
    status?: TaskStatus
    limit?: number
    offset?: number
  } = {}) {
    try {
      const uid = getUidFromAuth(ctx, this.auth)
      if (!uid) {
        return { success: false, error: 'Not logged in or not bound' }
      }

      const { tasks, error } = getTaskService()
      if (error) return error

      const queryOptions = {
        uid,
        channelId: options.channelId,
        status: options.status,
        limit: Math.min(options.limit || 50, 100),
        offset: options.offset || 0
      }

      const [list, total] = await Promise.all([
        tasks.query(queryOptions),
        tasks.count({
          uid: queryOptions.uid,
          channelId: queryOptions.channelId,
          status: queryOptions.status
        })
      ])

      return {
        success: true,
        data: {
          items: list,
          total,
          limit: queryOptions.limit,
          offset: queryOptions.offset
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取当前用户信息（用于前端判断登录/绑定状态）
  console.addListener('media-luna/auth/me', async function (this: any) {
    // 检查 @koishijs/plugin-auth 登录
    if (this.auth?.id) {
      return {
        success: true,
        data: {
          loggedIn: true,
          source: 'auth-plugin',
          uid: this.auth.id,
          name: this.auth.name,
          authority: this.auth.authority
        }
      }
    }

    // 检查 webui-auth 绑定
    const uid = getUidFromAuth(ctx, null)
    if (uid) {
      return {
        success: true,
        data: {
          loggedIn: true,
          source: 'webui-auth',
          uid
        }
      }
    }

    return { success: true, data: { loggedIn: false } }
  })

  // ============ 画廊 API ============

  // 获取当前用户的生成画廊（仅成功的任务）
  console.addListener('media-luna/gallery/my', async function (this: any, options: {
    limit?: number
    offset?: number
    channelId?: number
  } = {}) {
    try {
      const uid = getUidFromAuth(ctx, this.auth)
      if (!uid) {
        return { success: false, error: 'Not logged in or not bound' }
      }

      const { tasks, error } = getTaskService()
      if (error) return error

      const result = await tasks.getUserGallery(uid, {
        limit: options.limit,
        offset: options.offset,
        channelId: options.channelId
      })

      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取当前用户最近生成的图片（扁平化列表）
  console.addListener('media-luna/gallery/recent-images', async function (this: any, { limit }: { limit?: number } = {}) {
    try {
      const uid = getUidFromAuth(ctx, this.auth)
      if (!uid) {
        return { success: false, error: 'Not logged in or not bound' }
      }

      const { tasks, error } = getTaskService()
      if (error) return error

      const images = await tasks.getUserRecentImages(uid, limit || 20)
      return { success: true, data: images }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取指定用户的画廊（管理员用）
  console.addListener('media-luna/gallery/user', async (options: {
    uid: number
    limit?: number
    offset?: number
    channelId?: number
  }) => {
    try {
      if (!options.uid) {
        return { success: false, error: 'User ID required' }
      }

      const { tasks, error } = getTaskService()
      if (error) return error

      const result = await tasks.getUserGallery(options.uid, {
        limit: options.limit,
        offset: options.offset,
        channelId: options.channelId
      })

      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
}

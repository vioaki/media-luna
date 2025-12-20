// WebUI 认证服务

import type { WebuiAuthConfig } from './config'
import type { PluginContext } from '../../core'

/** 待验证的绑定请求 */
interface PendingBind {
  uid: number
  code: string
  expireAt: number
}

/**
 * WebUI 认证服务
 *
 * 管理 WebUI 与 Koishi 用户的绑定
 */
export class WebuiAuthService {
  private _pluginCtx: PluginContext
  private _pendingBinds: Map<string, PendingBind> = new Map()
  private _cleanupTimer: NodeJS.Timeout | null = null

  constructor(pluginCtx: PluginContext) {
    this._pluginCtx = pluginCtx

    // 定期清理过期的验证码
    this._cleanupTimer = setInterval(() => this._cleanup(), 60000)

    pluginCtx.onDispose(() => {
      if (this._cleanupTimer) {
        clearInterval(this._cleanupTimer)
        this._cleanupTimer = null
      }
    })
  }

  /** 生成 6 位验证码 */
  private _generateCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  /** 清理过期的验证码 */
  private _cleanup(): void {
    const now = Date.now()
    for (const [code, bind] of this._pendingBinds) {
      if (bind.expireAt < now) {
        this._pendingBinds.delete(code)
      }
    }
  }

  /**
   * 创建绑定验证码（用户在聊天平台发起 /bindui）
   * 验证码输出到日志，返回验证码供内部使用
   */
  createBindCode(uid: number): string {
    const logger = this._pluginCtx.ctx.logger('webui-auth')
    logger.info('Start generating code for uid: %d', uid)

    try {
      const config = this._pluginCtx.getConfig<WebuiAuthConfig>()
      const code = this._generateCode()
      const expiry = (config.codeExpiry || 300) * 1000

      const bind: PendingBind = {
        uid,
        code,
        expireAt: Date.now() + expiry
      }

      this._pendingBinds.set(code, bind)

      // 验证码输出到日志（INFO 级别）
      logger.info('='.repeat(50))
      logger.info(`WebUI 绑定验证码: ${code}`)
      logger.info(`目标用户 uid: ${uid}`)
      logger.info(`有效期: ${config.codeExpiry || 300} 秒`)
      logger.info('='.repeat(50))

      return code
    } catch (e) {
      logger.error('Error generating code: %s', e)
      throw e
    }
  }

  /**
   * 验证并绑定
   * 用户在聊天平台输入验证码后调用
   */
  verifyCodeAndBind(inputCode: string, expectedUid: number): { success: boolean; error?: string } {
    const logger = this._pluginCtx.ctx.logger('webui-auth')
    const normalizedCode = inputCode.trim().toUpperCase()
    const bind = this._pendingBinds.get(normalizedCode)

    if (!bind) {
      return { success: false, error: '验证码无效' }
    }

    if (bind.expireAt < Date.now()) {
      this._pendingBinds.delete(normalizedCode)
      return { success: false, error: '验证码已过期' }
    }

    // 验证 uid 是否匹配
    if (bind.uid !== expectedUid) {
      return { success: false, error: '验证码与当前用户不匹配' }
    }

    // 验证成功，删除验证码
    this._pendingBinds.delete(normalizedCode)

    // 保存到配置
    this._pluginCtx.updateConfig({ uid: bind.uid })

    logger.info('WebUI 绑定成功: uid=%d', bind.uid)

    return { success: true }
  }

  /**
   * 获取当前绑定的 uid
   */
  getUid(): number | null {
    const config = this._pluginCtx.getConfig<WebuiAuthConfig>()
    return config.uid ?? null
  }

  /**
   * 直接设置 uid（管理员手动配置）
   */
  setUid(uid: number | null): void {
    const logger = this._pluginCtx.ctx.logger('webui-auth')
    this._pluginCtx.updateConfig({ uid })
    logger.info('WebUI uid 已更新: %s', uid ?? '(清除)')
  }

  /**
   * 清除绑定
   */
  clearBind(): void {
    const logger = this._pluginCtx.ctx.logger('webui-auth')
    this._pluginCtx.updateConfig({ uid: null })
    logger.info('WebUI 绑定已清除')
  }
}

// 计费中间件

import { Context } from 'koishi'
import type {
  MiddlewareDefinition,
  MiddlewareContext,
  MiddlewareRunStatus
} from '../../core'
import type { BillingConfig } from './config'
import { billingCardFields } from './config'

// Store keys for passing data between prepare and finalize phases
const STORE_KEY = 'billing:charged'
const STORE_AMOUNT_KEY = 'billing:amount'
const STORE_USER_KEY = 'billing:userId'
const STORE_CURRENCY_KEY = 'billing:currencyValue'

/** 获取用户 ID（通过 Koishi binding 表查询） */
async function resolveUserId(
  ctx: Context,
  mctx: MiddlewareContext
): Promise<number | null> {
  // 优先使用 mctx.uid（来自生成请求）
  if (mctx.uid) {
    return mctx.uid
  }

  // 否则从 session 解析
  if (!mctx.session) return null

  try {
    const bindings = await ctx.database.get('binding', {
      platform: mctx.session.platform,
      pid: mctx.session.userId
    })
    return bindings[0]?.aid ?? null
  } catch {
    return null
  }
}

/**
 * 获取有效配置值（渠道覆盖 > 全局配置）
 */
function getEffectiveValue<T>(
  config: BillingConfig | null,
  mctx: MiddlewareContext,
  key: keyof BillingConfig
): T | undefined {
  // 先检查渠道覆盖配置
  const override = mctx.channel?.pluginOverrides?.billing?.[key]
  if (override !== undefined && override !== null && override !== '') {
    return override as T
  }
  // 回退到全局配置
  return config?.[key] as T | undefined
}

/** 构建查询条件 */
function buildQueryCondition(
  config: BillingConfig,
  userId: number | string,
  currencyValue: string
): Record<string, any> {
  const condition: Record<string, any> = {
    [config.userIdField]: userId
  }

  if (config.currencyField) {
    condition[config.currencyField] = currencyValue
  }

  return condition
}

/** 查询用户余额 */
async function getBalance(
  ctx: Context,
  config: BillingConfig,
  userId: number | string,
  currencyValue: string
): Promise<number> {
  try {
    const condition = buildQueryCondition(config, userId, currencyValue)
    const rows = await ctx.database.get(config.tableName as any, condition)

    if (rows.length === 0) return 0
    return Number((rows[0] as any)[config.balanceField]) || 0
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    if (errMsg.includes('cannot resolve table')) {
      throw new Error(`表 "${config.tableName}" 未被声明。请确保已安装并启用声明该表的插件（如 koishi-plugin-monetary）`)
    }
    throw new Error(`查询余额失败: ${errMsg}`)
  }
}

/** 更新用户余额 */
async function updateBalance(
  ctx: Context,
  config: BillingConfig,
  userId: number | string,
  delta: number,
  currencyValue: string
): Promise<void> {
  try {
    const condition = buildQueryCondition(config, userId, currencyValue)
    const balanceField = config.balanceField

    await ctx.database.set(config.tableName as any, condition, (row: any) => ({
      [balanceField]: { $add: [row[balanceField], delta] }
    }))
  } catch (e) {
    throw new Error(`更新余额失败: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * 创建预扣费中间件
 * 在 lifecycle-prepare 阶段检查余额并扣费
 */
export function createBillingPrepareMiddleware(): MiddlewareDefinition {
  return {
    name: 'billing-prepare',
    displayName: '预扣费',
    description: '在生成前检查余额并扣费',
    category: 'billing',
    phase: 'lifecycle-prepare',
    configGroup: 'billing',
    cardFields: billingCardFields,

    async execute(mctx: MiddlewareContext, next): Promise<MiddlewareRunStatus> {
      const config = await mctx.getMiddlewareConfig<BillingConfig>('billing')

      // 获取有效的费用（渠道覆盖 > 全局配置）
      const cost = getEffectiveValue<number>(config, mctx, 'cost') ?? 0

      // cost = 0 表示免费渠道，跳过计费检查
      if (cost <= 0) {
        mctx.setMiddlewareLog('billing-prepare', { skipped: true, reason: 'free channel', cost })
        return next()
      }

      // 以下为严格模式：cost > 0 时必须满足所有条件才能继续

      // 检查数据库配置是否完整
      if (!config?.tableName || !config?.userIdField || !config?.balanceField) {
        const missing = []
        if (!config?.tableName) missing.push('tableName')
        if (!config?.userIdField) missing.push('userIdField')
        if (!config?.balanceField) missing.push('balanceField')
        mctx.setMiddlewareLog('billing-prepare', {
          error: true,
          reason: 'database config missing',
          missing
        })
        throw new Error(`计费配置不完整，缺少: ${missing.join(', ')}`)
      }

      // 解析用户 ID
      const userId = await resolveUserId(mctx.ctx, mctx)
      if (!userId) {
        mctx.setMiddlewareLog('billing-prepare', { error: true, reason: 'no user id' })
        throw new Error('无法识别用户身份，请先绑定账号')
      }

      // 获取有效的货币类型（渠道覆盖 > 全局配置）
      const currencyValue = getEffectiveValue<string>(config, mctx, 'currencyValue') ?? 'default'
      const currencyLabel = config.currencyLabel || '积分'

      try {
        // 查询余额
        const balance = await getBalance(mctx.ctx, config, userId, currencyValue)

        // 检查余额是否充足
        if (balance < cost) {
          mctx.setMiddlewareLog('billing-prepare', {
            error: true,
            reason: 'insufficient balance',
            balance,
            required: cost,
            currency: currencyValue
          })
          throw new Error(`余额不足：需要 ${cost} ${currencyLabel}，当前余额 ${balance} ${currencyLabel}`)
        }

        // 扣费
        await updateBalance(mctx.ctx, config, userId, -cost, currencyValue)

        // 记录扣费信息到 store，供 finalize 阶段使用
        mctx.store.set(STORE_KEY, true)
        mctx.store.set(STORE_AMOUNT_KEY, cost)
        mctx.store.set(STORE_USER_KEY, userId)
        mctx.store.set(STORE_CURRENCY_KEY, currencyValue)

        mctx.setMiddlewareLog('billing-prepare', {
          charged: cost,
          userId,
          currency: currencyValue,
          balanceBefore: balance,
          balanceAfter: balance - cost
        })

        return next()
      } catch (error) {
        mctx.setMiddlewareLog('billing-prepare', {
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    }
  }
}

/**
 * 创建计费结算中间件
 * 在 lifecycle-finalize 阶段处理失败退款
 */
export function createBillingFinalizeMiddleware(): MiddlewareDefinition {
  return {
    name: 'billing-finalize',
    displayName: '计费结算',
    description: '生成失败时自动退款',
    category: 'billing',
    phase: 'lifecycle-finalize',
    configGroup: 'billing',

    async execute(mctx: MiddlewareContext, next): Promise<MiddlewareRunStatus> {
      const config = await mctx.getMiddlewareConfig<BillingConfig>('billing')

      // 检查是否已扣费
      const wasCharged = mctx.store.get(STORE_KEY)
      if (!wasCharged) {
        return next()
      }

      const chargedAmount = mctx.store.get(STORE_AMOUNT_KEY) as number
      const storedUserId = mctx.store.get(STORE_USER_KEY) as number
      const currencyValue = mctx.store.get(STORE_CURRENCY_KEY) as string

      // 判断生成是否成功
      const isSuccess = mctx.output && mctx.output.length > 0

      if (isSuccess) {
        // 生成成功，确认扣费
        mctx.setMiddlewareLog('billing-finalize', {
          confirmed: chargedAmount,
          userId: storedUserId,
          currency: currencyValue
        })
      } else if (config?.refundOnFail !== false) {
        // 生成失败且启用了失败退款，执行退款
        try {
          await updateBalance(mctx.ctx, config!, storedUserId, chargedAmount, currencyValue)
          mctx.setMiddlewareLog('billing-finalize', {
            refunded: chargedAmount,
            reason: 'generation failed',
            userId: storedUserId,
            currency: currencyValue
          })
        } catch (error) {
          mctx.setMiddlewareLog('billing-finalize', {
            refundFailed: true,
            amount: chargedAmount,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      } else {
        // 生成失败但未启用退款
        mctx.setMiddlewareLog('billing-finalize', {
          noRefund: true,
          reason: 'refundOnFail disabled',
          charged: chargedAmount,
          userId: storedUserId,
          currency: currencyValue
        })
      }

      return next()
    }
  }
}

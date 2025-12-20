// 计费插件入口

import { definePlugin } from '../../core'
import { createBillingPrepareMiddleware, createBillingFinalizeMiddleware } from './middleware'
import { billingConfigFields, defaultBillingConfig } from './config'

export default definePlugin({
  id: 'billing',
  name: '计费管理',
  description: '用户余额扣费和退款支持',
  version: '1.0.0',

  middlewares: [
    createBillingPrepareMiddleware(),
    createBillingFinalizeMiddleware()
  ],

  configFields: billingConfigFields,
  configDefaults: defaultBillingConfig,

  async onLoad(pluginCtx) {
    pluginCtx.logger.info('Billing plugin loaded')
  }
})

// 导出类型
export type { BillingConfig } from './config'

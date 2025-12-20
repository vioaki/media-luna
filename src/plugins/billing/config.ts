// 计费插件配置字段定义

import type { ConfigField, CardField } from '../../core'

/** 计费配置 */
export interface BillingConfig {
  // 数据库配置
  tableName: string
  userIdField: string
  balanceField: string
  currencyField: string

  // 计费行为配置
  refundOnFail: boolean
  currencyLabel: string

  // 渠道级配置（可在渠道中覆盖）
  cost: number
  currencyValue: string
}

/** 计费配置字段 */
export const billingConfigFields: ConfigField[] = [
  // 数据库配置
  {
    key: 'tableName',
    label: '数据库表名',
    type: 'text',
    default: 'monetary',
    placeholder: 'monetary',
    description: '存储用户余额的数据库表名'
  },
  {
    key: 'userIdField',
    label: '用户 ID 字段',
    type: 'text',
    default: 'uid',
    placeholder: 'uid',
    description: '表中用于查询的用户 ID 字段名（对应 Koishi binding 表的 aid）'
  },
  {
    key: 'balanceField',
    label: '余额字段',
    type: 'text',
    default: 'value',
    placeholder: 'value',
    description: '表中存储余额数值的字段名'
  },
  {
    key: 'currencyField',
    label: '货币类型字段',
    type: 'text',
    default: 'currency',
    placeholder: 'currency',
    description: '表中货币类型的字段名（留空表示不区分货币类型）'
  },
  {
    key: 'currencyLabel',
    label: '货币显示名称',
    type: 'text',
    default: '积分',
    placeholder: '积分',
    description: '余额的货币单位名称（用于提示信息）'
  },
  {
    key: 'refundOnFail',
    label: '失败自动退款',
    type: 'boolean',
    default: true,
    description: '生成失败时自动退还已扣费用'
  },

  // 渠道级配置（可在渠道配置中覆盖）
  {
    key: 'cost',
    label: '单次费用',
    type: 'number',
    default: 0,
    description: '每次生成消耗的费用（0 表示免费）'
  },
  {
    key: 'currencyValue',
    label: '货币类型',
    type: 'text',
    default: 'default',
    placeholder: 'default',
    description: '使用的货币类型值'
  }
]

/** 计费卡片展示字段 */
export const billingCardFields: CardField[] = [
  {
    source: 'pluginOverride',
    configGroup: 'billing',
    key: 'cost',
    label: '费用',
    format: 'number',
    suffix: '/次'
  },
  {
    source: 'pluginOverride',
    configGroup: 'billing',
    key: 'currencyValue',
    label: '货币',
    format: 'text'
  }
]

/** 默认计费配置 */
export const defaultBillingConfig: BillingConfig = {
  tableName: 'monetary',
  userIdField: 'uid',
  balanceField: 'value',
  currencyField: 'currency',
  refundOnFail: true,
  currencyLabel: '积分',
  cost: 0,
  currencyValue: 'default'
}

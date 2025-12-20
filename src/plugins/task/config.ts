// 任务记录插件配置

import type { ConfigField } from '../../core'

/** 任务记录配置 */
export interface TaskPluginConfig {
  /** 是否启用 */
  enabled: boolean
  /** 自动清理 */
  autoCleanup: boolean
  /** 保留天数 */
  retentionDays: number
}

/** 配置字段定义 */
export const taskConfigFields: ConfigField[] = [
  {
    key: 'enabled',
    label: '启用任务记录',
    type: 'boolean',
    default: true,
    description: '记录每次生成任务的详细信息'
  },
  {
    key: 'autoCleanup',
    label: '自动清理',
    type: 'boolean',
    default: false,
    description: '自动删除过期的任务记录'
  },
  {
    key: 'retentionDays',
    label: '保留天数',
    type: 'number',
    default: 30,
    description: '任务记录保留天数',
    showWhen: { field: 'autoCleanup', value: true }
  }
]

/** 默认配置 */
export const defaultTaskConfig: TaskPluginConfig = {
  enabled: true,
  autoCleanup: false,
  retentionDays: 30
}

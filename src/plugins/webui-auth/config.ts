// WebUI 认证插件配置

import type { ConfigField } from '../../core'

export interface WebuiAuthConfig {
  /** 直接配置的 uid（简单模式） */
  uid: number | null
  /** 验证码有效期（秒） */
  codeExpiry: number
  /** 绑定指令名称 */
  commandName: string
}

export const webuiAuthConfigFields: ConfigField[] = [
  {
    key: 'uid',
    label: '绑定的用户 ID',
    type: 'number',
    description: '直接填写 Koishi 用户 ID（uid），或通过指令绑定',
    placeholder: '留空则需要通过指令绑定'
  },
  {
    key: 'commandName',
    label: '绑定指令名称',
    type: 'text',
    default: 'bindui',
    description: '在聊天平台发送此指令生成验证码'
  },
  {
    key: 'codeExpiry',
    label: '验证码有效期',
    type: 'number',
    default: 300,
    description: '验证码有效期（秒），默认 5 分钟'
  }
]

export const defaultWebuiAuthConfig: WebuiAuthConfig = {
  uid: null,
  codeExpiry: 300,
  commandName: 'bindui'
}

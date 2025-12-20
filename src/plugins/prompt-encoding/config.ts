// Prompt Encoding 插件配置

import { ConfigField } from '../../types'

/**
 * Prompt 编码配置
 */
export interface PromptEncodingConfig {
  /** 是否启用 Unicode 编码 */
  enableUnicodeEscape: boolean

  /** 编码范围：仅中文/仅非ASCII/全部 */
  encodeRange: 'chinese' | 'non-ascii' | 'all'

  /** 编码格式 */
  escapeFormat: 'unicode' | 'html-entity' | 'url-encode'

  /** 是否添加解码提示 */
  addDecodeHint: boolean

  /** 解码提示模板 */
  decodeHintTemplate: string
}

/**
 * 默认配置
 */
export const defaultPromptEncodingConfig: PromptEncodingConfig = {
  enableUnicodeEscape: false,
  encodeRange: 'chinese',
  escapeFormat: 'unicode',
  addDecodeHint: true,
  decodeHintTemplate: '[Note: The following prompt contains Unicode escape sequences. Please decode and process naturally.]\n\n'
}

/**
 * 配置字段定义
 */
export const promptEncodingConfigFields: ConfigField[] = [
  {
    key: 'enableUnicodeEscape',
    label: '启用 Unicode 编码',
    type: 'boolean',
    default: false,
    description: '将文本转换为 Unicode 转义序列以绕过内容审核'
  },
  {
    key: 'encodeRange',
    label: '编码范围',
    type: 'select',
    default: 'chinese',
    options: [
      { label: '仅中文字符', value: 'chinese' },
      { label: '所有非 ASCII 字符', value: 'non-ascii' },
      { label: '全部字符', value: 'all' }
    ],
    description: '选择要编码的字符范围'
  },
  {
    key: 'escapeFormat',
    label: '编码格式',
    type: 'select',
    default: 'unicode',
    options: [
      { label: 'Unicode (\\uXXXX)', value: 'unicode' },
      { label: 'HTML 实体 (&#xXXXX;)', value: 'html-entity' },
      { label: 'URL 编码 (%XX)', value: 'url-encode' }
    ],
    description: '转义序列的格式'
  },
  {
    key: 'addDecodeHint',
    label: '添加解码提示',
    type: 'boolean',
    default: true,
    description: '在编码文本前添加提示，帮助 AI 理解编码内容'
  },
  {
    key: 'decodeHintTemplate',
    label: '解码提示模板',
    type: 'textarea',
    default: '[Note: The following prompt contains Unicode escape sequences. Please decode and process naturally.]\n\n',
    description: '自定义解码提示文本'
  }
]

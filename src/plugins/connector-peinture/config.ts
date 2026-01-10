// Peinture (派奇智图) 连接器配置

import type { ConnectorField, CardDisplayField } from '../../core'

/** 模型选项 */
export const modelOptions = [
  // Text2Image 模型
  { value: 'huggingface/z-image-turbo', label: 'Z-Image Turbo', group: 'text2image' },
  { value: 'huggingface/qwen-image', label: 'Qwen Image', group: 'text2image' },
  { value: 'huggingface/ovis-image', label: 'Ovis Image', group: 'text2image' },
  { value: 'huggingface/flux-1-schnell', label: 'FLUX.1 Schnell', group: 'text2image' },
  // Image2Image 模型
  { value: 'huggingface/qwen-image-edit', label: 'Qwen Image Edit', group: 'image2image' },
  // Upscaler 模型
  { value: 'huggingface/realesrgan', label: 'RealESRGAN x4 Plus', group: 'upscaler' },
  // Image2Video 模型
  { value: 'huggingface/wan2.2-i2v', label: 'Wan2.2 I2V', group: 'image2video' }
]

/** 宽高比选项 */
export const aspectRatioOptions = [
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '16:9', label: '16:9 (横向)' },
  { value: '9:16', label: '9:16 (竖向)' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' }
]

/** Peinture 配置字段 */
export const connectorFields: ConnectorField[] = [
  {
    key: 'apiUrl',
    label: 'API URL',
    type: 'text',
    required: true,
    default: 'https://peinture.u14.app/api/v1/generate',
    placeholder: 'https://peinture.u14.app/api/v1/generate',
    description: 'Peinture API 端点'
  },
  {
    key: 'apiKey',
    label: 'API Key（可选）',
    type: 'password',
    description: '可选的 API Key，用于认证'
  },
  {
    key: 'model',
    label: '模型',
    type: 'combobox',
    required: true,
    default: 'huggingface/flux-1-schnell',
    placeholder: '选择预设模型或输入模型 ID',
    options: modelOptions,
    description: '图像生成模型'
  },
  {
    key: 'aspectRatio',
    label: '宽高比',
    type: 'combobox',
    placeholder: '选择预设或输入自定义比例',
    options: aspectRatioOptions,
    description: '生成图像的宽高比'
  },
  {
    key: 'steps',
    label: '步数',
    type: 'number',
    description: '生成步数，不同模型有不同范围'
  },
  {
    key: 'guidance',
    label: '引导强度',
    type: 'number',
    description: '引导强度/CFG Scale，部分模型支持'
  },
  {
    key: 'timeout',
    label: '超时时间（秒）',
    type: 'number',
    default: 120
  }
]

/** 卡片展示字段 */
export const connectorCardFields: CardDisplayField[] = [
  { source: 'connectorConfig', key: 'model', label: '模型' },
  { source: 'connectorConfig', key: 'aspectRatio', label: '宽高比' }
]

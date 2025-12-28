// Stability AI 连接器
// 基于 Stable Image API (v2beta)
// 文档: https://platform.stability.ai/docs/api-reference

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

/** Stability AI 生成函数 */
async function generate(
  ctx: Context,
  config: Record<string, any>,
  files: FileData[],
  prompt: string
): Promise<OutputAsset[]> {
  const {
    apiKey,
    model,
    aspectRatio,
    negativePrompt,
    seed,
    outputFormat,
    timeout = 60
  } = config

  if (!model) {
    throw new Error('模型未配置')
  }

  // 根据模型选择 Endpoint
  // Stable Image Core 使用不同端点
  let apiUrl = 'https://api.stability.ai/v2beta/stable-image/generate/sd3'
  if (model === 'core') {
    apiUrl = 'https://api.stability.ai/v2beta/stable-image/generate/core'
  } else if (model.includes('ultra')) {
    apiUrl = 'https://api.stability.ai/v2beta/stable-image/generate/ultra'
  }

  // 构建 FormData
  const formData = new FormData()
  formData.append('prompt', prompt)

  // 可选参数 - 仅在配置时发送
  if (aspectRatio) formData.append('aspect_ratio', aspectRatio)
  if (outputFormat) formData.append('output_format', outputFormat)
  if (negativePrompt) formData.append('negative_prompt', negativePrompt)
  if (seed !== undefined && seed !== null && seed !== '' && seed !== 0) formData.append('seed', seed.toString())

  // 处理垫图 (Image-to-Image)
  // SD3 API 支持 mode: 'image-to-image' 和 image 参数
  const imageFile = files.find(f => f.mime.startsWith('image/'))
  if (imageFile) {
    formData.append('image', new Blob([imageFile.data], { type: imageFile.mime }))
    formData.append('mode', 'image-to-image')
    formData.append('strength', '0.7') // 默认去噪强度
  } else {
    formData.append('mode', 'text-to-image')
  }

  // 必须指定 model 参数
  if (model !== 'core' && !model.includes('ultra')) {
    formData.append('model', model)
  }

  try {
    const response = await ctx.http.post(apiUrl, formData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'image/*' // 请求直接返回图片二进制数据
      },
      responseType: 'arraybuffer',
      timeout: timeout * 1000
    })

    // 检查响应类型
    // 如果 Accept 是 image/*，成功时直接返回二进制图片
    // 失败时通常返回 JSON

    // Stability AI v2beta 直接返回图片数据
    const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
    const base64 = Buffer.from(response).toString('base64')

    return [{
      kind: 'image',
      url: `data:${mimeType};base64,${base64}`,
      mime: mimeType,
      meta: {
        model,
        aspectRatio,
        seed
      }
    }]

  } catch (e: any) {
    // 尝试解析错误 JSON
    if (e.response?.data) {
      try {
        const errorText = Buffer.from(e.response.data).toString()
        const errorJson = JSON.parse(errorText)
        if (errorJson.errors) {
          throw new Error(`Stability AI Error: ${errorJson.errors.map((err: any) => err.message).join(', ')}`)
        }
      } catch {
        // ignore
      }
    }
    throw e
  }
}

/** Stability AI 连接器定义 */
export const StabilityConnector: ConnectorDefinition = {
  id: 'stability',
  name: 'Stability AI',
  description: 'Stability AI 官方 API，支持 SD3/Ultra 等高端模型',
  icon: 'stability',
  supportedTypes: ['image'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2img', 'img2img', 'text2video', 'img2video'],
  generate,

  getRequestLog(config, files, prompt): ConnectorRequestLog {
    const { model, aspectRatio } = config
    return {
      endpoint: 'api.stability.ai',
      model,
      prompt,
      fileCount: files.length,
      parameters: {
        aspectRatio
      }
    }
  }
}

// Peinture (派奇智图) 连接器

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

/** Peinture API 响应格式 */
interface PeintureResponse {
  url: string
  width?: number
  height?: number
  seed?: number
  steps?: number
  guidance?: number
}

/** Peinture 生成函数 */
async function generate(
  ctx: Context,
  config: Record<string, any>,
  files: FileData[],
  prompt: string
): Promise<OutputAsset[]> {
  const {
    apiUrl,
    apiKey,
    model,
    aspectRatio,
    steps,
    guidance,
    timeout = 120
  } = config

  if (!model) {
    throw new Error('模型未配置')
  }

  // 构建请求体
  const requestBody: Record<string, any> = {
    model,
    prompt
  }

  // 仅在配置了值时才添加参数
  if (aspectRatio) {
    requestBody.ar = aspectRatio
  }
  if (steps !== undefined && steps !== null) {
    requestBody.steps = Number(steps)
  }
  if (guidance !== undefined && guidance !== null) {
    requestBody.guidance = Number(guidance)
  }

  // 构建请求头
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  // 如果配置了 API Key，添加认证头
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  try {
    const response = await ctx.http.post<PeintureResponse>(apiUrl, requestBody, {
      headers,
      timeout: timeout * 1000
    })

    if (!response.url) {
      throw new Error('No image URL in response')
    }

    // 从 URL 推断 MIME 类型
    let mime = 'image/png'
    const urlLower = response.url.toLowerCase()
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) {
      mime = 'image/jpeg'
    } else if (urlLower.includes('.webp')) {
      mime = 'image/webp'
    }

    return [{
      kind: 'image',
      url: response.url,
      mime,
      meta: {
        model,
        aspectRatio,
        width: response.width,
        height: response.height,
        seed: response.seed,
        steps: response.steps,
        guidance: response.guidance
      }
    }]
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Peinture API error: ${error.message}`)
    }
    throw error
  }
}

/** Peinture 连接器定义 */
export const PeintureConnector: ConnectorDefinition = {
  id: 'peinture',
  name: 'Peinture 派奇智图',
  description: 'Linux.do 社区开源项目派奇智图，支持 Flux 等多种模型',
  icon: 'default-image',
  supportedTypes: ['image'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2img'],
  generate,

  /** 获取请求日志 */
  getRequestLog(config, files, prompt): ConnectorRequestLog {
    const { apiUrl, model, aspectRatio, steps, guidance } = config

    const parameters: Record<string, any> = {}
    if (aspectRatio) parameters.aspectRatio = aspectRatio
    if (steps !== undefined && steps !== null) parameters.steps = steps
    if (guidance !== undefined && guidance !== null) parameters.guidance = guidance

    return {
      endpoint: apiUrl?.split('?')[0],
      model,
      prompt,
      fileCount: files.length,
      parameters
    }
  }
}

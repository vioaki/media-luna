// DALL-E 连接器

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

/** DALL-E 生成函数 */
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
    size,
    quality,
    style,
    n,
    enableImageInput = true,
    timeout = 600
  } = config

  if (!model) {
    throw new Error('模型名称未配置')
  }

  const requestBody: Record<string, any> = {
    model,
    prompt
  }

  // 仅在配置了值时才添加参数
  if (n !== undefined && n !== null) requestBody.n = Number(n)
  if (size) requestBody.size = size
  if (quality) requestBody.quality = quality
  if (style) requestBody.style = style

  // 处理图片输入（如果启用且有图片）
  if (enableImageInput && files.length > 0) {
    const imageFiles = files.filter(f => f.mime.startsWith('image/'))
    if (imageFiles.length > 0) {
      // 将图片转为 base64 数组
      const imageArray: string[] = imageFiles.map(imageFile => {
        const base64 = Buffer.from(imageFile.data).toString('base64')
        return `data:${imageFile.mime};base64,${base64}`
      })
      requestBody.image = imageArray
      ctx.logger('media-luna').debug(`DALL-E: Added ${imageArray.length} reference image(s)`)
    }
  }

  const response = await ctx.http.post(apiUrl, requestBody, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: timeout * 1000
  })

  if (!response.data || !Array.isArray(response.data)) {
    throw new Error('Invalid response from DALL-E API')
  }

  return response.data.map((item: any) => {
    let url: string
    if (item.url) {
      url = item.url
    } else if (item.b64_json) {
      // b64_json 是原始 base64 字符串，需要加上 data URL 前缀
      url = `data:image/png;base64,${item.b64_json}`
    } else {
      throw new Error('No image data in response')
    }

    return {
      kind: 'image' as const,
      url,
      mime: 'image/png',
      meta: {
        revisedPrompt: item.revised_prompt
      }
    }
  })
}

/** DALL-E 连接器定义 */
export const DalleConnector: ConnectorDefinition = {
  id: 'dalle',
  name: 'DALL-E',
  description: 'OpenAI 图像生成模型，支持 DALL-E 3 高质量图像创作',
  icon: 'dalle',
  supportedTypes: ['image'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2img', 'img2img'],
  generate,

  /** 获取请求日志 */
  getRequestLog(config, files, prompt): ConnectorRequestLog {
    const {
      apiUrl,
      model,
      size,
      quality,
      style,
      n,
      enableImageInput = true
    } = config

    // 计算实际会发送的图片数量
    const imageCount = enableImageInput
      ? files.filter(f => f.mime?.startsWith('image/')).length
      : 0

    // 只记录实际配置的参数
    const parameters: Record<string, any> = {}
    if (size) parameters.size = size
    if (quality) parameters.quality = quality
    if (style) parameters.style = style
    if (n !== undefined && n !== null) parameters.n = Number(n)
    if (imageCount > 0) parameters.imageInput = true

    return {
      endpoint: apiUrl?.split('?')[0],
      model,
      prompt,
      fileCount: imageCount,
      parameters
    }
  }
}

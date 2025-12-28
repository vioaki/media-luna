// 豆包/火山引擎 Seedream 连接器

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

/** 豆包生成函数 */
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
    scale,
    forceSingle,
    optimizePromptMode,
    enableImageBase64,
    enableImageOriginData,
    enableImageInput = true,
    timeout = 600
  } = config

  if (!model) {
    throw new Error('模型名称未配置')
  }

  // 构建 input 对象
  const input: Record<string, any> = {
    prompt
  }

  // 处理图片输入（如果启用且有图片）
  if (enableImageInput && files.length > 0) {
    const imageFiles = files.filter(f => f.mime.startsWith('image/'))
    if (imageFiles.length > 0) {
      if (imageFiles.length === 1) {
        // 单张图片用字符串
        const base64 = Buffer.from(imageFiles[0].data).toString('base64')
        input.image = `data:${imageFiles[0].mime};base64,${base64}`
      } else {
        // 多张图片用数组（最多10张）
        const images = imageFiles.slice(0, 10).map(imageFile => {
          const base64 = Buffer.from(imageFile.data).toString('base64')
          return `data:${imageFile.mime};base64,${base64}`
        })
        input.image = images
      }
      ctx.logger('media-luna').debug(`Doubao: Added ${imageFiles.length} reference image(s)`)
    }
  }

  // 构建 extra_body 对象
  const extraBody: Record<string, any> = {}

  // provider 配置
  const provider: Record<string, any> = {}
  if (enableImageBase64 !== undefined) provider.enable_image_base64 = enableImageBase64
  if (enableImageOriginData !== undefined) provider.enable_image_origin_data = enableImageOriginData
  if (Object.keys(provider).length > 0) {
    extraBody.provider = provider
  }

  // 其他 extra_body 参数
  if (size) extraBody.size = size
  if (scale !== undefined && scale !== null) extraBody.scale = Number(scale)
  if (forceSingle !== undefined) extraBody.force_single = forceSingle
  if (optimizePromptMode) {
    extraBody.optimize_prompt_options = { mode: optimizePromptMode }
  }

  // 构建请求体
  const requestBody: Record<string, any> = {
    model,
    input
  }

  if (Object.keys(extraBody).length > 0) {
    requestBody.extra_body = extraBody
  }

  ctx.logger('media-luna').debug('Doubao request body: %o', requestBody)

  const response = await ctx.http.post(apiUrl, requestBody, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: timeout * 1000
  })

  ctx.logger('media-luna').debug('Doubao response: %o', response)

  // 解析响应
  // 响应格式可能是 { data: [...] } 或直接是数组
  let dataArray: any[] = []
  if (response.data && Array.isArray(response.data)) {
    dataArray = response.data
  } else if (Array.isArray(response)) {
    dataArray = response
  } else if (response.data) {
    // 可能是单个对象
    dataArray = [response.data]
  } else if (response.url || response.b64_json) {
    dataArray = [response]
  }

  if (dataArray.length === 0) {
    throw new Error('Invalid response from Doubao API: no data')
  }

  return dataArray.map((item: any) => ({
    kind: 'image' as const,
    url: item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : undefined),
    mime: 'image/png',
    meta: {
      revisedPrompt: item.revised_prompt
    }
  })).filter(asset => asset.url)
}

/** 豆包连接器定义 */
export const DoubaoConnector: ConnectorDefinition = {
  id: 'doubao',
  name: '豆包 Seedream',
  description: '字节跳动豆包 Seedream 图像生成模型',
  icon: 'doubao',
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
      scale,
      forceSingle,
      optimizePromptMode,
      enableImageInput = true
    } = config

    // 计算实际会发送的图片数量
    const imageCount = enableImageInput
      ? files.filter(f => f.mime?.startsWith('image/')).length
      : 0

    // 只记录实际配置的参数
    const parameters: Record<string, any> = {}
    if (size) parameters.size = size
    if (scale !== undefined && scale !== null) parameters.scale = Number(scale)
    if (forceSingle !== undefined) parameters.force_single = forceSingle
    if (optimizePromptMode) parameters.optimize_prompt_mode = optimizePromptMode
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

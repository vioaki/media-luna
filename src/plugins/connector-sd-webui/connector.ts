// Stable Diffusion WebUI 连接器

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

/** SD WebUI 生成函数 */
async function generate(
  ctx: Context,
  config: Record<string, any>,
  files: FileData[],
  prompt: string
): Promise<OutputAsset[]> {
  const {
    apiUrl,
    model,
    sampler,
    steps,
    cfgScale,
    width,
    height,
    negativePrompt,
    batchSize,
    seed,
    denoisingStrength,
    timeout = 600
  } = config

  const baseUrl = apiUrl.replace(/\/$/, '')

  // 如果有输入图片，使用 img2img，否则使用 txt2img
  const hasInputImage = files.length > 0 && files.some(f => f.mime.startsWith('image/'))
  const endpoint = hasInputImage ? '/sdapi/v1/img2img' : '/sdapi/v1/txt2img'

  // 构建请求体
  const requestBody: Record<string, any> = {
    prompt
  }

  // 仅在配置了值时才添加参数
  if (negativePrompt) requestBody.negative_prompt = negativePrompt
  if (sampler) requestBody.sampler_name = sampler
  if (steps !== undefined && steps !== null) requestBody.steps = Number(steps)
  if (cfgScale !== undefined && cfgScale !== null) requestBody.cfg_scale = Number(cfgScale)
  if (width !== undefined && width !== null) requestBody.width = Number(width)
  if (height !== undefined && height !== null) requestBody.height = Number(height)
  if (batchSize !== undefined && batchSize !== null) requestBody.batch_size = Number(batchSize)
  if (seed !== undefined && seed !== null && seed !== '') requestBody.seed = Number(seed)

  // 如果指定了模型，添加模型覆盖
  if (model) {
    requestBody.override_settings = {
      sd_model_checkpoint: model
    }
  }

  // img2img 需要额外参数
  if (hasInputImage) {
    const imageFile = files.find(f => f.mime.startsWith('image/'))!
    const base64Data = Buffer.from(imageFile.data).toString('base64')
    requestBody.init_images = [`data:${imageFile.mime};base64,${base64Data}`]
    if (denoisingStrength !== undefined && denoisingStrength !== null) {
      requestBody.denoising_strength = Number(denoisingStrength)
    }
  }

  try {
    const response = await ctx.http.post(`${baseUrl}${endpoint}`, requestBody, {
      timeout: timeout * 1000
    })

    if (!response.images || !Array.isArray(response.images)) {
      throw new Error('Invalid response from SD WebUI API')
    }

    // SD WebUI 返回 base64 图片
    return response.images.map((img: string, idx: number) => {
      // 移除可能的 data URI 前缀
      const base64 = img.includes(',') ? img.split(',')[1] : img
      return {
        kind: 'image' as const,
        url: `data:image/png;base64,${base64}`,
        mime: 'image/png',
        meta: {
          seed: response.parameters?.seed,
          info: response.info
        }
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`SD WebUI API error: ${error.message}`)
    }
    throw error
  }
}

/** SD WebUI 连接器定义 */
export const SDWebUIConnector: ConnectorDefinition = {
  id: 'sd-webui',
  name: 'Stable Diffusion WebUI',
  description: '本地部署的 Stable Diffusion WebUI，支持丰富的模型和 LoRA',
  icon: 'sd-webui',
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
      sampler,
      steps,
      cfgScale,
      width,
      height,
      batchSize,
      seed,
      denoisingStrength
    } = config

    const hasInputImage = files.some(f => f.mime?.startsWith('image/'))

    const parameters: Record<string, any> = {}
    if (sampler) parameters.sampler = sampler
    if (steps !== undefined && steps !== null) parameters.steps = Number(steps)
    if (cfgScale !== undefined && cfgScale !== null) parameters.cfgScale = Number(cfgScale)
    if (width !== undefined && width !== null) parameters.width = Number(width)
    if (height !== undefined && height !== null) parameters.height = Number(height)
    if (batchSize !== undefined && batchSize !== null) parameters.batchSize = Number(batchSize)
    if (seed !== undefined && seed !== null && seed !== '') parameters.seed = Number(seed)
    if (hasInputImage && denoisingStrength !== undefined) parameters.denoisingStrength = Number(denoisingStrength)
    if (hasInputImage) parameters.mode = 'img2img'

    return {
      endpoint: apiUrl,
      model: model || 'current',
      prompt,
      fileCount: hasInputImage ? files.filter(f => f.mime?.startsWith('image/')).length : 0,
      parameters
    }
  }
}

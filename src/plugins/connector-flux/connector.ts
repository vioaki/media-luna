// Flux 连接器

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

/** Flux 生成函数 */
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
    outputFormat,
    outputQuality,
    numOutputs,
    seed,
    guidanceScale,
    numInferenceSteps,
    disableSafetyChecker,
    timeout = 600,
    pollInterval = 2000
  } = config

  if (!model) {
    throw new Error('模型未配置')
  }

  // 模型版本映射 (Replicate 格式)
  const modelVersionMap: Record<string, string> = {
    'flux-schnell': 'black-forest-labs/flux-schnell',
    'flux-dev': 'black-forest-labs/flux-dev',
    'flux-pro': 'black-forest-labs/flux-pro',
    'flux-1.1-pro': 'black-forest-labs/flux-1.1-pro'
  }

  const modelVersion = modelVersionMap[model] || model

  // 构建请求体
  const requestBody: Record<string, any> = {
    version: modelVersion,
    input: {
      prompt
    }
  }

  // 仅在配置了值时才添加参数
  if (numOutputs !== undefined && numOutputs !== null) requestBody.input.num_outputs = Number(numOutputs)
  if (disableSafetyChecker !== undefined) requestBody.input.disable_safety_checker = Boolean(disableSafetyChecker)
  if (aspectRatio) requestBody.input.aspect_ratio = aspectRatio
  if (outputFormat) requestBody.input.output_format = outputFormat
  if (outputQuality !== undefined && outputQuality !== null) requestBody.input.output_quality = Number(outputQuality)
  if (guidanceScale !== undefined && guidanceScale !== null) requestBody.input.guidance_scale = Number(guidanceScale)
  if (numInferenceSteps !== undefined && numInferenceSteps !== null) requestBody.input.num_inference_steps = Number(numInferenceSteps)
  if (seed !== undefined && seed !== null && seed !== '') requestBody.input.seed = Number(seed)

  // 如果有输入图片（img2img），添加到请求
  if (files.length > 0) {
    const imageFile = files.find(f => f.mime.startsWith('image/'))
    if (imageFile) {
      const base64Data = Buffer.from(imageFile.data).toString('base64')
      requestBody.input.image = `data:${imageFile.mime};base64,${base64Data}`
    }
  }

  try {
    // 创建预测任务
    const createResponse = await ctx.http.post(apiUrl, requestBody, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })

    if (!createResponse.id) {
      throw new Error('Failed to create prediction')
    }

    const predictionId = createResponse.id
    const getUrl = createResponse.urls?.get || `${apiUrl}/${predictionId}`

    // 轮询等待结果
    const startTime = Date.now()
    const timeoutMs = timeout * 1000

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const statusResponse = await ctx.http.get(getUrl, {
        headers: {
          'Authorization': `Token ${apiKey}`
        },
        timeout: 30000
      })

      if (statusResponse.status === 'succeeded') {
        const output = statusResponse.output
        if (!output) {
          throw new Error('No output from Flux API')
        }

        // 处理输出（可能是单个 URL 或 URL 数组）
        const urls = Array.isArray(output) ? output : [output]

        return urls.map((url: string) => ({
          kind: 'image' as const,
          url,
          mime: outputFormat ? `image/${outputFormat === 'jpg' ? 'jpeg' : outputFormat}` : 'image/webp',
          meta: {
            predictionId,
            model: modelVersion,
            aspectRatio
          }
        }))
      }

      if (statusResponse.status === 'failed') {
        throw new Error(statusResponse.error || 'Flux generation failed')
      }

      if (statusResponse.status === 'canceled') {
        throw new Error('Flux generation was canceled')
      }

      // 继续轮询 (processing/starting)
    }

    throw new Error('Flux generation timed out')
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Flux API error: ${error.message}`)
    }
    throw error
  }
}

/** Flux 连接器定义 */
export const FluxConnector: ConnectorDefinition = {
  id: 'flux',
  name: 'Flux',
  description: 'Black Forest Labs 的 Flux 系列模型，快速高质量图像生成',
  icon: 'flux',
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
      aspectRatio,
      outputFormat,
      numOutputs,
      seed,
      guidanceScale,
      numInferenceSteps
    } = config

    const parameters: Record<string, any> = {}
    if (aspectRatio) parameters.aspectRatio = aspectRatio
    if (outputFormat) parameters.outputFormat = outputFormat
    if (numOutputs !== undefined && numOutputs !== null) parameters.numOutputs = Number(numOutputs)
    if (seed !== undefined && seed !== '' && seed !== null) parameters.seed = Number(seed)
    if (guidanceScale !== undefined && guidanceScale !== null) parameters.guidanceScale = Number(guidanceScale)
    if (numInferenceSteps !== undefined && numInferenceSteps !== null) parameters.numInferenceSteps = Number(numInferenceSteps)
    if (files.some(f => f.mime.startsWith('image/'))) parameters.hasInputImage = true

    return {
      endpoint: apiUrl?.split('?')[0],
      model,
      prompt,
      fileCount: files.length,
      parameters
    }
  }
}

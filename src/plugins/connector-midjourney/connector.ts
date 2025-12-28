// Midjourney 连接器
// 适配通用 Midjourney API Proxy (如 GoAPI, TTApi, userapi.ai 等)
// 通常遵循: POST /imagine -> { task_id } -> GET /fetch -> { status, imageUrl }

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

/** 轮询任务状态 */
async function pollTask(
  ctx: Context,
  fetchUrl: string,
  apiKey: string,
  timeoutMs: number
): Promise<string[]> {
  const startTime = Date.now()
  const interval = 3000 // 3秒轮询一次

  while (Date.now() - startTime < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, interval))

    try {
      const res = await ctx.http.post(fetchUrl, {}, {
        headers: { 'X-API-KEY': apiKey }
      })

      // 适配常见 Proxy 格式
      // GoAPI: { status: 'finished', task_id: '...', task_result: { image_url: '...' } }
      // TTApi: { status: 'SUCCESS', imageUrl: '...' }

      const status = res.status?.toLowerCase()

      if (status === 'finished' || status === 'success' || status === 'completed') {
        const url = res.task_result?.image_url || res.imageUrl || res.url
        if (url) {
          return [url]
        }
        // 有些返回的是 grid 图片，可能需要进一步分割，这里简化为返回主图
      } else if (status === 'failed' || status === 'error') {
        throw new Error(`MJ Task Failed: ${JSON.stringify(res)}`)
      }

      // continue polling if 'processing', 'pending', 'started'

    } catch (e) {
      // ignore network glitch, continue polling
    }
  }

  throw new Error('Midjourney task timeout')
}

/** Midjourney 生成函数 */
async function generate(
  ctx: Context,
  config: Record<string, any>,
  files: FileData[],
  prompt: string
): Promise<OutputAsset[]> {
  const {
    apiUrl,
    apiKey,
    webhookUrl,
    aspectRatio,
    mode,
    timeout = 600
  } = config

  const baseUrl = apiUrl.replace(/\/$/, '')

  // 1. 发起 Imagine 任务
  // 注意：不同 Proxy 的 API 路径和参数可能略有不同，这里适配一种通用格式
  // 通常是 POST /imagine
  const imagineUrl = `${baseUrl}/imagine`

  // 拼接参数到 prompt
  let fullPrompt = prompt
  if (aspectRatio && !fullPrompt.includes('--ar')) {
    fullPrompt += ` --ar ${aspectRatio}`
  }

  // 处理垫图 (Image Prompt)
  // 如果有输入图片，需要先上传或者直接把 URL 拼在 prompt 前面
  // 由于 Proxy 通常只接受 URL，这里假设 files 已经被中间件上传并替换为了 url (需要 storage-input 中间件配合)
  // 这里暂时只处理文本 Prompt

  const body: any = {
    prompt: fullPrompt
  }
  if (mode) body.process_mode = mode
  if (webhookUrl) body.webhook_url = webhookUrl

  let taskId: string

  try {
    const res = await ctx.http.post(imagineUrl, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      }
    })

    taskId = res.task_id || res.taskId || res.id
    if (!taskId) {
      throw new Error(`Failed to start MJ task: ${JSON.stringify(res)}`)
    }
  } catch (e) {
    if (e instanceof Error) throw new Error(`MJ API Error: ${e.message}`)
    throw e
  }

  // 2. 轮询结果 (如果没有 Webhook 或需要同步等待)
  // POST /fetch 或 GET /task/{id}
  const fetchUrl = `${baseUrl}/result` // 或者是 /fetch

  // 这里的轮询逻辑需要根据具体 Proxy 的协议调整
  // 这是一个基于 GoAPI 风格的示例

  const imageUrls = await pollTask(ctx, fetchUrl, apiKey, timeout * 1000)

  return imageUrls.map(url => ({
    kind: 'image',
    url,
    mime: 'image/png', // MJ 通常返回 PNG 或 WebP
    meta: {
      taskId,
      prompt: fullPrompt
    }
  }))
}

/** Midjourney 连接器定义 */
export const MidjourneyConnector: ConnectorDefinition = {
  id: 'midjourney',
  name: 'Midjourney (Proxy)',
  description: '通过代理 API 调用 Midjourney，支持 V5/V6 模型',
  icon: 'midjourney',
  supportedTypes: ['image'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2img', 'img2img'],
  generate,

  getRequestLog(config, files, prompt): ConnectorRequestLog {
    const { apiUrl, aspectRatio, mode } = config
    return {
      endpoint: apiUrl,
      model: 'midjourney-v6', // MJ 版本通常包含在 prompt 里，这里写死 v6 示意
      prompt,
      fileCount: files.length,
      parameters: {
        aspectRatio,
        mode
      }
    }
  }
}

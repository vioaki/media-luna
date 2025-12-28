// Suno AI 连接器
// 适配常见第三方 Suno API (如 GoAPI, Suno-API 等)
// 工作流: POST /generate -> { task_ids } -> GET /feed/{ids} (轮询)

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

/** 轮询任务状态 */
async function pollTasks(
  ctx: Context,
  fetchUrl: string,
  apiKey: string,
  taskIds: string[],
  timeoutMs: number
): Promise<OutputAsset[]> {
  const startTime = Date.now()
  const interval = 5000 // 5秒轮询一次

  // 记录已完成的任务 ID
  const completedIds = new Set<string>()
  const results: OutputAsset[] = []

  while (Date.now() - startTime < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, interval))

    // 如果所有任务都完成了，退出
    if (completedIds.size === taskIds.length) break

    try {
      // 这里的 API 格式因提供商而异，通常是 /feed?ids=... 或者 POST /feed
      // 假设是 GET /feed?ids=id1,id2
      const idsParam = taskIds.join(',')
      const res = await ctx.http.get(`${fetchUrl}?ids=${idsParam}`, {
        headers: { 'X-API-KEY': apiKey, 'Authorization': `Bearer ${apiKey}` } // 尝试两种常见头
      })

      const clips = Array.isArray(res) ? res : (res.clips || res.data || [])

      for (const clip of clips) {
        if (completedIds.has(clip.id)) continue

        // 检查状态
        const status = clip.status || clip.state
        if (status === 'complete' || status === 'streaming') { // Suno 有时 streaming 状态就可以拿到 audio_url
          if (clip.audio_url) {
            completedIds.add(clip.id)
            results.push({
              kind: 'audio',
              url: clip.audio_url,
              mime: 'audio/mpeg',
              meta: {
                title: clip.title,
                duration: clip.duration,
                imageUrl: clip.image_url, // 封面图
                videoUrl: clip.video_url, // 视频版
                lyric: clip.metadata?.prompt || clip.lyric // 歌词
              }
            })

            // 同时添加视频版本作为额外输出？
            // Koishi 目前 OutputAsset 是一维数组，通常只返回主要内容
            // 封面图可以作为 meta.coverUrl
          }
        } else if (status === 'error') {
          completedIds.add(clip.id) // 标记为完成（失败）以停止轮询
          // 记录错误但不抛出，以免阻塞其他成功的任务
          ctx.logger('suno').warn(`Task ${clip.id} failed: ${clip.error_message}`)
        }
      }

    } catch (e) {
      // ignore network error
    }
  }

  if (results.length === 0) {
    throw new Error('Suno task timeout or failed')
  }

  return results
}

/** Suno 生成函数 */
async function generate(
  ctx: Context,
  config: Record<string, any>,
  files: FileData[],
  prompt: string
): Promise<OutputAsset[]> {
  const {
    apiUrl,
    apiKey,
    instrumental = false,
    tags,
    title,
    timeout = 300
  } = config

  const baseUrl = apiUrl.replace(/\/$/, '')

  // 1. 发起生成请求
  // custom_generate (歌词+风格) 或 generate (仅描述)
  // 这里简化处理：如果有 tags 和 prompt，认为是 custom 模式
  // 如果只有 prompt 且 instrumental=false，认为是 description 模式

  const endpoint = `${baseUrl}/generate` // 或 /custom_generate

  const body: any = {
    prompt: prompt, // description or lyrics
    make_instrumental: instrumental,
    wait_audio: false // 异步模式
  }

  if (tags) body.tags = tags
  if (title) body.title = title

  // 适配不同 API 的参数命名差异
  // 有些 API 区分 prompt (描述) 和 gpt_description_prompt
  // 有些 API 区分 prompt (歌词) 和 tags

  // 假设使用 GoAPI 风格：
  // custom_mode: 如果提供了 tags，则 prompt 视为歌词
  if (tags) {
    body.prompt = prompt // 歌词
    body.tags = tags
    body.mv = 'chirp-v3-0' // 模型版本
  } else {
    // 简单模式：prompt 是描述
    body.gpt_description_prompt = prompt
    delete body.prompt
  }

  let taskIds: string[] = []

  try {
    const res = await ctx.http.post(endpoint, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    })

    // 适配返回格式
    // { id: "...", ids: ["..."] }
    if (res.ids && Array.isArray(res.ids)) {
      taskIds = res.ids
    } else if (res.task_id) {
      taskIds = [res.task_id]
    } else {
      // 某些 API 直接返回 clips 数组（如果是同步模式）
      // 这里假设是异步
      throw new Error(`Invalid Suno response: ${JSON.stringify(res)}`)
    }

  } catch (e: any) {
    if (e.response?.data) {
      throw new Error(`Suno API Error: ${JSON.stringify(e.response.data)}`)
    }
    throw e
  }

  // 2. 轮询结果
  const fetchUrl = `${baseUrl}/feed` // 或 /ids

  return await pollTasks(ctx, fetchUrl, apiKey, taskIds, timeout * 1000)
}

/** Suno 连接器定义 */
export const SunoConnector: ConnectorDefinition = {
  id: 'suno',
  name: 'Suno AI',
  description: 'AI 音乐生成，根据提示词创作完整歌曲',
  icon: 'suno',
  supportedTypes: ['audio'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2audio'],
  generate,

  getRequestLog(config, files, prompt): ConnectorRequestLog {
    const { apiUrl, tags, instrumental } = config
    return {
      endpoint: apiUrl,
      model: 'chirp-v3',
      prompt,
      fileCount: 0,
      parameters: {
        tags,
        instrumental
      }
    }
  }
}

// MiniMax T2A 连接器

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

/** MiniMax T2A API 响应 */
interface MiniMaxT2AResponse {
  data?: {
    audio?: string
    status?: number
  }
  trace_id?: string
  extra_info?: {
    audio_length?: number
    audio_sample_rate?: number
    audio_size?: number
    audio_format?: string
    usage_characters?: number
  }
  base_resp?: {
    status_code?: number
    status_msg?: string
  }
}

/** 默认配置值 */
const DEFAULTS = {
  endpoint: 'https://api.minimaxi.com/v1/t2a_v2',
  model: 'speech-2.6-hd',
  voiceId: 'female-tianmei',
  speed: 1.0,
  volume: 1.0,
  pitch: 0,
  languageBoost: 'auto',
  audioFormat: 'mp3',
  sampleRate: 32000
}

/** MiniMax T2A 生成函数 */
async function generate(
  ctx: Context,
  config: Record<string, any>,
  files: FileData[],
  prompt: string
): Promise<OutputAsset[]> {
  const apiKey = config.apiKey
  const endpoint = config.endpoint || DEFAULTS.endpoint
  const model = config.model || DEFAULTS.model
  const voiceId = config.voiceId || DEFAULTS.voiceId
  const speed = config.speed ?? DEFAULTS.speed
  const volume = config.volume ?? DEFAULTS.volume
  const pitch = config.pitch ?? DEFAULTS.pitch
  const languageBoost = config.languageBoost ?? DEFAULTS.languageBoost
  const audioFormat = config.audioFormat || DEFAULTS.audioFormat
  const sampleRate = config.sampleRate ?? DEFAULTS.sampleRate
  const emotion = config.emotion

  if (!apiKey) {
    throw new Error('MiniMax API Key 未配置')
  }

  const logger = ctx.logger('media-luna')

  // 构建请求体
  const requestBody: Record<string, any> = {
    model,
    text: prompt,
    stream: false,
    language_boost: languageBoost || null,
    output_format: 'hex',
    voice_setting: {
      voice_id: voiceId,
      speed: Number(speed),
      vol: Number(volume),
      pitch: Number(pitch)
    },
    audio_setting: {
      sample_rate: Number(sampleRate),
      format: audioFormat,
      channel: 1
    }
  }

  // 添加情感控制（如果指定）
  if (emotion) {
    requestBody.voice_setting.emotion = emotion
  }

  logger.debug('MiniMax T2A request: model=%s, voice=%s, text=%s',
    model, voiceId, prompt.substring(0, 50))

  const response = await ctx.http.post(
    endpoint,
    requestBody,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }
  ) as MiniMaxT2AResponse

  // 检查响应状态
  if (response.base_resp?.status_code !== 0) {
    const errorMsg = response.base_resp?.status_msg || '未知错误'
    const errorCode = response.base_resp?.status_code
    throw new Error(`MiniMax API 错误 (${errorCode}): ${errorMsg}`)
  }

  // 检查音频数据
  if (!response.data?.audio) {
    throw new Error('MiniMax API 返回无音频数据')
  }

  // 将 hex 编码的音频转换为 base64 data URL
  const hexAudio = response.data.audio
  const audioBuffer = Buffer.from(hexAudio, 'hex')
  const base64Audio = audioBuffer.toString('base64')
  const mimeType = getMimeType(audioFormat)
  const dataUrl = `data:${mimeType};base64,${base64Audio}`

  logger.debug('MiniMax T2A complete: %d bytes, %dms',
    response.extra_info?.audio_size || 0,
    response.extra_info?.audio_length || 0
  )

  return [{
    kind: 'audio',
    url: dataUrl,
    mime: mimeType,
    meta: {
      duration: response.extra_info?.audio_length,
      sampleRate: response.extra_info?.audio_sample_rate,
      size: response.extra_info?.audio_size,
      characters: response.extra_info?.usage_characters,
      traceId: response.trace_id
    }
  }]
}

/** 获取 MIME 类型 */
function getMimeType(format: string): string {
  switch (format) {
    case 'mp3': return 'audio/mpeg'
    case 'wav': return 'audio/wav'
    case 'flac': return 'audio/flac'
    case 'pcm': return 'audio/pcm'
    default: return 'audio/mpeg'
  }
}

/** MiniMax T2A 连接器定义 */
export const MiniMaxConnector: ConnectorDefinition = {
  id: 'minimax-t2a',
  name: 'MiniMax T2A',
  description: 'MiniMax 语音合成，支持多音色和情感控制',
  icon: 'minimax',
  supportedTypes: ['audio'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2audio'],
  generate,

  /** 获取请求日志 */
  getRequestLog(config, files, prompt): ConnectorRequestLog {
    return {
      endpoint: config.endpoint,
      model: config.model,
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      parameters: {
        voice_id: config.voiceId,
        speed: config.speed,
        language_boost: config.languageBoost
      }
    }
  }
}

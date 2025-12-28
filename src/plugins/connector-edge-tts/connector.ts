// Edge TTS 连接器
// 使用 msedge-tts npm 包与微软 Edge 在线语音服务通信

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

/** 默认配置值 */
const DEFAULTS = {
  voice: 'zh-CN-XiaoxiaoNeural',
  rate: 'default',
  volume: 'default',
  pitch: 'default'
}

/** Edge TTS 生成函数 */
async function generate(
  ctx: Context,
  config: Record<string, any>,
  files: FileData[],
  prompt: string
): Promise<OutputAsset[]> {
  const voice = config.voice || DEFAULTS.voice
  const rate = config.rate || DEFAULTS.rate
  const volume = config.volume || DEFAULTS.volume
  const pitch = config.pitch || DEFAULTS.pitch

  const logger = ctx.logger('media-luna')

  logger.debug('Edge TTS request: voice=%s, text=%s', voice, prompt.substring(0, 50))

  // 创建 TTS 实例
  const tts = new MsEdgeTTS()

  // 设置元数据（音色和输出格式）
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)

  // 合成语音并获取流
  const { audioStream } = tts.toStream(prompt, {
    rate,
    volume,
    pitch
  })

  // 收集音频数据
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    audioStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    audioStream.on('end', () => resolve())
    audioStream.on('error', (err: Error) => reject(err))
  })

  // 关闭连接
  tts.close()

  const audioBuffer = Buffer.concat(chunks)

  if (audioBuffer.length === 0) {
    throw new Error('Edge TTS 返回空音频数据')
  }

  // 转换为 base64 data URL
  const base64Audio = audioBuffer.toString('base64')
  const mimeType = 'audio/mpeg'
  const dataUrl = `data:${mimeType};base64,${base64Audio}`

  logger.debug('Edge TTS complete: %d bytes', audioBuffer.length)

  return [{
    kind: 'audio',
    url: dataUrl,
    mime: mimeType,
    meta: {
      size: audioBuffer.length,
      voice
    }
  }]
}

/** Edge TTS 连接器定义 */
export const EdgeTTSConnector: ConnectorDefinition = {
  id: 'edge-tts',
  name: 'Edge TTS',
  description: '微软 Edge 免费语音合成，支持多语言多音色',
  icon: 'edge-tts',
  supportedTypes: ['audio'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2audio'],
  generate,

  /** 获取请求日志 */
  getRequestLog(config, files, prompt): ConnectorRequestLog {
    return {
      endpoint: 'Microsoft Edge TTS',
      model: config.voice || DEFAULTS.voice,
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      parameters: {
        voice: config.voice,
        rate: config.rate,
        volume: config.volume,
        pitch: config.pitch
      }
    }
  }
}

// Chat API 连接器
// 支持 OpenAI Chat Completions 兼容格式，从回复中提取多媒体内容

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'

/**
 * 检查是否为有效 URL
 * 除了格式校验，还检查 URL 是否包含非法字符（如 JSON 残留）
 */
function isValidUrl(url: string): boolean {
  // 检查是否包含 JSON 残留字符
  if (/[{}\[\]"]/.test(url)) {
    return false
  }

  try {
    const parsed = new URL(url)
    // 确保有有效的 host
    if (!parsed.host) return false
    // 确保 pathname 不包含异常字符
    if (/[{}\[\]"]/.test(parsed.pathname)) return false
    return true
  } catch {
    return false
  }
}

/**
 * 检查 URL 是否可能是多媒体资源
 */
function isMediaUrl(url: string): boolean {
  const mediaExtensions = [
    // 图片
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico',
    // 视频
    '.mp4', '.webm', '.avi', '.mov', '.mkv',
    // 音频
    '.mp3', '.wav', '.ogg', '.flac', '.m4a'
  ]

  const lowerUrl = url.toLowerCase()

  // 检查扩展名
  if (mediaExtensions.some(ext => lowerUrl.includes(ext))) {
    return true
  }

  // 检查常见的图片托管服务
  const imageHosts = [
    'videos.openai.com',
    'imgur.com', 'i.imgur.com',
    'cdn.discordapp.com',
    'media.discordapp.net',
    'pbs.twimg.com',
    'oaidalleapiprodscus.blob.core.windows.net', // OpenAI DALL-E
    'replicate.delivery', // Replicate
    'storage.googleapis.com'
  ]

  if (imageHosts.some(host => lowerUrl.includes(host))) {
    return true
  }

  return false
}

/**
 * 根据 URL 判断媒体类型
 */
function getMediaKind(url: string): 'image' | 'video' | 'audio' {
  const lowerUrl = url.toLowerCase()

  if (lowerUrl.includes('videos.openai.com')) {
    return 'video'
  }

  const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.mkv']
  if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
    return 'video'
  }

  const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.m4a']
  if (audioExtensions.some(ext => lowerUrl.includes(ext))) {
    return 'audio'
  }

  return 'image'
}

/**
 * 从回复内容中提取多媒体资源
 * 使用 Set 确保 URL 不重复
 */
function extractMediaFromContent(content: string, mode: string): OutputAsset[] {
  const assets: OutputAsset[] = []
  const seenUrls = new Set<string>()

  /** 添加资源（自动去重） */
  const addAsset = (asset: OutputAsset): boolean => {
    const key = asset.url || asset.content || ''
    if (seenUrls.has(key)) return false
    seenUrls.add(key)
    assets.push(asset)
    return true
  }

  if (mode === 'text') {
    // 纯文本模式，直接返回文本
    return [{
      kind: 'text',
      content: content
    }]
  }

  if (mode === 'auto' || mode === 'markdown') {
    // 提取 Markdown 图片: ![alt](url)
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    let match
    while ((match = markdownImageRegex.exec(content)) !== null) {
      const url = match[2]
      if (isValidUrl(url)) {
        addAsset({
          kind: 'image',
          url: url,
          meta: { alt: match[1] }
        })
      }
    }

    // 提取 HTML 视频/图片标签 (包括在代码块中的)
    const htmlVideoRegex = /<video[^>]+src=(['"])(.*?)\1/gi
    while ((match = htmlVideoRegex.exec(content)) !== null) {
      const url = match[2]
      if (isValidUrl(url)) {
        addAsset({
          kind: 'video',
          url: url
        })
      }
    }

    const htmlImageRegex = /<img[^>]+src=(['"])(.*?)\1/gi
    while ((match = htmlImageRegex.exec(content)) !== null) {
      const url = match[2]
      if (isValidUrl(url)) {
        addAsset({
          kind: 'image',
          url: url
        })
      }
    }
  }

  if (mode === 'auto' || mode === 'url') {
    // 提取独立的 URL（排除已提取的）
    // 注意：排除 ) 以避免匹配 Markdown 语法中的 URL
    // 排除 } ] " ' 以避免匹配 JSON 结构中的 URL
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]')]+/g
    let match
    while ((match = urlRegex.exec(content)) !== null) {
      let url = match[0]
      // 清理 URL 末尾可能的标点符号
      url = url.replace(/[.,;:!?]+$/, '')
      if (!seenUrls.has(url) && isMediaUrl(url)) {
        const kind = getMediaKind(url)
        addAsset({
          kind,
          url: url
        })
      }
    }
  }

  if (mode === 'auto' || mode === 'base64') {
    // 提取 base64 图片: data:image/xxx;base64,xxx
    const base64Regex = /data:(image\/[^;]+);base64,([A-Za-z0-9+/=]+)/g
    let match
    while ((match = base64Regex.exec(content)) !== null) {
      addAsset({
        kind: 'image',
        url: match[0],
        mime: match[1]
      })
    }
  }

  // 如果没有提取到任何多媒体，返回文本内容
  if (assets.length === 0) {
    return [{
      kind: 'text',
      content: content
    }]
  }

  return assets
}

/** Chat API 生成函数 */
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
    systemPrompt = '',
    extractMode = 'auto',
    temperature = 0.7,
    topP = 1,
    presencePenalty = 0,
    frequencyPenalty = 0,
    stream = false,
    maxTokens = 40960,
    timeout = 600
  } = config

  // 验证必需配置
  if (!apiUrl) {
    throw new Error('API URL 未配置，请在渠道设置中配置 API URL')
  }
  if (!apiKey) {
    throw new Error('API Key 未配置，请在渠道设置中配置 API Key')
  }
  if (!model) {
    throw new Error('模型未配置，请在渠道设置中配置模型名称')
  }

  // 构建消息
  const messages: any[] = []

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }

  // 构建用户消息（支持多模态输入）
  if (files.length > 0) {
    const content: any[] = [{ type: 'text', text: prompt }]

    for (const file of files) {
      if (file.mime.startsWith('image/')) {
        // 将图片转为 base64
        const base64 = Buffer.from(file.data).toString('base64')
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${file.mime};base64,${base64}`
          }
        })
      }
    }

    messages.push({ role: 'user', content })
  } else {
    messages.push({ role: 'user', content: prompt })
  }

  // 构建完整 API Endpoint
  const baseUrl = apiUrl.replace(/\/$/, '')
  // 如果用户填写了完整路径（以 /chat/completions 结尾），则直接使用
  // 否则自动拼接 /chat/completions
  const endpoint = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl}/chat/completions`

  // 发送请求
  const requestBody: any = {
    model,
    messages,
    stream: Boolean(stream),
    max_tokens: Number(maxTokens)
  }

  // 仅在非默认值时添加参数
  if (temperature != null) requestBody.temperature = Number(temperature)
  if (topP != null) requestBody.top_p = Number(topP)
  if (presencePenalty) requestBody.presence_penalty = Number(presencePenalty)
  if (frequencyPenalty) requestBody.frequency_penalty = Number(frequencyPenalty)

  const response = await ctx.http.post(endpoint, requestBody, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': '*/*'
    },
    timeout: timeout * 1000,
    responseType: stream ? 'text' : 'json'
  })

  let content = ''
  if (stream) {
    // 处理流式响应
    const lines = (response as string).split('\n')
    let isSSE = false
    for (const line of lines) {
      if (line.trim().startsWith('data: ')) {
        isSSE = true
        const data = line.trim().slice(6)
        if (data === '[DONE]') break
        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) content += delta
        } catch (e) {
          // ignore parse error
        }
      }
    }

    // 如果没有解析出 SSE 内容（可能是服务端不支持流式或返回了错误 JSON），尝试直接解析
    if (!isSSE && !content) {
      try {
        const json = JSON.parse(response as string)
        content = json.choices?.[0]?.message?.content || ''
      } catch {
        // ignore
      }
    }
  } else {
    // 提取回复内容
    const choice = (response as any).choices?.[0]
    if (!choice) {
      throw new Error('No response from Chat API')
    }
    content = choice.message?.content || ''
  }

  // 根据提取模式处理回复
  return extractMediaFromContent(content, extractMode)
}

/** Chat API 连接器定义 */
export const ChatApiConnector: ConnectorDefinition = {
  id: 'chat-api',
  name: 'Chat API',
  description: '通用 OpenAI 兼容接口',
  icon: 'openai',
  supportedTypes: ['image', 'audio', 'video'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2img', 'img2img', 'text2video', 'img2video', 'text2audio'],
  generate,

  /** 获取请求日志 */
  getRequestLog(config, files, prompt): ConnectorRequestLog {
    const {
      apiUrl,
      model,
      systemPrompt = '',
      extractMode = 'auto',
      temperature = 0.7,
      maxTokens = 40960
    } = config

    return {
      endpoint: apiUrl?.split('?')[0],
      model,
      prompt,
      fileCount: files.length,
      parameters: {
        systemPrompt: systemPrompt ? `${systemPrompt.slice(0, 100)}${systemPrompt.length > 100 ? '...' : ''}` : undefined,
        extractMode,
        temperature,
        maxTokens,
        hasImages: files.some(f => f.mime.startsWith('image/'))
      }
    }
  }
}

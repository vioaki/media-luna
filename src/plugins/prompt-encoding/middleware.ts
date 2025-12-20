// Prompt Encoding 中间件
// 将 prompt 转换为 Unicode 转义序列以绕过内容审核

import {
  MiddlewareDefinition,
  MiddlewareContext,
  MiddlewareRunStatus
} from '../../types'
import { PromptEncodingConfig, defaultPromptEncodingConfig } from './config'

/**
 * 判断字符是否为中文
 */
function isChinese(char: string): boolean {
  const code = char.codePointAt(0) || 0
  // CJK 统一汉字范围
  return (
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Extension A
    (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
    (code >= 0x2A700 && code <= 0x2B73F) || // CJK Extension C
    (code >= 0x2B740 && code <= 0x2B81F) || // CJK Extension D
    (code >= 0x2B820 && code <= 0x2CEAF) || // CJK Extension E
    (code >= 0x2CEB0 && code <= 0x2EBEF) || // CJK Extension F
    (code >= 0xF900 && code <= 0xFAFF) ||   // CJK Compatibility Ideographs
    (code >= 0x2F800 && code <= 0x2FA1F)    // CJK Compatibility Supplement
  )
}

/**
 * 判断字符是否为非 ASCII
 */
function isNonAscii(char: string): boolean {
  const code = char.codePointAt(0) || 0
  return code > 127
}

/**
 * 将字符编码为 Unicode 转义序列
 */
function encodeCharUnicode(char: string): string {
  const code = char.codePointAt(0) || 0
  if (code > 0xFFFF) {
    // 处理 surrogate pair (emoji 等)
    const high = Math.floor((code - 0x10000) / 0x400) + 0xD800
    const low = ((code - 0x10000) % 0x400) + 0xDC00
    return `\\u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`
  }
  return `\\u${code.toString(16).padStart(4, '0')}`
}

/**
 * 将字符编码为 HTML 实体
 */
function encodeCharHtmlEntity(char: string): string {
  const code = char.codePointAt(0) || 0
  return `&#x${code.toString(16)};`
}

/**
 * 将字符编码为 URL 编码
 */
function encodeCharUrl(char: string): string {
  return encodeURIComponent(char)
}

/**
 * 根据配置编码 prompt
 */
function encodePrompt(prompt: string, config: PromptEncodingConfig): string {
  if (!config.enableUnicodeEscape) {
    return prompt
  }

  const chars = [...prompt]
  let encoded = ''

  for (const char of chars) {
    let shouldEncode = false

    switch (config.encodeRange) {
      case 'chinese':
        shouldEncode = isChinese(char)
        break
      case 'non-ascii':
        shouldEncode = isNonAscii(char)
        break
      case 'all':
        // 编码所有字符，除了空格和换行
        shouldEncode = char !== ' ' && char !== '\n' && char !== '\r' && char !== '\t'
        break
    }

    if (shouldEncode) {
      switch (config.escapeFormat) {
        case 'unicode':
          encoded += encodeCharUnicode(char)
          break
        case 'html-entity':
          encoded += encodeCharHtmlEntity(char)
          break
        case 'url-encode':
          encoded += encodeCharUrl(char)
          break
        default:
          encoded += encodeCharUnicode(char)
      }
    } else {
      encoded += char
    }
  }

  // 添加解码提示
  if (config.addDecodeHint && config.decodeHintTemplate) {
    encoded = config.decodeHintTemplate + encoded
  }

  return encoded
}

/**
 * 创建 Prompt Encoding 中间件
 */
export function createPromptEncodingMiddleware(): MiddlewareDefinition {
  return {
    name: 'prompt-encoding',
    displayName: 'Prompt Unicode 编码',
    description: '将 prompt 转换为 Unicode 转义序列以绕过内容审核',
    category: 'transform',
    phase: 'lifecycle-pre-request',
    after: ['preset'], // 确保在预设处理之后运行

    async execute(mctx: MiddlewareContext, next) {
      // 获取配置
      const mwConfig = await mctx.getMiddlewareConfig<PromptEncodingConfig>('prompt-encoding')
      const config: PromptEncodingConfig = {
        ...defaultPromptEncodingConfig,
        ...(mwConfig || {})
      }

      // 调试日志：输出配置
      mctx.setMiddlewareLog('prompt-encoding-debug', {
        mwConfigReceived: !!mwConfig,
        enableUnicodeEscape: config.enableUnicodeEscape,
        encodeRange: config.encodeRange,
        escapeFormat: config.escapeFormat
      })

      // 如果未启用，直接跳过
      if (!config.enableUnicodeEscape) {
        mctx.setMiddlewareLog('prompt-encoding', { skipped: true, reason: 'enableUnicodeEscape is false' })
        return next()
      }

      // 处理 prompt
      if (mctx.prompt) {
        const originalPrompt = mctx.prompt
        const encodedPrompt = encodePrompt(originalPrompt, config)

        if (originalPrompt !== encodedPrompt) {
          mctx.setMiddlewareLog('prompt-encoding', {
            enabled: true,
            encodeRange: config.encodeRange,
            escapeFormat: config.escapeFormat,
            originalLength: originalPrompt.length,
            encodedLength: encodedPrompt.length
          })
          mctx.prompt = encodedPrompt
        }
      }

      return next()
    }
  }
}

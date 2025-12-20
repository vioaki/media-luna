// 预设中间件

import type {
  MiddlewareDefinition,
  MiddlewareContext,
  MiddlewareRunStatus,
  FileData
} from '../../core'
import type { PresetMiddlewareConfig } from './config'
import type { PresetService } from './service'

/**
 * 创建预设中间件
 */
export function createPresetMiddleware(): MiddlewareDefinition {
  return {
    name: 'preset',
    displayName: '预设处理',
    description: '应用预设模板和参考图到生成请求',
    category: 'preset',
    phase: 'lifecycle-pre-request',
    // 配置在 preset 插件的扩展插件面板中设置

    async execute(context: MiddlewareContext, next): Promise<MiddlewareRunStatus> {
      const config = await context.getMiddlewareConfig<PresetMiddlewareConfig>('preset')

      if (config?.enabled === false) {
        return next()
      }

      // 从上下文获取 presetService
      const presetService = context.getService<PresetService>('preset')
      if (!presetService) {
        return next()
      }

      const presetName = context.parameters.preset || config?.defaultPreset
      if (!presetName) {
        return next()
      }

      const preset = await presetService.getByName(presetName)
      if (!preset) {
        return next()
      }

      if (!preset.enabled) {
        return next()
      }

      // 注入预设参考图
      if (preset.referenceImages && preset.referenceImages.length > 0) {
        const presetFiles = await loadReferenceImages(context.ctx, preset.referenceImages)
        context.files = [...presetFiles, ...context.files]
      }

      // 应用预设模板
      const originalPrompt = context.prompt
      context.prompt = applyTemplate(preset.promptTemplate, originalPrompt)

      // 应用参数覆盖
      if (preset.parameterOverrides) {
        context.parameters = {
          ...context.parameters,
          ...preset.parameterOverrides
        }
      }

      context.setMiddlewareLog('preset', {
        presetId: preset.id,
        presetName: preset.name,
        originalPrompt,
        transformedPrompt: context.prompt,
        referenceImagesInjected: preset.referenceImages?.length ?? 0
      })

      return next()
    }
  }
}

/** 加载参考图 */
async function loadReferenceImages(
  ctx: any,
  urls: string[]
): Promise<FileData[]> {
  const files: FileData[] = []

  for (const url of urls) {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const response = await ctx.http.get(url, {
          responseType: 'arraybuffer'
        }) as ArrayBuffer

        const mime = guessMimeFromUrl(url)
        const filename = url.split('/').pop() || 'reference.png'

        files.push({
          data: response,
          mime,
          filename
        })
      } else if (url.startsWith('data:')) {
        const matches = url.match(/^data:([^;]+);base64,(.+)$/)
        if (matches) {
          const mime = matches[1]
          const base64 = matches[2]
          const buffer = Buffer.from(base64, 'base64')
          const parts = mime.split('/')
          const ext = parts[1] || 'png'

          files.push({
            data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
            mime,
            filename: `reference.${ext}`
          })
        }
      }
    } catch {
      // 忽略加载失败的图片
    }
  }

  return files
}

/** 从 URL 推断 MIME 类型 */
function guessMimeFromUrl(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    default:
      return 'image/png'
  }
}

/** 应用模板替换 */
function applyTemplate(template: string, userText: string): string {
  if (template.includes('{prompt}')) {
    return template.replace(/\{prompt\}/g, userText)
  }

  if (template.includes('{{userText}}')) {
    return template.replace(/\{\{userText\}\}/g, userText)
  }

  return `${template}\n\n${userText}`
}

// 生成 API

import { Context, Logger } from 'koishi'
import { FileData } from '../../types'
import { getUidFromAuth } from './api-utils'

const logger = new Logger('media-luna/api')

/**
 * 注册生成 API
 */
export function registerGenerateApi(ctx: Context): void {
  const console = ctx.console as any

  // 执行生成请求
  // 注意：使用 function 而非箭头函数，以便访问 this.auth
  console.addListener('media-luna/generate', async function (this: any, request: {
    channelId?: number
    channelName?: string
    presetName?: string
    prompt: string
    files?: any[] // 前端传来的是 ClientFileData，需要转换
    parameters?: Record<string, any>
  }) {
    // 获取 uid
    const uid = getUidFromAuth(ctx, this.auth) ?? undefined

    logger.info('Received generate request:', JSON.stringify({
      channelId: request.channelId ?? null,
      channelName: request.channelName ?? null,
      presetName: request.presetName ?? null,
      prompt: request.prompt?.substring(0, 50),
      filesCount: request.files?.length ?? 0,
      uid: uid ?? null
    }))

    // 转换前端传入的文件数据
    const files: FileData[] = (request.files || []).map(file => {
      // 如果已经是 ArrayBuffer (通常不会，除非通过 socket.io 二进制传输)，直接返回
      if (file.data && file.mime) return file as FileData

      // 处理前端传来的 ClientFileData (base64)
      if (file.base64 && file.mimeType) {
        return {
          data: Buffer.from(file.base64, 'base64'),
          mime: file.mimeType,
          filename: file.filename || 'unknown'
        }
      }
      return null
    }).filter(f => f !== null) as FileData[]

    try {
      if (!request.channelId && !request.channelName) {
        logger.error('Generate failed: Either channelId or channelName is required')
        return { success: false, error: 'Either channelId or channelName is required' }
      }

      let result

      if (request.channelName) {
        logger.info(`Generating by channel name: ${request.channelName}`)
        result = await ctx.mediaLuna.generateByName({
          channelName: request.channelName,
          presetName: request.presetName,
          prompt: request.prompt,
          files,
          uid  // 使用 WebUI session 的 uid
        })
      } else {
        logger.info(`Generating by channel ID: ${request.channelId}`)
        // 合并 parameters，presetName 优先于 parameters.preset
        const parameters = { ...request.parameters }
        if (request.presetName) {
          parameters.preset = request.presetName
        }
        result = await ctx.mediaLuna.generate({
          channel: request.channelId!,
          prompt: request.prompt,
          files,
          parameters,
          uid  // 使用 WebUI session 的 uid
        })
      }

      logger.info(`Generate result: success=${result.success}, output=${result.output?.length ?? 0}`)
      if (!result.success) {
        logger.error(`Generate error: ${result.error}`)
      }

      return { success: result.success, data: result }
    } catch (error) {
      logger.error('Generate exception:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 预览生成请求（不实际执行）
  console.addListener('media-luna/generate/preview', async (request: {
    channelId: number
    presetName?: string
    prompt: string
    parameters?: Record<string, any>
  }) => {
    try {
      if (!request.channelId) {
        return { success: false, error: 'Channel ID is required' }
      }

      const channel = await ctx.mediaLuna.channels.getById(request.channelId)
      if (!channel) {
        return { success: false, error: 'Channel not found' }
      }

      let preset = null
      if (request.presetName && ctx.mediaLuna.presets) {
        preset = await ctx.mediaLuna.presets.getByName(request.presetName)
      }

      const preview: {
        channel: { id: number, name: string, connectorId: string }
        preset: { name: string, promptTemplate: string } | null
        estimatedPrompt: string
        parameters: Record<string, any>
      } = {
        channel: {
          id: channel.id,
          name: channel.name,
          connectorId: channel.connectorId
        },
        preset: preset ? {
          name: preset.name,
          promptTemplate: preset.promptTemplate
        } : null,
        estimatedPrompt: request.prompt,
        parameters: {
          ...channel.pluginOverrides,
          ...request.parameters
        }
      }

      if (preset && preset.promptTemplate) {
        preview.estimatedPrompt = preset.promptTemplate.replace(/\{prompt\}/g, request.prompt)
        preview.parameters = {
          ...preview.parameters,
          ...preset.parameterOverrides
        }
      }

      return { success: true, data: preview }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
}

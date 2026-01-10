// ComfyUI 连接器
// 基于原生 ComfyUI WebSocket API
// 参考 koishi-plugin-comfyclient 的实现

import { Context } from 'koishi'
import type { ConnectorDefinition, FileData, OutputAsset, ConnectorRequestLog } from '../../core'
import { connectorFields, connectorCardFields } from './config'
import { WebSocket } from 'ws'
import FormData from 'form-data'

const PROMPT_PLACEHOLDER = '{{prompt}}'

/** 解析服务器地址 */
function parseServerEndpoint(apiUrl: string): string {
  // 移除协议前缀，获取 host:port
  return apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

/** 获取 HTTP 协议前缀 */
function getHttpProtocol(isSecure: boolean): string {
  return isSecure ? 'https' : 'http'
}

/** 获取 WebSocket 协议前缀 */
function getWsProtocol(isSecure: boolean): string {
  return isSecure ? 'wss' : 'ws'
}

/**
 * 上传图片到 ComfyUI
 */
async function uploadImage(
  ctx: Context,
  serverEndpoint: string,
  isSecure: boolean,
  imageBuffer: ArrayBuffer | Buffer,
  filename: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const formData = new FormData()
    // 确保转换为 Buffer
    const buffer = imageBuffer instanceof Buffer ? imageBuffer : Buffer.from(new Uint8Array(imageBuffer))
    formData.append('image', buffer, filename)
    formData.append('overwrite', 'true')
    formData.append('type', 'input')

    const response = await ctx.http.post(
      `${getHttpProtocol(isSecure)}://${serverEndpoint}/upload/image`,
      formData,
      { headers: formData.getHeaders() }
    )

    return { success: true, data: response }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}

/**
 * 获取执行历史
 */
async function getHistory(
  ctx: Context,
  serverEndpoint: string,
  isSecure: boolean,
  promptId: string
): Promise<any> {
  const url = `${getHttpProtocol(isSecure)}://${serverEndpoint}/history/${promptId}`
  const response = await ctx.http.get(url)
  return response[promptId]
}

/**
 * 获取图片数据
 */
async function getImage(
  ctx: Context,
  serverEndpoint: string,
  isSecure: boolean,
  filename: string,
  subfolder: string = '',
  type: string = 'output'
): Promise<Buffer> {
  const url = `${getHttpProtocol(isSecure)}://${serverEndpoint}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${type}`
  const response = await ctx.http.get(url, { responseType: 'arraybuffer' })
  return Buffer.from(response)
}

/**
 * 修改 workflow 避免缓存（随机化所有 seed）
 */
function modifyWorkflowToAvoidCache(workflow: any, avoidCache: boolean): any {
  if (!avoidCache) return workflow

  const modified = JSON.parse(JSON.stringify(workflow))
  const randomSeed = Math.floor(Math.random() * 1000000000000000)

  for (const nodeId in modified) {
    const node = modified[nodeId]
    if (node.inputs) {
      if (typeof node.inputs.seed !== 'undefined') {
        node.inputs.seed = randomSeed
      }
      if (typeof node.inputs.noise_seed !== 'undefined') {
        node.inputs.noise_seed = randomSeed
      }
    }
  }

  return modified
}

/**
 * 等待执行完成并获取结果
 */
function waitForCompletion(
  ctx: Context,
  serverEndpoint: string,
  isSecure: boolean,
  clientId: string,
  promptId: string,
  timeoutMs: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    const wsUrl = `${getWsProtocol(isSecure)}://${serverEndpoint}/ws?clientId=${clientId}`
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false })

    const timer = setTimeout(() => {
      ws.close()
      reject(new Error('ComfyUI execution timeout'))
    }, timeoutMs)

    ws.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    ws.on('message', async (data, isBinary) => {
      if (isBinary) return

      try {
        const message = JSON.parse(data.toString())

        // 检查执行完成：executing + node === null
        if (
          message.type === 'executing' &&
          message.data.prompt_id === promptId &&
          message.data.node === null
        ) {
          clearTimeout(timer)
          ws.close()

          // 获取历史记录和结果
          try {
            const history = await getHistory(ctx, serverEndpoint, isSecure, promptId)
            resolve(history)
          } catch (e) {
            reject(new Error('Failed to get execution history'))
          }
        }

        // 执行错误
        if (message.type === 'execution_error' && message.data.prompt_id === promptId) {
          clearTimeout(timer)
          ws.close()
          reject(new Error(`ComfyUI Error: ${JSON.stringify(message.data)}`))
        }
      } catch (e) {
        // ignore parse error
      }
    })
  })
}

/** ComfyUI 生成函数 */
async function generate(
  ctx: Context,
  config: Record<string, any>,
  files: FileData[],
  prompt: string
): Promise<OutputAsset[]> {
  const logger = ctx.logger('media-luna')

  const {
    apiUrl,
    isSecureConnection = false,
    workflow,
    promptNodeId,
    imageNodeId,
    avoidCache = true,
    timeout = 300
  } = config

  if (!workflow) {
    throw new Error('未配置 ComfyUI 工作流')
  }

  // 解析服务器地址
  const serverEndpoint = parseServerEndpoint(apiUrl)
  const isSecure = isSecureConnection || apiUrl.startsWith('https')

  // 解析工作流 JSON
  let workflowJson: any
  try {
    workflowJson = JSON.parse(workflow)
  } catch {
    throw new Error('工作流 JSON 格式无效')
  }

  // 1. 随机化 seed（避免缓存）
  workflowJson = modifyWorkflowToAvoidCache(workflowJson, avoidCache)

  // 2. 替换提示词
  const workflowStr = JSON.stringify(workflowJson)
  if (workflowStr.includes(PROMPT_PLACEHOLDER)) {
    // 使用占位符模式
    workflowJson = JSON.parse(workflowStr.replaceAll(PROMPT_PLACEHOLDER, prompt))
  } else if (promptNodeId) {
    // 使用节点 ID 模式
    if (workflowJson[promptNodeId]?.inputs) {
      workflowJson[promptNodeId].inputs.text = prompt
    }
  } else {
    // 自动查找 CLIPTextEncode 节点
    const textNodeKey = Object.keys(workflowJson).find(
      k => workflowJson[k].class_type === 'CLIPTextEncode'
    )
    if (textNodeKey) {
      workflowJson[textNodeKey].inputs.text = prompt
    } else {
      logger.warn('[comfyui] 未找到提示词节点，工作流将使用原始提示词')
    }
  }

  // 3. 处理输入图片
  const imageFile = files.find(f => f.mime?.startsWith('image/'))
  if (imageFile && imageFile.data) {
    const filename = `input_${Date.now()}.png`
    const uploadResult = await uploadImage(ctx, serverEndpoint, isSecure, imageFile.data, filename)

    if (!uploadResult.success) {
      throw new Error(`图片上传失败: ${uploadResult.error}`)
    }

    // 获取上传后的实际文件名
    const uploadedFilename = uploadResult.data?.name || filename

    // 修改 LoadImage 节点
    const loadNodeKey = imageNodeId || Object.keys(workflowJson).find(
      k => workflowJson[k].class_type === 'LoadImage'
    )
    if (loadNodeKey && workflowJson[loadNodeKey]) {
      workflowJson[loadNodeKey].inputs.image = uploadedFilename
    }
  }

  // 4. 生成客户端 ID 并提交任务
  const clientId = Math.random().toString(36).substring(2, 15)

  const queueResponse = await ctx.http.post(
    `${getHttpProtocol(isSecure)}://${serverEndpoint}/prompt`,
    {
      prompt: workflowJson,
      client_id: clientId
    },
    {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
  )

  const promptId = queueResponse.prompt_id
  if (!promptId) {
    throw new Error('提交工作流失败：未返回 prompt_id')
  }

  logger.debug('[comfyui] Workflow queued: %s', promptId)

  // 5. 等待执行完成
  const history = await waitForCompletion(
    ctx,
    serverEndpoint,
    isSecure,
    clientId,
    promptId,
    timeout * 1000
  )

  // 6. 从历史记录中获取输出图片
  const assets: OutputAsset[] = []

  if (history?.outputs) {
    for (const nodeId of Object.keys(history.outputs)) {
      const nodeOutput = history.outputs[nodeId]
      if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
        for (const imageInfo of nodeOutput.images) {
          // 只获取 output 类型的图片
          if (imageInfo.type === 'output' || !imageInfo.type) {
            try {
              const imageBuffer = await getImage(
                ctx,
                serverEndpoint,
                isSecure,
                imageInfo.filename,
                imageInfo.subfolder || '',
                imageInfo.type || 'output'
              )

              const mime = imageInfo.filename.endsWith('.png') ? 'image/png' : 'image/jpeg'
              const base64 = imageBuffer.toString('base64')

              assets.push({
                kind: 'image',
                url: `data:${mime};base64,${base64}`,
                mime,
                meta: {
                  promptId,
                  filename: imageInfo.filename,
                  nodeId
                }
              })
            } catch (e) {
              logger.warn('[comfyui] Failed to get image %s: %s', imageInfo.filename, e)
            }
          }
        }
      }
    }
  }

  if (assets.length === 0) {
    throw new Error('ComfyUI 执行完成但未返回图片')
  }

  return assets
}

/** ComfyUI 连接器定义 */
export const ComfyUIConnector: ConnectorDefinition = {
  id: 'comfyui',
  name: 'ComfyUI',
  description: '基于节点的图像生成工作流，支持自定义 Workflow',
  icon: 'comfyui',
  supportedTypes: ['image'],
  fields: connectorFields,
  cardFields: connectorCardFields,
  defaultTags: ['text2img', 'img2img', 'text2video', 'img2video'],
  generate,

  getRequestLog(config, files, prompt): ConnectorRequestLog {
    const { apiUrl } = config
    return {
      endpoint: apiUrl,
      model: 'comfyui-workflow',
      prompt,
      fileCount: files.length,
      parameters: {}
    }
  }
}

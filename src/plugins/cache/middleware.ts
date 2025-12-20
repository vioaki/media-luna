// 存储中间件 - 将输入文件和生成结果上传到存储后端

import type {
  MiddlewareDefinition,
  MiddlewareContext,
  MiddlewareRunStatus,
  OutputAsset
} from '../../core'
import type { StorageConfig, CachePluginConfig } from './config'
import type { CacheService } from './service'
import { uploadToS3, uploadToWebDav, getExtensionFromMime, type S3Config, type WebDavConfig } from './utils'

// ============ 配置转换 ============

function toS3Config(config: StorageConfig): S3Config {
  return {
    endpoint: config.s3Endpoint,
    region: config.s3Region,
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey,
    bucket: config.s3Bucket,
    publicBaseUrl: config.s3PublicBaseUrl,
    forcePathStyle: config.s3ForcePathStyle,
    acl: config.s3Acl
  }
}

function toWebDavConfig(config: StorageConfig): WebDavConfig {
  return {
    endpoint: config.webdavEndpoint,
    username: config.webdavUsername,
    password: config.webdavPassword,
    basePath: config.webdavBasePath,
    publicBaseUrl: config.webdavPublicBaseUrl
  }
}

// ============ 工具函数 ============

async function downloadAsset(url: string): Promise<{ buffer: Buffer; mime: string }> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`下载失败: ${resp.status}`)
  const arrayBuffer = await resp.arrayBuffer()
  const mime = resp.headers.get('content-type') || 'application/octet-stream'
  return { buffer: Buffer.from(arrayBuffer), mime }
}

/**
 * 上传文件到指定后端
 */
async function uploadToBackend(
  buffer: Buffer,
  filename: string,
  mime: string,
  config: StorageConfig,
  mctx: MiddlewareContext
): Promise<{ url: string; key: string }> {
  switch (config.backend) {
    case 'local': {
      const cacheService = mctx.getService<CacheService>('cache')
      if (!cacheService) {
        throw new Error('本地缓存服务不可用')
      }
      const cached = await cacheService.cache(buffer, mime, filename)
      const url = cacheService.getUrl(cached.id)
      if (!url) {
        throw new Error('无法获取缓存 URL，请检查 selfUrl 配置')
      }
      return { url, key: cached.id }
    }
    case 's3':
      return uploadToS3(buffer, filename, mime, toS3Config(config))
    case 'webdav':
      return uploadToWebDav(buffer, filename, mime, toWebDavConfig(config))
    default:
      throw new Error(`未知的存储后端: ${config.backend}`)
  }
}

// ============ 中间件定义 ============

/**
 * 输入文件存储中间件
 * 在 lifecycle-prepare 阶段将输入文件上传到存储后端
 */
export function createStorageInputMiddleware(): MiddlewareDefinition {
  return {
    name: 'storage-input',
    displayName: '输入文件存储',
    description: '将输入文件上传到存储后端（本地/S3/WebDAV）',
    category: 'cache',
    configGroup: 'cache',  // 关联到 plugin:cache 配置
    phase: 'lifecycle-prepare',
    // 配置在 cache 插件的"扩展插件"面板中设置

    async execute(mctx: MiddlewareContext, next): Promise<MiddlewareRunStatus> {
      // 从中间件配置获取实时配置（而不是 CacheService 的缓存配置）
      const config = await mctx.getMiddlewareConfig<CachePluginConfig>('cache')

      // 没有配置或禁用时跳过
      if (!config || !config.enabled) {
        return next()
      }

      // 没有文件或配置为 none 时跳过
      if (!mctx.files || mctx.files.length === 0 || config.backend === 'none') {
        return next()
      }

      const cacheService = mctx.getService<CacheService>('cache')
      if (!cacheService && config.backend === 'local') {
        mctx.setMiddlewareLog('storage-input', { error: '本地缓存服务不可用' })
        return next()
      }

      const uploadLogs: Array<{ index: number; filename: string; url?: string; error?: string }> = []
      const uploadedUrls: string[] = []

      for (let i = 0; i < mctx.files.length; i++) {
        const file = mctx.files[i]

        if (!file.data || file.data.byteLength === 0) {
          continue
        }

        try {
          const buffer = Buffer.from(file.data)
          const ext = getExtensionFromMime(file.mime)
          const filename = `input-${i}${ext}`

          const result = await uploadToBackend(buffer, filename, file.mime, config, mctx)

          uploadedUrls.push(result.url)
          uploadLogs.push({ index: i, filename: file.filename, url: result.url })
        } catch (error) {
          uploadLogs.push({
            index: i,
            filename: file.filename,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      if (uploadedUrls.length > 0) {
        mctx.store.set('inputFileUrls', uploadedUrls)
      }

      mctx.setMiddlewareLog('storage-input', {
        backend: config.backend,
        total: mctx.files.length,
        uploaded: uploadLogs.filter(l => l.url).length,
        failed: uploadLogs.filter(l => l.error).length,
        urls: uploadedUrls,
        logs: uploadLogs
      })

      return next()
    }
  }
}

/**
 * 输出存储中间件
 * 在 lifecycle-post-request 阶段将生成结果上传到存储后端
 */
export function createStorageMiddleware(): MiddlewareDefinition {
  return {
    name: 'storage',
    displayName: '存储缓存',
    description: '将生成结果上传到存储后端（本地/S3/WebDAV）',
    category: 'cache',
    configGroup: 'cache',  // 关联到 plugin:cache 配置
    phase: 'lifecycle-post-request',
    // 配置在 cache 插件的"扩展插件"面板中设置

    async execute(mctx: MiddlewareContext, next): Promise<MiddlewareRunStatus> {
      // 从中间件配置获取实时配置（而不是 CacheService 的缓存配置）
      const config = await mctx.getMiddlewareConfig<CachePluginConfig>('cache')

      // 没有配置或禁用时跳过
      if (!config || !config.enabled) {
        return next()
      }

      // 没有输出或配置为 none 时跳过
      if (!mctx.output || mctx.output.length === 0 || config.backend === 'none') {
        return next()
      }

      const cacheService = mctx.getService<CacheService>('cache')
      if (!cacheService && config.backend === 'local') {
        mctx.setMiddlewareLog('storage', { error: '本地缓存服务不可用' })
        return next()
      }

      const uploadedAssets: OutputAsset[] = []
      const uploadLogs: Array<{ index: number; originalUrl: string; newUrl?: string; error?: string }> = []

      for (let i = 0; i < mctx.output.length; i++) {
        const asset = mctx.output[i]

        // 跳过文本类型或没有 URL 的资产
        if (asset.kind === 'text' || !asset.url) {
          uploadedAssets.push(asset)
          continue
        }

        try {
          const { buffer, mime } = await downloadAsset(asset.url)
          const filename = `output-${asset.kind}-${i}`

          const result = await uploadToBackend(buffer, filename, mime, config, mctx)

          const isBase64 = asset.url.startsWith('data:')
          uploadedAssets.push({
            ...asset,
            url: result.url,
            meta: {
              ...asset.meta,
              ...(isBase64 ? {} : { originalUrl: asset.url }),
              storageKey: result.key,
              storageBackend: config.backend
            }
          })

          uploadLogs.push({
            index: i,
            originalUrl: isBase64 ? '[base64 data]' : asset.url,
            newUrl: result.url
          })
        } catch (error) {
          uploadedAssets.push(asset)
          const isBase64 = asset.url.startsWith('data:')
          uploadLogs.push({
            index: i,
            originalUrl: isBase64 ? '[base64 data]' : asset.url,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      mctx.output = uploadedAssets

      mctx.setMiddlewareLog('storage', {
        backend: config.backend,
        total: mctx.output.length,
        uploaded: uploadLogs.filter(l => l.newUrl).length,
        failed: uploadLogs.filter(l => l.error).length,
        logs: uploadLogs
      })

      return next()
    }
  }
}

// 缓存服务 - 本地文件缓存（使用数据库存储元数据）

import { Context } from 'koishi'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { PluginLogger } from '../../core'
import { createPluginLogger } from '../../core'
import type { CachePluginConfig } from './config'
import type { MediaLunaAssetCache } from '../../types/augmentations'

/** 缓存文件元数据（兼容旧接口） */
export interface CachedFile {
  id: string
  filename: string
  mime: string
  size: number
  createdAt: Date
  accessedAt: Date
  localPath: string
  /** 可访问的 URL */
  url?: string
}

/** 缓存统计 */
export interface CacheStats {
  totalFiles: number
  totalSizeMB: number
  maxSizeMB: number
  oldestAccess: Date | null
  newestAccess: Date | null
}

/**
 * 本地缓存服务
 * 提供文件缓存和 HTTP 访问支持
 * 使用数据库存储元数据，支持 sourceHash 和 contentHash 两级去重
 */
export class CacheService {
  private logger: PluginLogger
  private ctx: Context
  private cacheRoot: string
  private publicPath: string
  private publicBaseUrl: string | null
  private config: CachePluginConfig
  /** 基础URL（从 selfUrl 获取），用于生成访问链接 */
  private baseUrl: string = ''
  /** 内存缓存（加速查询） */
  private memoryCache: Map<string, CachedFile> = new Map()
  /** 是否已初始化 */
  private initialized: boolean = false

  constructor(ctx: Context, config: CachePluginConfig) {
    this.ctx = ctx
    this.logger = createPluginLogger(ctx.logger('media-luna'), 'cache')
    this.config = config

    // 使用配置的目录路径，或默认值
    this.cacheRoot = path.join(ctx.baseDir, config.cacheDir || 'data/media-luna/cache')
    this.publicPath = config.publicPath || '/media-luna/cache'
    this.publicBaseUrl = config.publicBaseUrl?.replace(/\/$/, '') || null

    this.ensureDir(this.cacheRoot)

    // 异步初始化
    this.initialize().catch(e => {
      this.logger.error('Failed to initialize cache service: %s', e)
    })

    this.logger.info('Cache service initialized at: %s', this.cacheRoot)
  }

  /** 异步初始化 */
  private async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 从数据库加载到内存缓存
      await this.loadFromDatabase()
      // 清理过期缓存
      await this.cleanupExpired()
      this.initialized = true
    } catch (e) {
      this.logger.error('Cache initialization failed: %s', e)
    }
  }

  /** 从数据库加载缓存元数据到内存 */
  private async loadFromDatabase(): Promise<void> {
    try {
      const records = await this.ctx.database.get('medialuna_asset_cache', {})
      for (const record of records) {
        const localPath = path.join(this.cacheRoot, `${record.contentHash}${this.getExtensionFromMime(record.mimeType)}`)
        this.memoryCache.set(record.contentHash, {
          id: record.contentHash,
          filename: path.basename(record.cachedKey),
          mime: record.mimeType,
          size: record.fileSize,
          createdAt: record.createdAt,
          accessedAt: record.lastAccessedAt,
          localPath,
          url: record.cachedUrl
        })
      }
      this.logger.debug('Loaded %d cache entries from database', records.length)
    } catch (e) {
      this.logger.warn('Failed to load cache from database: %s', e)
    }
  }

  /** 更新配置 */
  updateConfig(config: Partial<CachePluginConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /** 设置基础URL */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '')
    this.logger.debug('Base URL set to: %s', this.baseUrl)
  }

  /** 获取基础URL */
  getBaseUrl(): string {
    return this.baseUrl
  }

  /** 检查缓存是否启用 */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /** 获取完整配置（供中间件使用） */
  getConfig(): CachePluginConfig {
    return this.config
  }

  /**
   * 缓存文件到本地
   * @param data 文件数据
   * @param mime MIME 类型
   * @param filename 文件名
   * @param sourceUrl 可选的源 URL（用于 sourceHash 去重）
   */
  async cache(data: Buffer | ArrayBuffer, mime: string, filename?: string, sourceUrl?: string): Promise<CachedFile> {
    if (!this.config.enabled) {
      throw new Error('Cache is disabled')
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

    const sizeMB = buffer.length / (1024 * 1024)
    if (sizeMB > this.config.maxFileSize) {
      throw new Error(`File too large: ${sizeMB.toFixed(2)}MB > ${this.config.maxFileSize}MB`)
    }

    // 计算内容哈希
    const contentHash = this.generateContentHash(buffer)

    // 检查是否已有相同内容的缓存
    const existingByContent = await this.findByContentHash(contentHash)
    if (existingByContent) {
      // 更新访问时间
      await this.updateAccessTime(existingByContent.contentHash)
      this.logger.debug('Cache hit by content hash: %s', contentHash)
      return this.dbRecordToCachedFile(existingByContent)
    }

    // 确保有足够空间
    await this.ensureCacheSpace(buffer.length)

    // 写入文件
    const ext = this.getExtension(mime, filename)
    const localPath = path.join(this.cacheRoot, `${contentHash}${ext}`)
    fs.writeFileSync(localPath, buffer)

    // 计算源哈希（如果有源 URL）
    const sourceHash = sourceUrl ? this.generateSourceHash(sourceUrl) : contentHash

    // 生成访问 URL
    const cachedUrl = this.buildUrl(contentHash, ext)

    // 保存到数据库
    const now = new Date()
    await this.ctx.database.create('medialuna_asset_cache', {
      sourceUrl: sourceUrl || '',
      sourceHash,
      contentHash,
      backend: 'local',
      cachedUrl,
      cachedKey: `${contentHash}${ext}`,
      mimeType: mime,
      fileSize: buffer.length,
      createdAt: now,
      lastAccessedAt: now
    })

    const cached: CachedFile = {
      id: contentHash,
      filename: filename || `file${ext}`,
      mime,
      size: buffer.length,
      createdAt: now,
      accessedAt: now,
      localPath,
      url: cachedUrl
    }

    // 更新内存缓存
    this.memoryCache.set(contentHash, cached)

    this.logger.debug('Cached file: %s (%s, %sMB)', contentHash, cached.filename, sizeMB.toFixed(2))
    return cached
  }

  /**
   * 从 URL 下载并缓存
   * 支持 sourceHash 去重：相同 URL 不会重复下载
   */
  async cacheFromUrl(url: string): Promise<CachedFile> {
    // 先检查是否已有相同源 URL 的缓存
    const sourceHash = this.generateSourceHash(url)
    const existingBySource = await this.findBySourceHash(sourceHash)
    if (existingBySource) {
      // 更新访问时间
      await this.updateAccessTime(existingBySource.contentHash)
      this.logger.debug('Cache hit by source hash: %s -> %s', url, sourceHash)
      return this.dbRecordToCachedFile(existingBySource)
    }

    // 下载文件
    const response = await this.ctx.http.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer'
    })

    const mime = this.guessMimeFromUrl(url)
    const filename = url.split('/').pop()?.split('?')[0] || 'downloaded'

    // 缓存时传入源 URL
    return this.cache(response, mime, filename, url)
  }

  /** 获取缓存文件的访问URL */
  getUrl(id: string): string | null {
    const cached = this.memoryCache.get(id)
    if (!cached) return null

    if (cached.url) return cached.url

    const ext = path.extname(cached.localPath)
    return this.buildUrl(id, ext)
  }

  /** 获取缓存文件信息 */
  async get(id: string): Promise<CachedFile | null> {
    // 先查内存缓存
    let cached = this.memoryCache.get(id)

    if (!cached) {
      // 查数据库
      const record = await this.findByContentHash(id)
      if (!record) return null
      cached = this.dbRecordToCachedFile(record)
      this.memoryCache.set(id, cached)
    }

    // 检查文件是否存在
    if (!fs.existsSync(cached.localPath)) {
      await this.deleteFromDatabase(id)
      this.memoryCache.delete(id)
      return null
    }

    // 更新访问时间
    await this.updateAccessTime(id)
    cached.accessedAt = new Date()

    return cached
  }

  /** 读取缓存文件内容 */
  async read(id: string): Promise<Buffer | null> {
    const cached = await this.get(id)
    if (!cached) return null

    try {
      return fs.readFileSync(cached.localPath)
    } catch (e) {
      this.logger.warn('Failed to read cached file: %s', id)
      return null
    }
  }

  /** 读取为 Data URL */
  async readAsDataUrl(id: string): Promise<string | null> {
    const cached = await this.get(id)
    if (!cached) return null

    const buffer = await this.read(id)
    if (!buffer) return null

    return `data:${cached.mime};base64,${buffer.toString('base64')}`
  }

  /** 删除缓存文件 */
  async delete(id: string): Promise<boolean> {
    const cached = this.memoryCache.get(id)

    try {
      // 删除本地文件
      if (cached && fs.existsSync(cached.localPath)) {
        fs.unlinkSync(cached.localPath)
      }

      // 从数据库删除
      await this.deleteFromDatabase(id)

      // 从内存缓存删除
      this.memoryCache.delete(id)

      return true
    } catch (e) {
      this.logger.warn('Failed to delete cached file: %s', id)
      return false
    }
  }

  /** 获取统计信息 */
  async getStats(): Promise<CacheStats> {
    const records = await this.ctx.database.get('medialuna_asset_cache', {})

    let oldest: Date | null = null
    let newest: Date | null = null
    let totalSize = 0

    for (const record of records) {
      totalSize += record.fileSize
      if (!oldest || record.lastAccessedAt < oldest) oldest = record.lastAccessedAt
      if (!newest || record.lastAccessedAt > newest) newest = record.lastAccessedAt
    }

    return {
      totalFiles: records.length,
      totalSizeMB: totalSize / (1024 * 1024),
      maxSizeMB: this.config.maxCacheSize,
      oldestAccess: oldest,
      newestAccess: newest
    }
  }

  /** 清空所有缓存 */
  async clearAll(): Promise<void> {
    // 获取所有缓存记录
    const records = await this.ctx.database.get('medialuna_asset_cache', {})

    // 删除所有本地文件
    for (const record of records) {
      const localPath = path.join(this.cacheRoot, record.cachedKey)
      try {
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath)
        }
      } catch (e) {
        this.logger.warn('Failed to delete file: %s', localPath)
      }
    }

    // 清空数据库
    await this.ctx.database.remove('medialuna_asset_cache', {})

    // 清空内存缓存
    this.memoryCache.clear()

    this.logger.info('All cache cleared')
  }

  // ========== 数据库操作方法 ==========

  /** 通过 sourceHash 查找缓存 */
  private async findBySourceHash(sourceHash: string): Promise<MediaLunaAssetCache | null> {
    const records = await this.ctx.database.get('medialuna_asset_cache', { sourceHash })
    return records[0] || null
  }

  /** 通过 contentHash 查找缓存 */
  private async findByContentHash(contentHash: string): Promise<MediaLunaAssetCache | null> {
    const records = await this.ctx.database.get('medialuna_asset_cache', { contentHash })
    return records[0] || null
  }

  /** 更新访问时间 */
  private async updateAccessTime(contentHash: string): Promise<void> {
    try {
      await this.ctx.database.set('medialuna_asset_cache', { contentHash }, {
        lastAccessedAt: new Date()
      })
    } catch (e) {
      this.logger.warn('Failed to update access time: %s', e)
    }
  }

  /** 从数据库删除 */
  private async deleteFromDatabase(contentHash: string): Promise<void> {
    await this.ctx.database.remove('medialuna_asset_cache', { contentHash })
  }

  /** 将数据库记录转换为 CachedFile */
  private dbRecordToCachedFile(record: MediaLunaAssetCache): CachedFile {
    const localPath = path.join(this.cacheRoot, record.cachedKey)
    return {
      id: record.contentHash,
      filename: path.basename(record.cachedKey),
      mime: record.mimeType,
      size: record.fileSize,
      createdAt: record.createdAt,
      accessedAt: record.lastAccessedAt,
      localPath,
      url: record.cachedUrl
    }
  }

  // ========== 私有工具方法 ==========

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  /** 生成内容哈希（基于文件内容） */
  private generateContentHash(data: Buffer | ArrayBuffer): string {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
    return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
  }

  /** 生成源哈希（基于 URL） */
  private generateSourceHash(url: string): string {
    return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16)
  }

  private getExtension(mime: string, filename?: string): string {
    if (filename) {
      const ext = path.extname(filename)
      if (ext) return ext
    }
    return this.getExtensionFromMime(mime)
  }

  private getExtensionFromMime(mime: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'video/mp4': '.mp4',
      'video/webm': '.webm'
    }
    return mimeMap[mime] || '.bin'
  }

  private guessMimeFromUrl(url: string): string {
    const ext = url.split('.').pop()?.toLowerCase()?.split('?')[0]
    const mimeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'mp4': 'video/mp4',
      'webm': 'video/webm'
    }
    return mimeMap[ext || ''] || 'application/octet-stream'
  }

  /** 构建访问 URL */
  private buildUrl(id: string, ext: string): string {
    // 优先使用配置的 publicBaseUrl
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${id}${ext}`
    }

    // 否则使用 selfUrl + publicPath
    if (!this.baseUrl) {
      try {
        // 尝试从 server 服务获取 selfUrl
        const server = (this.ctx as any).get?.('server')
        const selfUrl = server?.config?.selfUrl
        if (selfUrl) {
          this.baseUrl = selfUrl.replace(/\/$/, '')
          this.logger.debug('Base URL dynamically set to: %s', this.baseUrl)
        } else {
          // 如果没有配置 selfUrl，尝试使用 localhost + 端口
          const port = server?.config?.port || 5140
          this.baseUrl = `http://127.0.0.1:${port}`
          this.logger.debug('Base URL set to localhost: %s', this.baseUrl)
        }
      } catch {
        // 忽略错误，使用默认值
        this.baseUrl = 'http://127.0.0.1:5140'
      }
    }

    if (!this.baseUrl) {
      // 返回相对路径作为降级
      this.logger.debug('Base URL not set, returning relative path for cache: %s', id)
      return `${this.publicPath}/${id}${ext}`
    }

    return `${this.baseUrl}${this.publicPath}/${id}${ext}`
  }

  private async ensureCacheSpace(needed: number): Promise<void> {
    const maxBytes = this.config.maxCacheSize * 1024 * 1024

    // 从数据库获取当前缓存大小
    const records = await this.ctx.database.get('medialuna_asset_cache', {})
    let currentSize = records.reduce((sum, r) => sum + r.fileSize, 0)

    if (currentSize + needed <= maxBytes) return

    // 按访问时间排序，删除最旧的
    const sorted = [...records].sort((a, b) =>
      a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime()
    )

    for (const record of sorted) {
      if (currentSize + needed <= maxBytes) break
      await this.delete(record.contentHash)
      currentSize -= record.fileSize
    }
  }

  private async cleanupExpired(): Promise<void> {
    if (this.config.expireDays === 0) return

    const now = new Date()
    const expireMs = this.config.expireDays * 24 * 60 * 60 * 1000
    const expireDate = new Date(now.getTime() - expireMs)

    // 查询过期的缓存
    const records = await this.ctx.database.get('medialuna_asset_cache', {})
    const toDelete = records.filter(r => r.lastAccessedAt < expireDate)

    for (const record of toDelete) {
      await this.delete(record.contentHash)
    }

    if (toDelete.length > 0) {
      this.logger.info('Cleaned up %d expired cache entries', toDelete.length)
    }
  }
}

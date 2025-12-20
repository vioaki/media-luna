// 缓存插件配置字段定义

import type { ConfigField } from '../../core'

// ============ 本地缓存配置 ============

/** 本地缓存配置 */
export interface LocalCacheConfig {
  /** 是否启用本地缓存 */
  enabled: boolean
  /** 缓存目录路径（相对于 Koishi 根目录） */
  cacheDir: string
  /** HTTP 路由路径 */
  publicPath: string
  /** 外部访问 URL 前缀（可选，留空则使用 selfUrl + publicPath） */
  publicBaseUrl?: string
  /** 最大缓存大小（MB） */
  maxCacheSize: number
  /** 单个文件最大大小（MB） */
  maxFileSize: number
  /** 缓存过期时间（天），0 表示永不过期 */
  expireDays: number
}

// ============ 存储后端配置 ============

/** 外部存储配置 */
export interface StorageConfig {
  /** 存储后端 */
  backend: 'local' | 'none' | 's3' | 'webdav'

  // S3 配置
  s3Endpoint?: string
  s3Region?: string
  s3AccessKeyId?: string
  s3SecretAccessKey?: string
  s3Bucket?: string
  s3PublicBaseUrl?: string
  s3ForcePathStyle?: boolean
  s3Acl?: 'private' | 'public-read'

  // WebDAV 配置
  webdavEndpoint?: string
  webdavUsername?: string
  webdavPassword?: string
  webdavBasePath?: string
  webdavPublicBaseUrl?: string
}

// ============ 完整配置（插件级） ============

/** 完整缓存插件配置 */
export interface CachePluginConfig extends LocalCacheConfig, StorageConfig {}

/** 完整配置字段（在"扩展插件"面板显示） */
export const cacheConfigFields: ConfigField[] = [
  // 基础配置
  {
    key: 'enabled',
    label: '启用缓存',
    type: 'boolean',
    default: true,
    description: '是否启用文件缓存功能'
  },
  {
    key: 'backend',
    label: '存储后端',
    type: 'select',
    default: 'local',
    options: [
      { label: '本地存储（通过 HTTP 访问）', value: 'local' },
      { label: '不使用（保留原始 URL）', value: 'none' },
      { label: 'S3 兼容存储', value: 's3' },
      { label: 'WebDAV', value: 'webdav' }
    ],
    description: '选择存储后端用于缓存生成结果'
  },

  // ========== 本地存储配置 ==========
  {
    key: 'cacheDir',
    label: '缓存目录',
    type: 'text',
    default: 'data/media-luna/cache',
    placeholder: 'data/media-luna/cache',
    description: '本地缓存目录路径（相对于 Koishi 根目录）',
    showWhen: { field: 'backend', value: 'local' }
  },
  {
    key: 'publicPath',
    label: 'URL 路径',
    type: 'text',
    default: '/media-luna/cache',
    placeholder: '/media-luna/cache',
    description: 'HTTP 路由路径（会注册到 Koishi 服务器）',
    showWhen: { field: 'backend', value: 'local' }
  },
  {
    key: 'publicBaseUrl',
    label: '外部访问地址',
    type: 'text',
    placeholder: 'https://cdn.example.com/media-luna/cache',
    description: '对外访问的完整 URL 前缀（留空则使用 selfUrl + 路径）',
    showWhen: { field: 'backend', value: 'local' }
  },
  {
    key: 'maxCacheSize',
    label: '最大缓存大小',
    type: 'number',
    default: 500,
    description: '本地缓存最大占用空间（MB）',
    showWhen: { field: 'backend', value: 'local' }
  },
  {
    key: 'maxFileSize',
    label: '单文件大小限制',
    type: 'number',
    default: 50,
    description: '单个文件最大大小（MB）',
    showWhen: { field: 'backend', value: 'local' }
  },
  {
    key: 'expireDays',
    label: '缓存过期时间',
    type: 'number',
    default: 30,
    description: '缓存过期时间（天），0 表示永不过期',
    showWhen: { field: 'backend', value: 'local' }
  },

  // ========== S3 配置 ==========
  {
    key: 's3Endpoint',
    label: 'S3 端点',
    type: 'text',
    placeholder: 'https://s3.amazonaws.com',
    description: 'S3 兼容服务端点地址',
    showWhen: { field: 'backend', value: 's3' }
  },
  {
    key: 's3Region',
    label: 'S3 区域',
    type: 'text',
    default: 'us-east-1',
    placeholder: 'us-east-1',
    showWhen: { field: 'backend', value: 's3' }
  },
  {
    key: 's3AccessKeyId',
    label: 'Access Key ID',
    type: 'text',
    showWhen: { field: 'backend', value: 's3' }
  },
  {
    key: 's3SecretAccessKey',
    label: 'Secret Access Key',
    type: 'password',
    showWhen: { field: 'backend', value: 's3' }
  },
  {
    key: 's3Bucket',
    label: 'Bucket 名称',
    type: 'text',
    placeholder: 'my-bucket',
    showWhen: { field: 'backend', value: 's3' }
  },
  {
    key: 's3PublicBaseUrl',
    label: '公开访问 URL',
    type: 'text',
    placeholder: 'https://cdn.example.com',
    description: 'CDN 或直接访问的 URL 前缀（可选）',
    showWhen: { field: 'backend', value: 's3' }
  },
  {
    key: 's3ForcePathStyle',
    label: '强制路径风格',
    type: 'boolean',
    default: false,
    description: '使用路径风格而非虚拟主机风格（适用于 MinIO 等）',
    showWhen: { field: 'backend', value: 's3' }
  },
  {
    key: 's3Acl',
    label: 'ACL 权限',
    type: 'select',
    default: 'public-read',
    options: [
      { label: '公开读取', value: 'public-read' },
      { label: '私有', value: 'private' }
    ],
    showWhen: { field: 'backend', value: 's3' }
  },

  // WebDAV 配置
  {
    key: 'webdavEndpoint',
    label: 'WebDAV 端点',
    type: 'text',
    placeholder: 'https://dav.example.com/files',
    description: 'WebDAV 服务根地址',
    showWhen: { field: 'backend', value: 'webdav' }
  },
  {
    key: 'webdavUsername',
    label: '用户名',
    type: 'text',
    showWhen: { field: 'backend', value: 'webdav' }
  },
  {
    key: 'webdavPassword',
    label: '密码',
    type: 'password',
    showWhen: { field: 'backend', value: 'webdav' }
  },
  {
    key: 'webdavBasePath',
    label: '基础路径',
    type: 'text',
    placeholder: 'media-luna',
    description: '上传文件的目录路径（可选）',
    showWhen: { field: 'backend', value: 'webdav' }
  },
  {
    key: 'webdavPublicBaseUrl',
    label: '公开访问 URL',
    type: 'text',
    placeholder: 'https://files.example.com',
    description: '对外访问的 URL 前缀（若与端点不同）',
    showWhen: { field: 'backend', value: 'webdav' }
  }
]

/** 默认配置 */
export const defaultCacheConfig: CachePluginConfig = {
  enabled: true,
  cacheDir: 'data/media-luna/cache',
  publicPath: '/media-luna/cache',
  maxCacheSize: 500,
  maxFileSize: 50,
  expireDays: 30,
  backend: 'local'
}

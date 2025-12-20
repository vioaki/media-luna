// WebDAV 工具模块
// WebDAV 存储的上传工具函数

/** WebDAV 配置接口 */
export interface WebDavConfig {
  endpoint?: string
  username?: string
  password?: string
  basePath?: string
  publicBaseUrl?: string
}

/** Base64 编码 */
function b64(str: string): string {
  return Buffer.from(str, 'utf8').toString('base64')
}

/** 去除尾部斜杠 */
function trimSlash(s: string): string {
  return s.replace(/\/+$/, '')
}

/** URL 编码路径 */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

/**
 * 确保 WebDAV 基础路径存在（创建必要的目录）
 */
async function ensureWebDavBasePath(config: WebDavConfig): Promise<void> {
  const base = (config.basePath || '').replace(/^\/+|\/+$/g, '')
  if (!base) return

  const segments = base.split('/').filter(Boolean)
  let current = ''

  for (const seg of segments) {
    current = current ? `${current}/${seg}` : seg
    const url = `${trimSlash(config.endpoint!)}/${encodePath(current)}`
    try {
      await fetch(url, {
        method: 'MKCOL',
        headers: {
          'Authorization': `Basic ${b64(`${config.username}:${config.password}`)}`
        }
      })
    } catch {
      // 忽略错误（目录可能已存在）
    }
  }
}

/**
 * 上传文件到 WebDAV
 */
export async function uploadToWebDav(
  buffer: Buffer,
  filename: string,
  mime: string,
  config: WebDavConfig
): Promise<{ url: string; key: string }> {
  if (!config.endpoint || !config.username || !config.password) {
    throw new Error('WebDAV 缺少必要配置')
  }

  await ensureWebDavBasePath(config)

  const remotePath = config.basePath
    ? `${config.basePath.replace(/\/+$/, '')}/${filename}`
    : filename
  const url = `${trimSlash(config.endpoint)}/${encodePath(remotePath)}`

  const headers: Record<string, string> = {
    'Authorization': `Basic ${b64(`${config.username}:${config.password}`)}`,
  }
  if (mime) headers['Content-Type'] = mime

  const res = await fetch(url, {
    method: 'PUT',
    headers: headers as any,
    body: new Uint8Array(buffer)
  })
  if (!res.ok) throw new Error(`WebDAV 上传失败: ${res.status}`)

  const publicUrl = config.publicBaseUrl
    ? `${trimSlash(config.publicBaseUrl)}/${encodePath(remotePath)}`
    : url
  return { url: publicUrl, key: remotePath }
}

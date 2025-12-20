// MIME 类型工具模块
// 统一的 MIME 类型处理函数

/**
 * MIME 类型到扩展名的映射
 */
const mimeToExtensionMap: Record<string, string> = {
  // 图片
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/avif': '.avif',

  // 音频
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/flac': '.flac',
  'audio/aac': '.aac',
  'audio/mp4': '.m4a',
  'audio/opus': '.opus',

  // 视频
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/x-msvideo': '.avi',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  'video/x-flv': '.flv',

  // 文档
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/json': '.json',
}

/**
 * 根据 MIME 类型获取扩展名
 */
export function getExtensionFromMime(mime: string): string {
  const baseMime = mime.split(';')[0].trim().toLowerCase()
  return mimeToExtensionMap[baseMime] || '.bin'
}

/**
 * 根据 URL 和可选的 MIME 类型获取扩展名
 */
export function getExtension(url: string, mime?: string): string {
  // 优先从 MIME 类型推断
  if (mime) {
    const ext = getExtensionFromMime(mime)
    if (ext !== '.bin') return ext
  }

  // 从 URL 提取
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/)
    if (match) return '.' + match[1].toLowerCase()
  } catch {}

  return '.bin'
}

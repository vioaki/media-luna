/**
 * 格式化工具函数
 */

/**
 * 格式化时间戳为本地时间字符串
 */
export const formatDate = (dateStr: string | Date): string => {
  if (!dateStr) return '-'
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return date.toLocaleString()
}

/**
 * 格式化相对时间（如 "2分钟前"）
 */
export const formatRelativeTime = (dateStr: string | Date): string => {
  if (!dateStr) return '-'
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

/**
 * 格式化持续时间（毫秒 -> 可读字符串）
 */
export const formatDuration = (ms: number): string => {
  if (ms === undefined || ms === null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}m ${seconds}s`
}

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * 格式化数字（添加千位分隔符）
 */
export const formatNumber = (num: number): string => {
  if (num === undefined || num === null) return '-'
  return num.toLocaleString()
}

/**
 * 格式化货币值
 */
export const formatCurrency = (value: number, suffix?: string): string => {
  if (value === undefined || value === null) return '-'
  if (value === 0) return '免费'
  return suffix ? `${value} ${suffix}` : String(value)
}

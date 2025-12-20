/**
 * 中间件分类定义
 */

export interface CategoryDefinition {
  id: string
  label: string
  icon?: string
  order: number
}

/** 中间件分类列表 */
export const CATEGORIES: CategoryDefinition[] = [
  { id: 'billing', label: '计费模块', icon: 'coins', order: 1 },
  { id: 'transform', label: '转换处理', icon: 'edit', order: 2 },
  { id: 'cache', label: '缓存模块', icon: 'folder', order: 3 },
  { id: 'preset', label: '预设模块', icon: 'bookmark', order: 4 },
  { id: 'request', label: '请求模块', icon: 'link', order: 5 },
  { id: 'task', label: '任务模块', icon: 'clipboard', order: 6 },
  { id: 'other', label: '其他', icon: 'more', order: 99 }
]

/** 分类 ID 到标签的映射 */
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c.label])
)

/** 获取分类定义 */
export function getCategory(id: string): CategoryDefinition | undefined {
  return CATEGORIES.find(c => c.id === id)
}

/** 获取分类标签 */
export function getCategoryLabel(id: string): string {
  return CATEGORY_LABELS[id] || id
}

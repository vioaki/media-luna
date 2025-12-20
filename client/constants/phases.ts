/**
 * 中间件生命周期阶段定义
 */

export interface PhaseDefinition {
  id: string
  label: string
  color: string
  order: number
}

/** 生命周期阶段列表 */
export const PHASES: PhaseDefinition[] = [
  { id: 'lifecycle-prepare', label: '准备', color: '#909399', order: 1 },
  { id: 'lifecycle-pre-request', label: '预处理', color: '#e6a23c', order: 2 },
  { id: 'lifecycle-request', label: '请求', color: '#409eff', order: 3 },
  { id: 'lifecycle-post-request', label: '后处理', color: '#67c23a', order: 4 },
  { id: 'lifecycle-finalize', label: '完成', color: '#909399', order: 5 }
]

/** 阶段 ID 到标签的映射 */
export const PHASE_LABELS: Record<string, string> = Object.fromEntries(
  PHASES.map(p => [p.id, p.label])
)

/** 阶段 ID 到颜色的映射 */
export const PHASE_COLORS: Record<string, string> = Object.fromEntries(
  PHASES.map(p => [p.id, p.color])
)

/** 获取阶段定义 */
export function getPhase(id: string): PhaseDefinition | undefined {
  return PHASES.find(p => p.id === id)
}

/** 获取阶段标签 */
export function getPhaseLabel(id: string): string {
  return PHASE_LABELS[id] || id
}

/** 获取阶段颜色 */
export function getPhaseColor(id: string): string {
  return PHASE_COLORS[id] || '#909399'
}

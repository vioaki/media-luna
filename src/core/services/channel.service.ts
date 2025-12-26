// 渠道服务

import { Context } from 'koishi'
import { ChannelConfig } from '../types'
import type { MediaLunaChannel } from '../../augmentations'

/**
 * 渠道服务
 *
 * 管理渠道的 CRUD 操作
 */
export class ChannelService {
  private _ctx: Context

  constructor(ctx: Context) {
    this._ctx = ctx
  }

  /** 将数据库记录转换为 ChannelConfig */
  private _toConfig(record: MediaLunaChannel): ChannelConfig {
    return {
      id: record.id,
      name: record.name,
      enabled: record.enabled,
      connectorId: record.connectorId,
      connectorConfig: JSON.parse(record.connectorConfig || '{}'),
      pluginOverrides: JSON.parse(record.pluginOverrides || '{}'),
      tags: JSON.parse(record.tags || '[]')
    }
  }

  /** 获取所有渠道 */
  async list(): Promise<ChannelConfig[]> {
    const records = await this._ctx.database.get('medialuna_channel', {})
    return records.map(r => this._toConfig(r))
  }

  /** 获取启用的渠道 */
  async listEnabled(): Promise<ChannelConfig[]> {
    const records = await this._ctx.database.get('medialuna_channel', { enabled: true })
    return records.map(r => this._toConfig(r))
  }

  /** 根据 ID 获取渠道 */
  async getById(id: number): Promise<ChannelConfig | null> {
    const records = await this._ctx.database.get('medialuna_channel', { id })
    return records.length > 0 ? this._toConfig(records[0]) : null
  }

  /** 根据名称获取渠道 */
  async getByName(name: string): Promise<ChannelConfig | null> {
    const records = await this._ctx.database.get('medialuna_channel', { name })
    return records.length > 0 ? this._toConfig(records[0]) : null
  }

  /**
   * 根据标签获取渠道（匹配任意一个标签）
   * 用于 Koishi 层指令注册：通过 tag 匹配规则注册 渠道名.预设名 指令
   */
  async getByTags(tags: string[]): Promise<ChannelConfig[]> {
    const records = await this._ctx.database.get('medialuna_channel', { enabled: true })
    return records
      .map(r => this._toConfig(r))
      .filter(c => tags.some(tag => c.tags.includes(tag)))
  }

  /**
   * 根据标签获取渠道（匹配所有标签）
   */
  async getByAllTags(tags: string[]): Promise<ChannelConfig[]> {
    const records = await this._ctx.database.get('medialuna_channel', { enabled: true })
    return records
      .map(r => this._toConfig(r))
      .filter(c => tags.every(tag => c.tags.includes(tag)))
  }

  /** 获取所有唯一标签 */
  async getAllTags(): Promise<string[]> {
    const records = await this._ctx.database.get('medialuna_channel', {})
    const tagSet = new Set<string>()
    for (const record of records) {
      const tags: string[] = JSON.parse(record.tags || '[]')
      tags.forEach(tag => tagSet.add(tag))
    }
    return Array.from(tagSet).sort()
  }

  /**
   * 生成唯一名称
   * 如果名称已存在，自动添加数字后缀
   */
  private async _generateUniqueName(baseName: string, excludeId?: number): Promise<string> {
    let name = baseName
    let counter = 1

    while (true) {
      const existing = await this.getByName(name)
      if (!existing || existing.id === excludeId) {
        return name
      }
      counter++
      name = `${baseName}-${counter}`
    }
  }

  /** 创建渠道 */
  async create(config: Omit<ChannelConfig, 'id'>): Promise<ChannelConfig> {
    const now = new Date()
    // 自动处理名称冲突
    const uniqueName = await this._generateUniqueName(config.name)

    const record = await this._ctx.database.create('medialuna_channel', {
      name: uniqueName,
      displayName: uniqueName, // 保持数据库兼容，使用 name 作为 displayName
      enabled: config.enabled,
      connectorId: config.connectorId,
      connectorConfig: JSON.stringify(config.connectorConfig),
      pluginOverrides: JSON.stringify(config.pluginOverrides),
      tags: JSON.stringify(config.tags),
      createdAt: now,
      updatedAt: now
    })

    this._ctx.emit('mediaLuna/channel-updated', record.id)
    return this._toConfig(record)
  }

  /** 更新渠道 */
  async update(id: number, config: Partial<Omit<ChannelConfig, 'id'>>): Promise<ChannelConfig | null> {
    const existing = await this.getById(id)
    if (!existing) return null

    const updateData: Partial<MediaLunaChannel> = {
      updatedAt: new Date()
    }

    if (config.name !== undefined) {
      // 如果名称变更，检查唯一性
      const uniqueName = await this._generateUniqueName(config.name, id)
      updateData.name = uniqueName
      updateData.displayName = uniqueName // 保持数据库兼容
    }
    if (config.enabled !== undefined) updateData.enabled = config.enabled
    if (config.connectorId !== undefined) updateData.connectorId = config.connectorId
    if (config.connectorConfig !== undefined) updateData.connectorConfig = JSON.stringify(config.connectorConfig)
    if (config.pluginOverrides !== undefined) updateData.pluginOverrides = JSON.stringify(config.pluginOverrides)
    if (config.tags !== undefined) updateData.tags = JSON.stringify(config.tags)

    await this._ctx.database.set('medialuna_channel', { id }, updateData)

    this._ctx.emit('mediaLuna/channel-updated', id)
    return this.getById(id)
  }

  /** 删除渠道 */
  async delete(id: number): Promise<boolean> {
    const existing = await this.getById(id)
    if (!existing) return false

    await this._ctx.database.remove('medialuna_channel', { id })
    this._ctx.emit('mediaLuna/channel-updated', id)
    return true
  }
}

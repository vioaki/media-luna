// 设置面板 API

import { Context } from 'koishi'

/**
 * 注册设置面板 API
 */
export function registerSettingsApi(ctx: Context): void {
  const console = ctx.console as any

  // 获取所有设置面板
  console.addListener('media-luna/settings/panels', async () => {
    try {
      const panels = await ctx.mediaLuna.getSettingsPanelInfos()
      return { success: true, data: panels }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取单个设置面板配置
  console.addListener('media-luna/settings/get', async ({ id }: { id: string }) => {
    try {
      const panels = await ctx.mediaLuna.getSettingsPanelInfos()
      const panel = panels.find(p => p.id === id)
      if (!panel) {
        return { success: false, error: 'Settings panel not found' }
      }
      return { success: true, data: panel }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 更新设置面板配置（仅支持 custom 类型）
  console.addListener('media-luna/settings/update', async ({
    id,
    config
  }: {
    id: string
    config: Record<string, any>
  }) => {
    try {
      const panel = ctx.mediaLuna.settingsPanels.find(p => p.id === id)
      if (!panel) {
        return { success: false, error: 'Settings panel not found' }
      }
      if (panel.type !== 'custom' || !panel.configKey) {
        return { success: false, error: 'This panel does not support custom configuration' }
      }

      // 使用 ConfigService 保存配置
      ctx.mediaLuna.configService.set(panel.configKey, config)

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取远程预设同步配置
  console.addListener('media-luna/settings/remote-presets/config', async () => {
    try {
      const config = await ctx.mediaLuna.getRemotePresetConfig()
      return { success: true, data: config }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 更新远程预设同步配置
  console.addListener('media-luna/settings/remote-presets/update', async ({
    config
  }: {
    config: Partial<{
      apiUrl: string
      autoSync: boolean
      syncInterval: number
      deleteRemoved: boolean
    }>
  }) => {
    try {
      await ctx.mediaLuna.setRemotePresetConfig(config)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 手动触发远程预设同步
  console.addListener('media-luna/settings/remote-presets/sync', async () => {
    try {
      const config = await ctx.mediaLuna.getRemotePresetConfig()
      const remotePresets = ctx.mediaLuna.remotePresets
      if (!remotePresets) {
        return { success: false, error: 'Remote presets service not available' }
      }
      const result = await remotePresets.sync(config.apiUrl, config.deleteRemoved)
      return {
        success: true,
        data: {
          added: result.added,
          updated: result.updated,
          removed: result.removed,
          notModified: result.notModified
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 强制同步（清除 ETag 缓存后同步）
  console.addListener('media-luna/settings/remote-presets/force-sync', async () => {
    try {
      const config = await ctx.mediaLuna.getRemotePresetConfig()
      const remotePresets = ctx.mediaLuna.remotePresets
      if (!remotePresets) {
        return { success: false, error: 'Remote presets service not available' }
      }
      // 清除 ETag 缓存，强制完整拉取
      remotePresets.clearEtagCache(config.apiUrl)
      const result = await remotePresets.sync(config.apiUrl, config.deleteRemoved)
      return {
        success: true,
        data: {
          added: result.added,
          updated: result.updated,
          removed: result.removed,
          notModified: result.notModified
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
}

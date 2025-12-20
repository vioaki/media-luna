// ConfigService - 统一配置管理服务
// 使用 YAML 文件存储配置

import { Context } from 'koishi'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'yaml'
import type { PluginLogger, ConfigField } from '../types'
import { createPluginLogger } from '../logger'

export interface ConfigServiceOptions {
  /** 配置文件目录（相对于 Koishi data 目录） */
  configDir?: string
  /** 配置文件名 */
  configFile?: string
}

const DEFAULT_OPTIONS: Required<ConfigServiceOptions> = {
  configDir: 'media-luna',
  configFile: 'config.yaml'
}

/**
 * ConfigService - 统一配置管理
 *
 * 将插件配置统一存储在 data/media-luna/config.yaml 中
 * 支持按 section 分组存取，自动处理默认值
 */
export class ConfigService {
  private logger: PluginLogger
  private options: Required<ConfigServiceOptions>
  private configRoot: string
  private configPath: string
  private config: Record<string, any> = {}
  private defaults: Map<string, Record<string, any>> = new Map()
  private saveTimer: NodeJS.Timeout | null = null

  constructor(ctx: Context, options: ConfigServiceOptions = {}) {
    this.logger = createPluginLogger(ctx.logger('media-luna'), 'config')
    this.options = { ...DEFAULT_OPTIONS, ...options }

    // 使用 Koishi 的 baseDir 作为根目录
    this.configRoot = path.join(ctx.baseDir, 'data', this.options.configDir)
    this.configPath = path.join(this.configRoot, this.options.configFile)

    // 确保目录存在
    this.ensureDir(this.configRoot)

    // 加载配置
    this.loadConfig()

    this.logger.info('Config service initialized: %s', this.configPath)
  }

  /** 确保目录存在 */
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  /** 加载配置文件 */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8')
        this.config = yaml.parse(content) || {}
        this.logger.debug('Loaded config with %d sections', Object.keys(this.config).length)
      } else {
        this.config = {}
        this.saveConfigSync()
      }
    } catch (e) {
      this.logger.warn('Failed to load config file: %s', e)
      this.config = {}
    }
  }

  /** 同步保存配置文件 */
  private saveConfigSync(): void {
    try {
      const content = yaml.stringify(this.config, {
        indent: 2,
        lineWidth: 120
      })
      fs.writeFileSync(this.configPath, content, 'utf-8')
      this.logger.debug('Config saved')
    } catch (e) {
      this.logger.error('Failed to save config: %s', e)
    }
  }

  /** 延迟保存配置（防抖） */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    this.saveTimer = setTimeout(() => {
      this.saveConfigSync()
      this.saveTimer = null
    }, 500)
  }

  /**
   * 注册 section 的默认值
   *
   * 插件首次加载时调用，如果配置文件中没有该 section，
   * 则自动写入默认值
   */
  registerDefaults(section: string, defaults: Record<string, any>): void {
    this.defaults.set(section, defaults)

    // 如果配置中没有该 section，写入默认值
    if (!(section in this.config)) {
      this.config[section] = { ...defaults }
      this.scheduleSave()
      this.logger.info('Initialized config section "%s" with defaults', section)
    } else {
      // 合并缺失的默认值
      let hasNew = false
      for (const [key, value] of Object.entries(defaults)) {
        if (!(key in this.config[section])) {
          this.config[section][key] = value
          hasNew = true
        }
      }
      if (hasNew) {
        this.scheduleSave()
        this.logger.debug('Merged missing defaults into section "%s"', section)
      }
    }
  }

  /**
   * 从 ConfigField[] 生成默认值并注册
   */
  registerDefaultsFromFields(section: string, fields: ConfigField[]): void {
    const defaults: Record<string, any> = {}
    for (const field of fields) {
      if (field.default !== undefined) {
        defaults[field.key] = field.default
      }
    }
    if (Object.keys(defaults).length > 0) {
      this.registerDefaults(section, defaults)
    }
  }

  /**
   * 获取指定 section 的配置
   * 如果 section 不存在，返回默认值或空对象
   */
  get<T extends Record<string, any>>(section: string, overrideDefaults?: T): T {
    const value = this.config[section]

    // 合并默认值：注册的默认值 < overrideDefaults < 实际值
    const registeredDefaults = this.defaults.get(section) || {}
    const defaults = { ...registeredDefaults, ...overrideDefaults }

    if (value === undefined) {
      return defaults as T
    }

    return { ...defaults, ...value } as T
  }

  /**
   * 设置指定 section 的配置（覆盖）
   */
  set<T extends Record<string, any>>(section: string, value: T): void {
    this.config[section] = value
    this.scheduleSave()
  }

  /**
   * 更新指定 section 的配置（合并）
   */
  update<T extends Record<string, any>>(section: string, partial: Partial<T>): T {
    const current = this.get<T>(section)
    const updated = { ...current, ...partial }
    this.set(section, updated)
    return updated
  }

  /**
   * 删除指定 section
   */
  delete(section: string): boolean {
    if (section in this.config) {
      delete this.config[section]
      this.scheduleSave()
      return true
    }
    return false
  }

  /**
   * 获取所有 section 名称
   */
  getSections(): string[] {
    return Object.keys(this.config)
  }

  /**
   * 获取完整配置（只读）
   */
  getAll(): Readonly<Record<string, any>> {
    return { ...this.config }
  }

  /**
   * 检查 section 是否存在
   */
  has(section: string): boolean {
    return section in this.config
  }

  /**
   * 强制立即保存
   */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.saveConfigSync()
  }

  /**
   * 重新加载配置（从文件）
   */
  reload(): void {
    this.loadConfig()
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath
  }

  /**
   * 获取配置根目录
   */
  getConfigRoot(): string {
    return this.configRoot
  }
}

/**
 * 星渊仙途 - 存档系统
 *
 * 职责：
 * - save(state): 序列化为 JSON 写入 localStorage
 * - load(): 读取 JSON 反序列化，校验版本并执行迁移
 * - 自动存档：每30秒 + 页面关闭前
 * - 离线收益结算
 * - 存档导入/导出
 *
 * 设计参考：补充-存档数据结构.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState } from '../core/GameState';
import { createNewPlayerState } from '../core/GameState';

const SAVE_KEY = 'xingyan_xiantu_save';
const BACKUP_PREFIX = 'xingyan_backup_';
const SAVE_VERSION = 1;

export class SaveSystem implements GameSystem {
  readonly name = 'Save';

  private state: PlayerState;
  private events: EventBus;

  constructor(state: PlayerState, events: EventBus) {
    this.state = state;
    this.events = events;
  }

  update(_dt: number): void {}

  /**
   * 保存存档到 localStorage
   */
  save(): boolean {
    try {
      this.state.lastSavedAt = Date.now();
      const serialized = JSON.stringify(this.state);

      // 写入主存档
      localStorage.setItem(SAVE_KEY, serialized);

      // 写入备份
      const backupKey = `${BACKUP_PREFIX}${this.state.lastSavedAt}`;
      localStorage.setItem(backupKey, serialized);

      // 清理旧备份（保留3个）
      this.pruneOldBackups(3);

      this.events.emit('save:completed', { timestamp: this.state.lastSavedAt });
      return true;
    } catch (e) {
      console.error('[存档] 保存失败:', e);
      return false;
    }
  }

  /**
   * 从 localStorage 加载存档
   */
  load(): PlayerState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<PlayerState>;
      const migrated = this.migrateIfNeeded(parsed);

      if (!this.validate(migrated)) {
        console.warn('[存档] 数据校验失败，尝试从备份恢复');
        return this.loadFromBackup();
      }

      return migrated;
    } catch (e) {
      console.error('[存档] 加载失败:', e);
      return this.loadFromBackup();
    }
  }

  /**
   * 版本迁移
   *
   * 始终与默认值合并，确保新增字段有默认值
   */
  private migrateIfNeeded(data: Partial<PlayerState>): PlayerState {
    const defaults = createNewPlayerState();
    const merged = this.deepMerge(defaults, data) as PlayerState;
    merged.version = SAVE_VERSION;
    return merged;
  }

  /**
   * 深度合并
   */
  private deepMerge(target: unknown, source: unknown): unknown {
    if (source === null || source === undefined) return target;
    if (typeof source !== 'object' || typeof target !== 'object') return source;
    if (Array.isArray(source)) return source;

    const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
    const sourceObj = source as Record<string, unknown>;

    for (const key of Object.keys(sourceObj)) {
      if (
        key in result &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = this.deepMerge(result[key], sourceObj[key]);
      } else {
        result[key] = sourceObj[key];
      }
    }

    return result;
  }

  /**
   * 数据校验
   *
   * 检查关键字段存在且类型正确，防止损坏存档导致运行时错误
   */
  private validate(state: Partial<PlayerState>): state is PlayerState {
    if (!state || typeof state !== 'object') return false;
    if (typeof state.version !== 'number') return false;

    // 境界
    if (!state.realm || typeof state.realm.level !== 'number') return false;
    if (state.realm.level < 1) return false;

    // 货币
    if (!state.currency || typeof state.currency.starCoins !== 'number') return false;
    if (state.currency.starCoins < 0) return false;

    // 星球
    if (!state.planets) return false;

    // 属性
    if (!state.stats || typeof state.stats.attack !== 'number') return false;

    // 基础属性
    if (!state.baseStats || typeof state.baseStats.attack !== 'number') return false;

    // 背包
    if (!state.inventory) return false;

    // 装备
    if (!state.equippedGear) return false;

    return true;
  }

  /**
   * 从备份恢复
   */
  private loadFromBackup(): PlayerState | null {
    const backups: { key: string; timestamp: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(BACKUP_PREFIX)) {
        const ts = parseInt(key.replace(BACKUP_PREFIX, ''), 10);
        if (!isNaN(ts)) backups.push({ key, timestamp: ts });
      }
    }

    if (backups.length === 0) return null;

    // 按时间戳降序
    backups.sort((a, b) => b.timestamp - a.timestamp);

    for (const backup of backups) {
      try {
        const raw = localStorage.getItem(backup.key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (this.validate(parsed)) {
          console.warn(`[存档] 从备份 ${backup.key} 恢复成功`);
          return this.migrateIfNeeded(parsed);
        }
      } catch {
        // skip invalid backup
      }
    }

    return null;
  }

  /**
   * 清理旧备份
   */
  private pruneOldBackups(keepCount: number): void {
    const backups: { key: string; timestamp: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(BACKUP_PREFIX)) {
        const ts = parseInt(key.replace(BACKUP_PREFIX, ''), 10);
        if (!isNaN(ts)) backups.push({ key, timestamp: ts });
      }
    }

    if (backups.length <= keepCount) return;

    backups.sort((a, b) => b.timestamp - a.timestamp);
    for (let i = keepCount; i < backups.length; i++) {
      const backup = backups[i];
      if (backup) localStorage.removeItem(backup.key);
    }
  }

  /**
   * 删除存档
   */
  deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(BACKUP_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }

  /**
   * 导出存档为 JSON 字符串
   */
  exportSave(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * 从 JSON 字符串导入存档
   */
  importSave(json: string): PlayerState | null {
    try {
      const parsed = JSON.parse(json);
      const migrated = this.migrateIfNeeded(parsed);
      if (!this.validate(migrated)) return null;
      return migrated;
    } catch {
      return null;
    }
  }

  /**
   * 绑定自动保存事件（页面关闭/切后台）
   */
  bindAutoSaveEvents(): void {
    window.addEventListener('beforeunload', () => {
      this.save();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.save();
      }
    });
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {}
}

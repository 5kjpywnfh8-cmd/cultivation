/**
 * 星渊仙途 - 境界修炼系统
 *
 * 职责：
 * - 管理当前境界等级、星元累积、突破逻辑
 * - update(dt) 中按公式累积星元
 * - 突破时校验星元是否足够，触发 realm:changed 事件
 * - 提供境界属性查询接口
 *
 * 设计参考：01-游戏核心设计.md、04-装备系统.md 境界基数
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState, RealmName } from '../core/GameState';

/** 境界属性数据 */
export interface RealmStats {
  level: number;
  realm: RealmName;
  tier: number;
  attack: number;
  defense: number;
  hp: number;
  starYuanCost: number;
}

/** 境界配置表项 */
interface RealmLevelData {
  level: number;
  realm: string;
  tier: number;
  attack: number;
  defense: number;
  hp: number;
  starYuanCost: number;
}

/** 境界名到等级范围的映射 */
const REALM_RANGES: { realm: RealmName; minLevel: number; maxLevel: number }[] = [
  { realm: '练气', minLevel: 1, maxLevel: 10 },
  { realm: '筑基', minLevel: 11, maxLevel: 20 },
  { realm: '金丹', minLevel: 21, maxLevel: 30 },
  { realm: '元婴', minLevel: 31, maxLevel: 40 },
  { realm: '化神', minLevel: 41, maxLevel: 50 },
  { realm: '渡劫', minLevel: 51, maxLevel: 60 },
  { realm: '无限', minLevel: 61, maxLevel: Infinity },
];

export class RealmSystem implements GameSystem {
  readonly name = 'Realm';

  private state: PlayerState;
  private events: EventBus;
  private realmData: RealmLevelData[];

  /** 基础星元获取速率（每秒） */
  private baseStarYuanRate = 1;

  constructor(state: PlayerState, events: EventBus, realmData: RealmLevelData[]) {
    this.state = state;
    this.events = events;
    this.realmData = realmData;
  }

  /**
   * 每帧更新：累积星元
   */
  update(dt: number): void {
    const rate = this.getStarYuanRate();
    const gain = rate * dt;

    this.state.realm.starYuan += gain;

    // 检查是否可以突破（仅提示，不自动突破）
    if (this.state.realm.starYuan >= this.state.realm.starYuanToNext) {
      this.events.emit('realm:canBreakthrough', {
        level: this.state.realm.level,
        realm: this.state.realm.realm,
        tier: this.state.realm.tier,
      });
    }
  }

  /**
   * 获取当前境界属性
   */
  getRealmStats(level: number): RealmStats | null {
    const data = this.realmData.find(d => d.level === level);
    if (!data) return null;
    return {
      level: data.level,
      realm: data.realm as RealmName,
      tier: data.tier,
      attack: data.attack,
      defense: data.defense,
      hp: data.hp,
      starYuanCost: data.starYuanCost,
    };
  }

  /**
   * 获取当前境界属性（快捷方法）
   */
  getCurrentStats(): RealmStats | null {
    return this.getRealmStats(this.state.realm.level);
  }

  /**
   * 获取星元获取速率（每秒）
   *
   * 公式：baseRate × (1 + 功法加成 + 成就加成 + 科技加成)
   */
  getStarYuanRate(): number {
    let rate = this.baseStarYuanRate;

    // 境界等级影响基础速率
    rate += this.state.realm.level * 0.5;

    // 功法加成（聚灵术 +10%）
    const gatheringArt = this.state.skills['gathering_art'];
    if (gatheringArt?.status === 'learned') {
      rate *= 1.10;
    }

    // 周目星元倍率
    rate *= this.state.cycle.starYuanMultiplier;

    return rate;
  }

  /**
   * 境界突破
   *
   * 消耗星元、更新等级、触发事件、校验新境界解锁内容。
   * 返回是否突破成功。
   */
  breakthrough(): boolean {
    const realm = this.state.realm;

    // 检查是否满星元
    if (realm.starYuan < realm.starYuanToNext) {
      return false;
    }

    // 检查是否已达上限（60级渡劫10阶，除非周目解锁）
    if (realm.level >= 60 && !this.state.cycle.endlessUnlocked) {
      return false;
    }

    // 消耗星元
    realm.starYuan -= realm.starYuanToNext;

    // 提升等级
    const oldLevel = realm.level;
    const oldRealm = realm.realm;

    realm.level += 1;

    // 更新境界名和阶
    const range = REALM_RANGES.find(r => realm.level >= r.minLevel && realm.level <= r.maxLevel);
    if (range) {
      realm.realm = range.realm;
      realm.tier = realm.level - range.minLevel + 1;
    }

    // 更新下一级星元需求
    const nextStats = this.getRealmStats(realm.level);
    if (nextStats) {
      realm.starYuanToNext = nextStats.starYuanCost;
    }

    // 更新玩家基础属性
    this.updatePlayerStats();

    // 判断是否大境界突破
    const isMajorBreakthrough = oldRealm !== realm.realm;

    // 触发事件
    this.events.emit('realm:levelUp', {
      level: realm.level,
      realm: realm.realm,
      tier: realm.tier,
      oldLevel,
    });

    if (isMajorBreakthrough) {
      this.events.emit('realm:breakthrough', {
        from: oldRealm,
        to: realm.realm,
        level: realm.level,
      });
    }

    // 更新离线上限
    this.updateOfflineLimit();

    return true;
  }

  /**
   * 更新玩家基础属性（基于境界）
   */
  private updatePlayerStats(): void {
    const stats = this.getCurrentStats();
    if (!stats) return;

    this.state.stats.attack = stats.attack;
    this.state.stats.defense = stats.defense;
    this.state.stats.hp = stats.hp;
    this.state.stats.currentHp = stats.hp;
  }

  /**
   * 更新离线收益上限（按境界递增）
   *
   * 练气 28800（8h）/ 筑基 43200（12h）/ 金丹 57600（16h）
   * 元婴 72000（20h）/ 化神 86400（24h）/ 渡劫 100800（28h）
   * 无限 115200（32h）
   */
  private updateOfflineLimit(): void {
    const realm = this.state.realm.realm;
    const limits: Record<RealmName, number> = {
      '练气': 28800,
      '筑基': 43200,
      '金丹': 57600,
      '元婴': 72000,
      '化神': 86400,
      '渡劫': 100800,
      '无限': 115200,
    };
    this.state.offlineConfig.maxOfflineSeconds = limits[realm] ?? 28800;
  }

  /**
   * 存档前回调
   */
  beforeSave(): void {
    // 境界系统无额外缓存数据需要同步
  }

  /**
   * 读档后回调：重新计算属性
   */
  afterLoad(): void {
    this.updatePlayerStats();
    this.updateOfflineLimit();
  }

  /**
   * 重置（新游戏）
   */
  reset(): void {
    this.state.realm = {
      realm: '练气', tier: 1, level: 1,
      starYuan: 0, starYuanToNext: 100,
    };
    this.updatePlayerStats();
    this.updateOfflineLimit();
  }
}

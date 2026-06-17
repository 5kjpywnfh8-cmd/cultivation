/**
 * 星渊仙途 - 副本系统
 *
 * 职责：
 * - 日常副本（星尘矿洞/灵药园/冥界试炼/雷域秘境/混沌幻境）
 * - 每日限定次数，通关奖励灵石和材料
 *
 * 设计参考：06-战斗与Boss系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState, DungeonId } from '../core/GameState';
import { addToInventory } from '../utils/inventory';

/** 副本配置 */
interface DungeonConfig {
  id: DungeonId;
  name: string;
  description: string;
  unlockLevel: number;
  dailyMax: number;
  weeklyMax?: number;
  rewards: { id: string; min: number; max: number }[];
  spiritStoneReward: { min: number; max: number };
  bossStats: { attack: number; defense: number; hp: number };
}

/** 副本配置表 */
const DUNGEON_CONFIGS: Record<DungeonId, DungeonConfig> = {
  stardustMine: {
    id: 'stardustMine',
    name: '星尘矿洞',
    description: '蕴含丰富星尘的矿洞',
    unlockLevel: 5,
    dailyMax: 3,
    rewards: [
      { id: 'star_dust', min: 20, max: 50 },
      { id: 'iron_ore', min: 30, max: 60 },
    ],
    spiritStoneReward: { min: 2, max: 3 },
    bossStats: { attack: 25, defense: 15, hp: 3000 },
  },
  herbGarden: {
    id: 'herbGarden',
    name: '灵药园',
    description: '灵气浓郁的药园',
    unlockLevel: 10,
    dailyMax: 3,
    rewards: [
      { id: 'herb', min: 20, max: 40 },
      { id: 'spirit_liquid', min: 15, max: 30 },
    ],
    spiritStoneReward: { min: 2, max: 4 },
    bossStats: { attack: 35, defense: 20, hp: 5000 },
  },
  netherTrial: {
    id: 'netherTrial',
    name: '冥界试炼',
    description: '亡灵聚集的试炼场',
    unlockLevel: 21,
    dailyMax: 3,
    rewards: [
      { id: 'soul_stone', min: 15, max: 30 },
      { id: 'dark_moss', min: 20, max: 40 },
    ],
    spiritStoneReward: { min: 3, max: 5 },
    bossStats: { attack: 80, defense: 50, hp: 15000 },
  },
  thunderRealm: {
    id: 'thunderRealm',
    name: '雷域秘境',
    description: '永恒雷暴的秘境',
    unlockLevel: 31,
    dailyMax: 3,
    rewards: [
      { id: 'sky_crystal', min: 10, max: 25 },
      { id: 'arc_stone', min: 15, max: 30 },
    ],
    spiritStoneReward: { min: 3, max: 5 },
    bossStats: { attack: 150, defense: 100, hp: 40000 },
  },
  chaosVision: {
    id: 'chaosVision',
    name: '混沌幻境',
    description: '空间扭曲的幻境',
    unlockLevel: 41,
    dailyMax: 3,
    rewards: [
      { id: 'chaos_stone', min: 5, max: 15 },
      { id: 'void_vine', min: 8, max: 20 },
    ],
    spiritStoneReward: { min: 4, max: 6 },
    bossStats: { attack: 300, defense: 200, hp: 100000 },
  },
  abyssRift: {
    id: 'abyssRift',
    name: '深渊裂隙',
    description: '深渊裂隙（周常）',
    unlockLevel: 41,
    dailyMax: 0,
    weeklyMax: 3,
    rewards: [],
    spiritStoneReward: { min: 5, max: 10 },
    bossStats: { attack: 500, defense: 300, hp: 200000 },
  },
  tribulation: {
    id: 'tribulation',
    name: '渡劫副本',
    description: '九重天劫挑战',
    unlockLevel: 51,
    dailyMax: 1,
    rewards: [],
    spiritStoneReward: { min: 8, max: 15 },
    bossStats: { attack: 800, defense: 500, hp: 500000 },
  },
  ancientTrial: {
    id: 'ancientTrial',
    name: '太古试炼',
    description: '太古试炼（三周目解锁）',
    unlockLevel: 61,
    dailyMax: 1,
    rewards: [],
    spiritStoneReward: { min: 10, max: 20 },
    bossStats: { attack: 2000, defense: 1000, hp: 2000000 },
  },
};

export class DungeonSystem implements GameSystem {
  readonly name = 'Dungeon';

  private state: PlayerState;
  private events: EventBus;

  constructor(state: PlayerState, events: EventBus) {
    this.state = state;
    this.events = events;
  }

  /**
   * 每帧更新：检查每日重置
   */
  update(_dt: number): void {
    this.checkDailyReset();
  }

  /**
   * 检查每日重置
   */
  private checkDailyReset(): void {
    const now = Date.now();
    const today = new Date().toDateString();

    for (const record of this.state.combat.dungeons) {
      const lastReset = new Date(record.lastResetAt).toDateString();
      if (lastReset !== today) {
        record.dailyUsed = 0;
        record.lastResetAt = now;
      }

      // 周常重置（周一）
      if (record.weeklyMax > 0) {
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 1 && record.weeklyResetAt > 0) {
          const lastWeeklyReset = new Date(record.weeklyResetAt).toDateString();
          if (lastWeeklyReset !== today) {
            record.weeklyUsed = 0;
            record.weeklyResetAt = now;
          }
        }
      }
    }
  }

  /**
   * 挑战副本
   */
  challengeDungeon(dungeonId: DungeonId): { victory: boolean; rewards: Record<string, number>; spiritStones: number } | null {
    const config = DUNGEON_CONFIGS[dungeonId];
    if (!config) return null;

    // 检查解锁条件
    if (this.state.realm.level < config.unlockLevel) return null;

    // 检查次数
    const record = this.state.combat.dungeons.find(d => d.id === dungeonId);
    if (!record) return null;

    if (config.dailyMax > 0 && record.dailyUsed >= config.dailyMax) return null;
    if (config.weeklyMax && record.weeklyUsed >= (config.weeklyMax ?? 0)) return null;

    // 简化战斗：直接判定胜利（基于战力对比）
    const playerPower = this.state.stats.attack * 10 + this.state.stats.defense * 5 + this.state.stats.hp;
    const bossPower = config.bossStats.attack * 10 + config.bossStats.defense * 5 + config.bossStats.hp;
    const victory = playerPower >= bossPower * 0.5;

    if (!victory) {
      this.events.emit('combat:defeat', { dungeonId });
      return { victory: false, rewards: {}, spiritStones: 0 };
    }

    // 发放奖励
    const rewards: Record<string, number> = {};
    for (const reward of config.rewards) {
      const amount = reward.min + Math.floor(Math.random() * (reward.max - reward.min + 1));
      rewards[reward.id] = amount;
      addToInventory(this.state, reward.id, reward.id, amount, 'resource');
    }

    // 灵石奖励
    const spiritStones = config.spiritStoneReward.min + Math.floor(Math.random() * (config.spiritStoneReward.max - config.spiritStoneReward.min + 1));
    this.state.currency.spiritStones += spiritStones;

    // 更新次数
    record.dailyUsed += 1;
    if (config.weeklyMax) {
      record.weeklyUsed += 1;
    }

    // 更新统计
    this.state.stats_log.totalDungeonClears += 1;

    this.events.emit('combat:victory', { dungeonId, rewards, spiritStones });
    return { victory: true, rewards, spiritStones };
  }

  /**
   * 获取副本信息
   */
  getDungeonInfo(dungeonId: DungeonId): {
    config: DungeonConfig;
    used: number;
    max: number;
    available: boolean;
  } | null {
    const config = DUNGEON_CONFIGS[dungeonId];
    if (!config) return null;

    const record = this.state.combat.dungeons.find(d => d.id === dungeonId);
    const used = record?.dailyUsed ?? 0;
    const max = config.dailyMax;
    const available = this.state.realm.level >= config.unlockLevel && used < max;

    return { config, used, max, available };
  }

  /**
   * 获取所有副本列表
   */
  getDungeonList(): { id: DungeonId; name: string; available: boolean; used: number; max: number }[] {
    return Object.values(DUNGEON_CONFIGS).map(config => {
      const record = this.state.combat.dungeons.find(d => d.id === config.id);
      const used = record?.dailyUsed ?? 0;
      const available = this.state.realm.level >= config.unlockLevel && used < config.dailyMax;
      return {
        id: config.id,
        name: config.name,
        available,
        used,
        max: config.dailyMax,
      };
    });
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {}
}

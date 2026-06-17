/**
 * 星渊仙途 - 强化系统
 *
 * 职责：
 * - 装备强化（消耗强化石 + 星币）
 * - 强化系数查询：1.25^level
 * - 强化成功率：max(5%, 100% - level × 0.5%)
 * - 一周目上限+15
 * - 失败惩罚：+5以上失败降1级，+10以上失败降2级
 *
 * 设计参考：04-装备系统.md 强化部分
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState } from '../core/GameState';
import type { AffixSystem } from './AffixSystem';

/** 强化配置 */
interface EnhanceConfig {
  enhanceCoefficientBase: number;
  enhanceCoefficientDecayLevel?: number;
  enhanceCoefficientDecayRate?: number;
  maxEnhanceLevel: Record<string, number>;
  successRateFormula: {
    baseRate: number;
    decreasePerLevel: number;
    minRate: number;
  };
  costFormula: {
    stonesBase: number;
    stonesPerEnhanceLevel: number;
    starCoinsBase: number;
    starCoinsRealmPower: number;
    starCoinsEnhanceMultiplier: number;
  };
  failurePenalty: {
    safeLevel: number;
    penaltyLevels: { minLevel: number; maxLevel: number; downgrade: number }[];
  };
}

export interface EnhanceResult {
  success: boolean;
  newLevel: number;
  cost: { stones: number; starCoins: number };
  message: string;
}

export class EnhanceSystem implements GameSystem {
  readonly name = 'Enhance';

  private state: PlayerState;
  private events: EventBus;
  private config: EnhanceConfig;
  private affixSystem: AffixSystem | null = null;

  constructor(state: PlayerState, events: EventBus, config: EnhanceConfig, affixSystem?: AffixSystem) {
    this.state = state;
    this.events = events;
    this.affixSystem = affixSystem ?? null;
    this.config = config;
  }

  update(_dt: number): void {}

  /**
   * 强化装备
   */
  enhance(equipmentId: string): EnhanceResult | null {
    const equipment = this.state.allEquipment[equipmentId];
    if (!equipment) return null;

    // 检查强化上限
    const maxLevel = this.getMaxEnhanceLevel();
    if (equipment.enhanceLevel >= maxLevel) {
      return {
        success: false,
        newLevel: equipment.enhanceLevel,
        cost: { stones: 0, starCoins: 0 },
        message: `已达强化上限 +${maxLevel}`,
      };
    }

    // 计算消耗
    const cost = this.getEnhanceCost(equipment.enhanceLevel);

    // 检查材料
    const stoneItem = this.state.inventory.items['enhancementStone'];
    if (!stoneItem || stoneItem.quantity < cost.stones) {
      return {
        success: false,
        newLevel: equipment.enhanceLevel,
        cost,
        message: '强化石不足',
      };
    }

    // 检查星币
    if (this.state.currency.starCoins < cost.starCoins) {
      return {
        success: false,
        newLevel: equipment.enhanceLevel,
        cost,
        message: '星币不足',
      };
    }

    // 扣除消耗
    stoneItem.quantity -= cost.stones;
    if (stoneItem.quantity <= 0) {
      delete this.state.inventory.items['enhancementStone'];
    }
    this.state.currency.starCoins -= cost.starCoins;

    // 判定成功/失败
    const successRate = this.getSuccessRate(equipment.enhanceLevel);
    const roll = Math.random();
    const success = roll < successRate;

    if (success) {
      // 强化成功
      equipment.enhanceLevel += 1;

      // 每+5强化等级获得额外词条槽（+5/+10/+15...）
      if (equipment.enhanceLevel % 5 === 0 && this.affixSystem) {
        const newSlotCount = 3 + Math.floor(equipment.enhanceLevel / 10);
        if (newSlotCount > equipment.totalAffixSlots) {
          this.affixSystem.generateAffixes(equipment, newSlotCount);
        }
      }

      // 更新统计
      this.state.stats_log.totalEnhanceCount += 1;
      if (equipment.enhanceLevel > this.state.stats_log.highestEnhanceLevel) {
        this.state.stats_log.highestEnhanceLevel = equipment.enhanceLevel;
      }

      this.events.emit('equipment:enhanced', {
        equipment,
        newLevel: equipment.enhanceLevel,
        success: true,
      });

      return {
        success: true,
        newLevel: equipment.enhanceLevel,
        cost,
        message: `强化成功！+${equipment.enhanceLevel}`,
      };
    } else {
      // 强化失败
      const penalty = this.getFailurePenalty(equipment.enhanceLevel);
      const oldLevel = equipment.enhanceLevel;
      equipment.enhanceLevel = Math.max(0, equipment.enhanceLevel - penalty);

      this.events.emit('equipment:enhanceFailed', {
        equipment,
        oldLevel,
        newLevel: equipment.enhanceLevel,
        penalty,
      });

      return {
        success: false,
        newLevel: equipment.enhanceLevel,
        cost,
        message: penalty > 0
          ? `强化失败！+${oldLevel} → +${equipment.enhanceLevel}（降${penalty}级）`
          : '强化失败！',
      };
    }
  }

  /**
   * 获取强化系数
   *
   * +50以下：1.25^level
   * +50以上：1.25^50 × (1 + (level-50) × 0.05)（衰减公式，防止数值溢出）
   */
  getEnhanceCoefficient(level: number): number {
    const decayLevel = this.config.enhanceCoefficientDecayLevel ?? 50;
    const decayRate = this.config.enhanceCoefficientDecayRate ?? 0.05;

    if (level <= decayLevel) {
      return Math.pow(this.config.enhanceCoefficientBase, level);
    }

    // 衰减公式：1.25^50 × (1 + (level-50) × 0.05)
    const baseCoeff = Math.pow(this.config.enhanceCoefficientBase, decayLevel);
    return baseCoeff * (1 + (level - decayLevel) * decayRate);
  }

  /**
   * 获取强化成功率
   *
   * 公式：max(5%, 100% - level × 0.5%)
   */
  getSuccessRate(level: number): number {
    const { baseRate, decreasePerLevel, minRate } = this.config.successRateFormula;
    return Math.max(minRate, baseRate - level * decreasePerLevel);
  }

  /**
   * 获取强化消耗
   *
   * 公式：强化石 = 境界等级 × (1 + 强化等级 × 0.1)
   *       星币 = 100 × 境界等级² × 1.2^强化等级
   */
  getEnhanceCost(level: number): { stones: number; starCoins: number } {
    const realmLevel = this.state.realm.level;
    const { stonesBase, stonesPerEnhanceLevel, starCoinsBase, starCoinsRealmPower, starCoinsEnhanceMultiplier } = this.config.costFormula;
    return {
      stones: Math.ceil(realmLevel * (stonesBase + level * stonesPerEnhanceLevel)),
      starCoins: Math.floor(starCoinsBase * Math.pow(realmLevel, starCoinsRealmPower) * Math.pow(starCoinsEnhanceMultiplier, level)),
    };
  }

  /**
   * 获取失败惩罚（降级数）
   */
  getFailurePenalty(level: number): number {
    const { safeLevel, penaltyLevels } = this.config.failurePenalty;
    if (level <= safeLevel) return 0;

    for (const penalty of penaltyLevels) {
      if (level >= penalty.minLevel && level <= penalty.maxLevel) {
        return penalty.downgrade;
      }
    }
    return 0;
  }

  /**
   * 获取当前强化上限
   */
  getMaxEnhanceLevel(): number {
    const cycle = this.state.cycle.currentCycle;
    if (cycle === 1) return this.config.maxEnhanceLevel.cycle1 ?? 15;
    if (cycle <= 5) return this.config.maxEnhanceLevel.cycle2to5 ?? 30;
    return 999; // 无尽模式无上限
  }

  /**
   * 获取强化信息（用于UI显示）
   */
  getEnhanceInfo(equipmentId: string): {
    currentLevel: number;
    maxLevel: number;
    coefficient: number;
    successRate: number;
    cost: { stones: number; starCoins: number };
    failurePenalty: number;
    canEnhance: boolean;
  } | null {
    const equipment = this.state.allEquipment[equipmentId];
    if (!equipment) return null;

    const maxLevel = this.getMaxEnhanceLevel();
    const coefficient = this.getEnhanceCoefficient(equipment.enhanceLevel);
    const successRate = this.getSuccessRate(equipment.enhanceLevel);
    const cost = this.getEnhanceCost(equipment.enhanceLevel);
    const failurePenalty = this.getFailurePenalty(equipment.enhanceLevel);

    const stoneItem = this.state.inventory.items['enhancementStone'];
    const hasStones = stoneItem ? stoneItem.quantity >= cost.stones : false;
    const hasCoins = this.state.currency.starCoins >= cost.starCoins;

    return {
      currentLevel: equipment.enhanceLevel,
      maxLevel,
      coefficient,
      successRate,
      cost,
      failurePenalty,
      canEnhance: equipment.enhanceLevel < maxLevel && hasStones && hasCoins,
    };
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {}
}

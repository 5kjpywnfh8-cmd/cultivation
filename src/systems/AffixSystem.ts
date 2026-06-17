/**
 * 星渊仙途 - 词条系统
 *
 * 职责：
 * - 装备每+10强化等级获得额外词条槽
 * - 5个词条槽（槽1-3主词条/槽4副词条/槽5特殊词条）
 * - 词条池抽取、重铸、品质影响
 *
 * 设计参考：04-装备系统.md 词条部分
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState, Equipment, Affix, AffixType, EquipmentQuality } from '../core/GameState';

/** 词条池配置 */
interface AffixPoolEntry {
  type: AffixType;
  minValue: number;
  maxValue: number;
  weight: number;
  group: 'attack' | 'defense' | 'utility';
}

/** 词条池 */
const AFFIX_POOL: AffixPoolEntry[] = [
  { type: 'atkPct',       minValue: 0.01, maxValue: 0.05, weight: 10, group: 'attack' },
  { type: 'critRate',     minValue: 0.005, maxValue: 0.02, weight: 8, group: 'attack' },
  { type: 'critDmg',      minValue: 0.05, maxValue: 0.20, weight: 6, group: 'attack' },
  { type: 'penetration',  minValue: 0.005, maxValue: 0.02, weight: 6, group: 'attack' },
  { type: 'skillDmg',     minValue: 0.03, maxValue: 0.10, weight: 5, group: 'attack' },
  { type: 'defPct',       minValue: 0.01, maxValue: 0.05, weight: 10, group: 'defense' },
  { type: 'hpPct',        minValue: 0.01, maxValue: 0.05, weight: 10, group: 'defense' },
  { type: 'dodge',        minValue: 0.005, maxValue: 0.02, weight: 5, group: 'defense' },
  { type: 'dmgReduction', minValue: 0.02, maxValue: 0.05, weight: 4, group: 'defense' },
  { type: 'starYuanGain', minValue: 0.05, maxValue: 0.15, weight: 7, group: 'utility' },
  { type: 'gatherSpeed',  minValue: 0.05, maxValue: 0.20, weight: 7, group: 'utility' },
  { type: 'prodSpeed',    minValue: 0.05, maxValue: 0.15, weight: 6, group: 'utility' },
  { type: 'dropRate',     minValue: 0.05, maxValue: 0.15, weight: 5, group: 'utility' },
];

/** 特殊词条配置 */
const SPECIAL_AFFIX_POOL: { type: AffixType; positive: number; negative: number }[] = [
  { type: 'berserkerRage', positive: 0.30, negative: -0.10 },  // 攻击+30%，防御-10%
  { type: 'ironWall',      positive: 0.25, negative: -0.15 },  // 防御+25%，攻击-15%
  { type: 'lifeDrain',     positive: 0.10, negative: -0.05 },  // 吸血10%，最大生命-5%
  { type: 'critMaster',    positive: 0.15, negative: -0.10 },  // 暴击率+15%，暴击伤害-10%
  { type: 'gatherMaster',  positive: 0.30, negative: -0.10 },  // 采集+30%，生产-10%
  { type: 'prodMaster',    positive: 0.25, negative: -0.10 },  // 生产+25%，采集-10%
  { type: 'luckyStar',     positive: 0.20, negative: -0.15 },  // 掉率+20%，攻击-15%
  { type: 'endlessPower',  positive: 0.20, negative: -0.10 },  // 全属性+20%，星元获取-10%
];

/** 品质对词条数值的影响 */
const QUALITY_MULTIPLIERS: Record<EquipmentQuality, { min: number; max: number }> = {
  common:    { min: 0.60, max: 0.80 },
  fine:      { min: 0.70, max: 0.90 },
  rare:      { min: 0.80, max: 1.00 },
  epic:      { min: 0.90, max: 1.10 },
  legendary: { min: 1.00, max: 1.20 },
  mythic:    { min: 1.10, max: 1.30 },
  ancient:   { min: 1.20, max: 1.50 },
};

export class AffixSystem implements GameSystem {
  readonly name = 'Affix';

  private state: PlayerState;
  private events: EventBus;

  constructor(state: PlayerState, events: EventBus) {
    this.state = state;
    this.events = events;
  }

  update(_dt: number): void {}

  /**
   * 为装备生成词条
   *
   * @param equipment 装备
   * @param slotCount 词条槽总数
   */
  generateAffixes(equipment: Equipment, slotCount: number): void {
    equipment.affixes = [];
    equipment.totalAffixSlots = slotCount;

    // 主词条（槽1-3）
    const mainSlots = Math.min(3, slotCount);
    for (let i = 0; i < mainSlots; i++) {
      const affix = this.rollAffix(equipment.quality, 'main');
      if (affix) equipment.affixes.push(affix);
    }

    // 副词条（槽4）
    if (slotCount >= 4) {
      const subAffix = this.rollAffix(equipment.quality, 'sub');
      if (subAffix) equipment.affixes.push(subAffix);
    }

    // 特殊词条（槽5）
    if (slotCount >= 5) {
      const specialAffix = this.rollSpecialAffix(equipment.quality);
      if (specialAffix) equipment.affixes.push(specialAffix);
    }
  }

  /**
   * 随机抽取词条
   */
  private rollAffix(quality: EquipmentQuality, slotType: 'main' | 'sub'): Affix | null {
    const qualityMul = QUALITY_MULTIPLIERS[quality] ?? { min: 0.8, max: 1.0 };

    // 根据槽位类型过滤词条池
    let pool = AFFIX_POOL;
    if (slotType === 'sub') {
      // 副词条从所有组中随机
      pool = AFFIX_POOL;
    }

    // 按权重随机选择
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) {
        // 生成数值（受品质影响）
        const valueRange = entry.maxValue - entry.minValue;
        const qualityRange = qualityMul.max - qualityMul.min;
        const value = entry.minValue + valueRange * (qualityMul.min + Math.random() * qualityRange);

        return {
          type: entry.type,
          value: Math.round(value * 1000) / 1000,
          isNegative: false,
        };
      }
    }

    return null;
  }

  /**
   * 随机抽取特殊词条
   */
  private rollSpecialAffix(quality: EquipmentQuality): Affix | null {
    const qualityMul = QUALITY_MULTIPLIERS[quality] ?? { min: 0.8, max: 1.0 };
    const entry = SPECIAL_AFFIX_POOL[Math.floor(Math.random() * SPECIAL_AFFIX_POOL.length)];
    if (!entry) return null;

    const value = entry.positive * (qualityMul.min + Math.random() * (qualityMul.max - qualityMul.min));

    return {
      type: entry.type,
      value: Math.round(value * 1000) / 1000,
      isNegative: false,
    };
  }

  /**
   * 重铸词条
   */
  rerollAffix(equipment: Equipment, slotIndex: number, lockedSlots: number[]): boolean {
    if (slotIndex < 0 || slotIndex >= equipment.affixes.length) return false;
    if (lockedSlots.includes(slotIndex)) return false;

    // 消耗重铸石
    const cost = lockedSlots.length > 0 ? 2 : 1;
    const stoneItem = this.state.inventory.items['refiningStone'];
    if (!stoneItem || stoneItem.quantity < cost) return false;

    stoneItem.quantity -= cost;
    if (stoneItem.quantity <= 0) {
      delete this.state.inventory.items['refiningStone'];
    }

    // 重新生成该槽位的词条
    const isSpecial = slotIndex >= 4;
    const newAffix = isSpecial
      ? this.rollSpecialAffix(equipment.quality)
      : this.rollAffix(equipment.quality, slotIndex < 3 ? 'main' : 'sub');

    if (newAffix) {
      equipment.affixes[slotIndex] = newAffix;
    }

    this.events.emit('equipment:affixRerolled', { equipment });
    return true;
  }

  /**
   * 计算词条总加成
   */
  calculateAffixBonus(equipment: Equipment): {
    atkPct: number;
    defPct: number;
    hpPct: number;
    critRate: number;
    critDmg: number;
    penetration: number;
    dodge: number;
    dmgReduction: number;
    starYuanGain: number;
    gatherSpeed: number;
    prodSpeed: number;
    dropRate: number;
  } {
    const bonus = {
      atkPct: 0, defPct: 0, hpPct: 0,
      critRate: 0, critDmg: 0, penetration: 0,
      dodge: 0, dmgReduction: 0,
      starYuanGain: 0, gatherSpeed: 0, prodSpeed: 0, dropRate: 0,
    };

    for (const affix of equipment.affixes) {
      const sign = affix.isNegative ? -1 : 1;
      switch (affix.type) {
        case 'atkPct': bonus.atkPct += affix.value * sign; break;
        case 'defPct': bonus.defPct += affix.value * sign; break;
        case 'hpPct': bonus.hpPct += affix.value * sign; break;
        case 'critRate': bonus.critRate += affix.value * sign; break;
        case 'critDmg': bonus.critDmg += affix.value * sign; break;
        case 'penetration': bonus.penetration += affix.value * sign; break;
        case 'dodge': bonus.dodge += affix.value * sign; break;
        case 'dmgReduction': bonus.dmgReduction += affix.value * sign; break;
        case 'starYuanGain': bonus.starYuanGain += affix.value * sign; break;
        case 'gatherSpeed': bonus.gatherSpeed += affix.value * sign; break;
        case 'prodSpeed': bonus.prodSpeed += affix.value * sign; break;
        case 'dropRate': bonus.dropRate += affix.value * sign; break;
        // 特殊词条处理
        case 'berserkerRage': bonus.atkPct += affix.value * sign; bonus.defPct -= 0.10; break;
        case 'ironWall': bonus.defPct += affix.value * sign; bonus.atkPct -= 0.15; break;
        case 'lifeDrain': bonus.hpPct -= 0.05; break;
        case 'critMaster': bonus.critRate += affix.value * sign; bonus.critDmg -= 0.10; break;
        case 'gatherMaster': bonus.gatherSpeed += affix.value * sign; bonus.prodSpeed -= 0.10; break;
        case 'prodMaster': bonus.prodSpeed += affix.value * sign; bonus.gatherSpeed -= 0.10; break;
        case 'luckyStar': bonus.dropRate += affix.value * sign; bonus.atkPct -= 0.15; break;
        case 'endlessPower': bonus.atkPct += affix.value * sign; bonus.defPct += affix.value * sign; bonus.hpPct += affix.value * sign; break;
      }
    }

    return bonus;
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {}
}

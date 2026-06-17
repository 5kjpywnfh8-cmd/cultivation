/**
 * 星渊仙途 - 装备系统
 *
 * 职责：
 * - 装备打造（消耗材料 + 星币 → 按品质概率产出装备）
 * - 装备穿戴/卸下
 * - 装备分解（返还30%材料）
 * - 装备出售（按品质返回星币）
 * - 装备属性计算
 *
 * 设计参考：04-装备系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type {
  PlayerState, Equipment, EquipmentSlot, EquipmentQuality,
} from '../core/GameState';
import { addToInventory } from '../utils/inventory';
import { getItemName } from '../utils/names';
import type { AffixSystem } from './AffixSystem';

/** 品质系数表 */
const QUALITY_COEFFICIENTS: Record<EquipmentQuality, number> = {
  common: 1.0,
  fine: 1.3,
  rare: 1.7,
  epic: 2.2,
  legendary: 3.0,
  mythic: 4.0,
  ancient: 5.0,
};

/** 打造概率表 */
const CRAFT_PROBABILITIES: { quality: EquipmentQuality; chance: number }[] = [
  { quality: 'common', chance: 0.40 },
  { quality: 'fine', chance: 0.30 },
  { quality: 'rare', chance: 0.18 },
  { quality: 'epic', chance: 0.09 },
  { quality: 'legendary', chance: 0.025 },
  { quality: 'mythic', chance: 0.005 },
];

/** 部位系数表 */
const PART_COEFFICIENTS: Record<EquipmentSlot, { attack: number; defense: number; hp: number }> = {
  weapon:   { attack: 1.0, defense: 0,   hp: 0 },
  helmet:   { attack: 0,   defense: 0.6, hp: 0.5 },
  armor:    { attack: 0,   defense: 0.8, hp: 0.8 },
  gauntlet: { attack: 0.4, defense: 0.3, hp: 0.2 },
  boot:     { attack: 0.2, defense: 0.4, hp: 0.4 },
  talisman: { attack: 0.6, defense: 0.2, hp: 0.5 },
};

/** 出售价格表 */
const SELL_PRICES: Record<EquipmentQuality, number> = {
  common: 100,
  fine: 500,
  rare: 2000,
  epic: 8000,
  legendary: 30000,
  mythic: 100000,
  ancient: 500000,
};

/** 装备模板配置 */
interface EquipmentTemplateConfig {
  id: string;
  name: string;
  slot: EquipmentSlot;
  realm: string;
  requiredMaterials: Record<string, number>;
  requiredStarCoins: number;
}

export class EquipmentSystem implements GameSystem {
  readonly name = 'Equipment';

  private state: PlayerState;
  private events: EventBus;
  private templates: Record<string, EquipmentTemplateConfig>;
  private uuidCounter = 0;
  private affixSystem: AffixSystem | null = null;

  constructor(
    state: PlayerState,
    events: EventBus,
    templates: Record<string, EquipmentTemplateConfig>,
    affixSystem?: AffixSystem,
  ) {
    this.state = state;
    this.events = events;
    this.templates = templates;
    this.affixSystem = affixSystem ?? null;
  }

  update(_dt: number): void {}

  /**
   * 打造装备
   *
   * @param templateId 装备模板ID
   * @returns 打造的装备，失败返回 null
   */
  craft(templateId: string): Equipment | null {
    const template = this.templates[templateId];
    if (!template) return null;

    // 检查材料
    for (const [matId, amount] of Object.entries(template.requiredMaterials)) {
      const item = this.state.inventory.items[matId];
      if (!item || item.quantity < amount) return null;
    }

    // 检查星币
    if (this.state.currency.starCoins < template.requiredStarCoins) return null;

    // 扣除材料
    for (const [matId, amount] of Object.entries(template.requiredMaterials)) {
      const item = this.state.inventory.items[matId];
      if (!item) return null;
      item.quantity -= amount;
      if (item.quantity <= 0) {
        delete this.state.inventory.items[matId];
      }
    }

    // 扣除星币
    this.state.currency.starCoins -= template.requiredStarCoins;

    // 随机品质
    const quality = this.rollQuality();

    // 生成装备
    const equipment: Equipment = {
      id: this.generateId(),
      templateId,
      name: template.name,
      slot: template.slot,
      quality,
      qualityLevel: 0,
      enhanceLevel: 0,
      affixes: [],
      totalAffixSlots: 3,
      sourcePlanet: undefined,
      locked: false,
      acquiredAt: Date.now(),
    };

    // 生成初始词条（3个主词条）
    if (this.affixSystem) {
      this.affixSystem.generateAffixes(equipment, 3);
    }

    // 存入装备库
    this.state.allEquipment[equipment.id] = equipment;

    // 更新统计
    this.state.stats_log.totalCraftCount += 1;
    this.state.stats_log.qualityEquipments[quality] =
      (this.state.stats_log.qualityEquipments[quality] ?? 0) + 1;

    // 触发事件
    this.events.emit('equipment:crafted', { equipment: { ...equipment } });

    return equipment;
  }

  /**
   * 穿戴装备
   */
  equip(equipmentId: string): boolean {
    const equipment = this.state.allEquipment[equipmentId];
    if (!equipment) return false;

    const slot = equipment.slot;
    const currentEquipped = this.state.equippedGear[slot];

    // 如果该槽位已有装备，先卸下
    if (currentEquipped) {
      this.unequip(slot);
    }

    // 穿戴
    this.state.equippedGear[slot] = equipmentId;

    // 重算属性
    this.recalculatePlayerStats();

    this.events.emit('equipment:equipped', { slot, equipmentId });
    return true;
  }

  /**
   * 卸下装备
   */
  unequip(slot: EquipmentSlot): boolean {
    const equipmentId = this.state.equippedGear[slot];
    if (!equipmentId) return false;

    this.state.equippedGear[slot] = null;

    // 重算属性
    this.recalculatePlayerStats();

    this.events.emit('equipment:unequipped', { slot });
    return true;
  }

  /**
   * 分解装备
   *
   * 返还30%打造材料，强化过的装备额外返还50%强化石。
   */
  dismantle(equipmentId: string): boolean {
    const equipment = this.state.allEquipment[equipmentId];
    if (!equipment || equipment.locked) return false;

    const template = this.templates[equipment.templateId];

    // 返还材料（30%）
    if (template) {
      for (const [matId, amount] of Object.entries(template.requiredMaterials)) {
        const returnAmount = Math.floor(amount * 0.3);
        if (returnAmount > 0) {
          this.addToInventory(matId, matId, returnAmount);
        }
      }
    }

    // 如果有强化等级，返还强化石
    if (equipment.enhanceLevel > 0) {
      const stoneReturn = Math.floor(equipment.enhanceLevel * 0.5);
      if (stoneReturn > 0) {
        this.addToInventory('enhancementStone', getItemName('enhancementStone'), stoneReturn);
      }
    }

    // 从装备库移除
    delete this.state.allEquipment[equipmentId];

    // 从装备槽移除（如果已穿戴）
    for (const [slot, eqId] of Object.entries(this.state.equippedGear)) {
      if (eqId === equipmentId) {
        this.state.equippedGear[slot as EquipmentSlot] = null;
      }
    }

    // 重算属性
    this.recalculatePlayerStats();

    this.events.emit('equipment:dismantled', { equipmentId });
    return true;
  }

  /**
   * 出售装备
   */
  sell(equipmentId: string): boolean {
    const equipment = this.state.allEquipment[equipmentId];
    if (!equipment || equipment.locked) return false;

    const price = SELL_PRICES[equipment.quality] ?? 100;
    this.state.currency.starCoins += price;

    // 从装备库移除
    delete this.state.allEquipment[equipmentId];

    // 从装备槽移除
    for (const [slot, eqId] of Object.entries(this.state.equippedGear)) {
      if (eqId === equipmentId) {
        this.state.equippedGear[slot as EquipmentSlot] = null;
      }
    }

    this.recalculatePlayerStats();
    this.events.emit('equipment:sold', { equipmentId, price });
    return true;
  }

  /**
   * 计算装备属性
   *
   * 公式：装备基础属性 = 品质系数 × 部位系数 × 境界基数
   * 境界基数取当前境界的1阶属性（练气=15/8/50，筑基=120/60/400，等）
   */
  calculateEquipStats(quality: EquipmentQuality, slot: EquipmentSlot): {
    attack: number;
    defense: number;
    hp: number;
  } {
    const qualityCoeff = QUALITY_COEFFICIENTS[quality];
    const partCoeff = PART_COEFFICIENTS[slot];

    // 境界基数（按当前境界取值）
    const realmBases: Record<string, { attack: number; defense: number; hp: number }> = {
      '练气': { attack: 15, defense: 8, hp: 50 },
      '筑基': { attack: 120, defense: 60, hp: 400 },
      '金丹': { attack: 800, defense: 400, hp: 3000 },
      '元婴': { attack: 5000, defense: 2500, hp: 20000 },
      '化神': { attack: 35000, defense: 18000, hp: 150000 },
      '渡劫': { attack: 250000, defense: 120000, hp: 1000000 },
      '无限': { attack: 2000000, defense: 1000000, hp: 8000000 },
    };

    const realmBase = realmBases[this.state.realm.realm] ?? realmBases['练气']!;

    return {
      attack: Math.floor(qualityCoeff * partCoeff.attack * realmBase.attack),
      defense: Math.floor(qualityCoeff * partCoeff.defense * realmBase.defense),
      hp: Math.floor(qualityCoeff * partCoeff.hp * realmBase.hp),
    };
  }

  /**
   * 重算玩家属性（境界基础 + 装备加成）
   *
   * 从 baseStats 读取境界基础值，叠加装备加成后写入 stats
   */
  recalculatePlayerStats(): void {
    // 从 baseStats 读取境界基础值（不含装备）
    const baseAttack = this.state.baseStats.attack;
    const baseDefense = this.state.baseStats.defense;
    const baseHp = this.state.baseStats.hp;

    // 装备加成
    let equipAttack = 0;
    let equipDefense = 0;
    let equipHp = 0;

    for (const equipmentId of Object.values(this.state.equippedGear)) {
      if (!equipmentId) continue;
      const equip = this.state.allEquipment[equipmentId];
      if (!equip) continue;

      const stats = this.calculateEquipStats(equip.quality, equip.slot);

      // 强化系数
      const enhanceCoeff = Math.pow(1.25, equip.enhanceLevel);

      equipAttack += Math.floor(stats.attack * enhanceCoeff);
      equipDefense += Math.floor(stats.defense * enhanceCoeff);
      equipHp += Math.floor(stats.hp * enhanceCoeff);

      // 词条加成（百分比词条基于基础值计算）
      for (const affix of equip.affixes) {
        if (affix.type === 'atkPct') equipAttack += Math.floor(baseAttack * affix.value);
        if (affix.type === 'defPct') equipDefense += Math.floor(baseDefense * affix.value);
        if (affix.type === 'hpPct') equipHp += Math.floor(baseHp * affix.value);
      }
    }

    // 最终属性 = 境界基础 + 装备加成
    this.state.stats.attack = baseAttack + equipAttack;
    this.state.stats.defense = baseDefense + equipDefense;
    this.state.stats.hp = baseHp + equipHp;
    this.state.stats.currentHp = this.state.stats.hp;
  }

  /**
   * 随机品质
   */
  private rollQuality(): EquipmentQuality {
    const roll = Math.random();
    let cumulative = 0;
    for (const entry of CRAFT_PROBABILITIES) {
      cumulative += entry.chance;
      if (roll < cumulative) return entry.quality;
    }
    return 'common';
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `equip_${Date.now()}_${++this.uuidCounter}`;
  }

  /**
   * 添加物品到背包
   */
  private addToInventory(itemId: string, name: string, amount: number): void {
    addToInventory(this.state, itemId, name, amount, 'material');
  }

  /**
   * 获取装备属性详情（用于UI显示）
   */
  getEquipmentStats(equipmentId: string): {
    attack: number;
    defense: number;
    hp: number;
    enhanceCoeff: number;
  } | null {
    const equip = this.state.allEquipment[equipmentId];
    if (!equip) return null;

    const stats = this.calculateEquipStats(equip.quality, equip.slot);
    const enhanceCoeff = Math.pow(1.25, equip.enhanceLevel);

    return {
      attack: Math.floor(stats.attack * enhanceCoeff),
      defense: Math.floor(stats.defense * enhanceCoeff),
      hp: Math.floor(stats.hp * enhanceCoeff),
      enhanceCoeff,
    };
  }

  beforeSave(): void {}
  afterLoad(): void {
    this.recalculatePlayerStats();
  }
  reset(): void {}
}

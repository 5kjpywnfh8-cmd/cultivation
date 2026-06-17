/**
 * 配置表类型定义
 *
 * 消除 App.vue 中的 any 类型断言
 */

/** 星球资源配置 */
export interface PlanetResourceConfig {
  id: string;
  name: string;
  description: string;
  unlockCondition: { level: number } | null;
  gatherMultiplier: number;
  resources: Record<string, {
    id?: string;
    name: string;
    baseRate: number;
    autoRate: number;
    maxReserve: number;
    regenRate: number;
    type: 'basic' | 'rare';
  }>;
}

/** 星球配置表 */
export interface PlanetConfigData {
  _comment: string;
  version: number;
  planets: Record<string, PlanetResourceConfig>;
}

/** 怪物模板 */
export interface MonsterTemplateConfig {
  id: string;
  name: string;
  planet: string;
  type: 'normal' | 'boss';
  stats: { attack: number; defense: number; hp: number };
  skills: {
    id: string;
    name: string;
    damageMultiplier?: number;
    defenseMultiplier?: number;
    attackMultiplier?: number;
    duration?: number;
    cooldown: number;
    effectType?: string;
    effectDuration?: number;
    triggerHpPercent?: number;
    priority?: number;
  }[];
  drops: Record<string, { min: number; max: number; chance?: number }>;
  refreshInterval?: number;
  unlockCondition?: { level: number };
}

/** 怪物配置表 */
export interface MonsterTemplatesData {
  _comment: string;
  version: number;
  monsters: Record<string, MonsterTemplateConfig>;
  bosses: Record<string, MonsterTemplateConfig>;
}

/** 强化配置 */
export interface EnhanceConfigData {
  _comment: string;
  version: number;
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

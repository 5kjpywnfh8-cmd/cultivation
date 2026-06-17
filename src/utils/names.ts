/**
 * 星渊仙途 - 物品名称映射表
 *
 * 将物品ID转换为中文名称
 */

const ITEM_NAMES: Record<string, string> = {
  // 基础资源
  iron_ore: '铁矿',
  copper_ore: '铜矿',
  star_dust: '星尘',
  stone: '石头',
  wood: '木材',
  herb: '灵草',
  wood_crystal: '木晶',
  spirit_liquid: '灵液',
  spore: '孢子',
  refined_iron: '精铁',
  dark_moss: '暗苔',
  soul_stone: '魂石',
  ghost_fire: '幽冥火',
  sky_crystal: '天晶',
  thunder_marrow: '雷髓',
  arc_stone: '电弧石',
  fire_crystal: '火晶石',
  lava_essence: '熔岩精华',
  earth_fire: '地心火',
  ice_stone: '玄冰石',
  ice_soul: '冰魄',
  frost_essence: '寒霜精华',
  chaos_stone: '混沌石',
  void_vine: '虚空藤',
  dao_fragment: '道韵碎片',
  wind_stone: '风灵石',
  cloud_crystal: '云晶',
  sky_water: '天空之水',
  abyss_stone: '深渊石',
  chaos_origin: '混沌本源',
  void_essence: '虚空精华',
  life_dew: '生命露水',

  // 加工材料
  copper_ingot: '铜锭',
  spirit_liquid_refined: '精炼灵液',
  wood_essence: '木晶精华',
  healing_pill: '回血丹',
  gathering_pill: '聚灵散',
  xuantie_essence: '玄铁精华',
  behemoth_core: '矿脉巨兽核心',

  // 消耗品
  enhancementStone: '强化石',
  refinementStone: '重铸石',

  // 蓝图
  blueprint_auto_origin: '起源星自动采集蓝图',
  blueprint_auto_xuantie: '玄铁星自动采集蓝图',
  blueprint_batch: '批量生产蓝图',

  // 种子
  spirit_grass_seed: '灵草种子',
  centennial_grass_seed: '百年灵草种子',
  millennial_grass_seed: '千年灵草种子',

  // 装备
  xuantie_sword: '玄铁剑',
  xuantie_helmet: '玄铁盔',
  xuantie_armor: '玄铁铠',
  xuantie_gauntlet: '玄铁护腕',
  xuantie_boot: '玄铁靴',
  xuantie_talisman: '玄铁法宝',

  // 功法
  basic_sword_art: '基础剑诀',
  gathering_art: '聚灵术',
  iron_wall_art: '铁壁功',
  sword_dance: '御剑术',
  diamond_body: '金刚护体',
  iron_shield: '天罡护体',
  thunder_strike: '雷霆万钧',
  mixed_yuan: '混元功',

  // 货币
  starCoins: '星币',
  spiritStones: '灵石',
  daoYun: '道韵',
};

/**
 * 获取物品中文名称
 */
export function getItemName(itemId: string): string {
  return ITEM_NAMES[itemId] ?? itemId;
}

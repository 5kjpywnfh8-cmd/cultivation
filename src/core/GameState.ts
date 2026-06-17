/**
 * 星渊仙途 - 核心状态管理
 *
 * 定义 PlayerState 顶层结构和默认值工厂函数。
 * 数据结构参考：设计方案/补充-存档数据结构.md
 */

// ==================== 境界 ====================

/** 境界名 */
export type RealmName = '练气' | '筑基' | '金丹' | '元婴' | '化神' | '渡劫' | '无限';

/** 境界进度 */
export interface RealmProgress {
  realm: RealmName;
  tier: number;
  level: number;
  starYuan: number;
  starYuanToNext: number;
}

// ==================== 装备 ====================

export type EquipmentSlot = 'weapon' | 'helmet' | 'armor' | 'gauntlet' | 'boot' | 'talisman';

export type EquipmentQuality =
  | 'common'
  | 'fine'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'ancient';

export type AffixType =
  | 'atkPct' | 'defPct' | 'hpPct'
  | 'critRate' | 'critDmg' | 'penetration' | 'dodge'
  | 'starYuanGain' | 'gatherSpeed' | 'prodSpeed'
  | 'dropRate' | 'cdReduction' | 'skillDmg'
  | 'lifeSteal' | 'dmgReduction' | 'allStats'
  | 'berserkerRage' | 'ironWall' | 'lifeDrain'
  | 'critMaster' | 'gatherMaster' | 'prodMaster'
  | 'luckyStar' | 'endlessPower';

export interface Affix {
  type: AffixType;
  value: number;
  isNegative: boolean;
}

export interface Equipment {
  id: string;
  templateId: string;
  name: string;
  slot: EquipmentSlot;
  quality: EquipmentQuality;
  qualityLevel: number;
  enhanceLevel: number;
  affixes: Affix[];
  totalAffixSlots: number;
  sourcePlanet?: string;
  locked: boolean;
  acquiredAt: number;
}

// ==================== 功法 ====================

export type SkillType = 'active' | 'passive';
export type SkillStatus = 'locked' | 'available' | 'learned';

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  status: SkillStatus;
  evolutionLevel: number;
  fragmentCount: number;
  fragmentRequired: number;
  cooldownEndsAt: number;
}

// ==================== 生产系统 ====================

export type DeviceType =
  | 'smelter' | 'distiller' | 'extractor'
  | 'alchemyFurnace' | 'refiner' | 'forge' | 'spaceFolder';

export interface ProductionItem {
  recipeId: string;
  outputName: string;
  quantity: number;
  startedAt: number;
  finishAt: number;
}

export interface Device {
  type: DeviceType;
  unlocked: boolean;
  level: number;
  maxLevel: number;
  queue: ProductionItem[];
  queueCapacity: number;
}

// ==================== 星球系统 ====================

/** 天气类型 */
export type WeatherType = 'normal' | 'rain' | 'thunderstorm' | 'spatialRift' | 'eruption' | 'blizzard' | 'cloudSea' | 'voidRift';

export type PlanetId =
  | 'origin' | 'xuantie' | 'lingzhi' | 'youming'
  | 'tianjing' | 'huoshan' | 'bingfeng' | 'hundun'
  | 'fukong' | 'shenyuan';

export interface FarmPlot {
  plotId: number;
  seedId: string | null;
  plantedAt: number;
  harvestAt: number;
  level: number;
  autoReplant: boolean;
}

export interface InvasionState {
  active: boolean;
  wave: number;
  totalWaves: number;
  pendingMonsters: { templateId: string; spawnDelay: number }[];
  activeMonsters: unknown[];
  killedCount: number;
  totalCount: number;
  startedAt: number;
  waveInterval: number;
  nextWaveAt: number;
  defenseSuccessCount: number;
}

export interface Planet {
  id: PlanetId;
  name: string;
  unlocked: boolean;
  autoCollect: boolean;
  maxFarmPlots: number;
  farmPlots: FarmPlot[];
  exploredAreas: string[];
  bossLastKilledAt: number;
  hiddenBossUnlocked: boolean;
  hiddenBossProgress: Record<string, number>;
  currentWeather: WeatherType;
  weatherRemaining: number;
  resourceReserves: Record<string, {
    current: number;
    max: number;
    regenRate: number;
  }>;
  mapTiles: unknown[];
  defenseBuildings: unknown[];
  invasion: InvasionState;
}

// ==================== 货币 ====================

export interface Currency {
  starCoins: number;
  spiritStones: number;
  daoYun: number;
}

// ==================== 背包 ====================

export interface InventoryItem {
  id: string;
  name: string;
  type:
    | 'resource' | 'material' | 'consumable' | 'pill'
    | 'protectionCharm' | 'enhancementStone' | 'evolutionStone'
    | 'refiningStone' | 'breakthroughStone' | 'blueprint'
    | 'seed' | 'fragment';
  quantity: number;
  maxStack: number;
}

export interface Inventory {
  items: Record<string, InventoryItem>;
  capacity: number;
}

// ==================== 任务系统 ====================

export type QuestStatus = 'locked' | 'active' | 'completed' | 'skipped';

export interface QuestProgress {
  questId: string;
  status: QuestStatus;
  currentProgress: number;
  targetProgress: number;
  completedAt: number;
}

export interface QuestState {
  currentChapter: number;
  activeQuestId: string | null;
  quests: Record<string, QuestProgress>;
}

// ==================== 成就系统 ====================

export type AchievementTier = 'none' | 'bronze' | 'silver' | 'gold';

export interface Achievement {
  id: string;
  name: string;
  tier: AchievementTier;
  currentProgress: number;
  tierThresholds: [number, number, number];
  rewardClaimed: [boolean, boolean, boolean];
}

// ==================== 战斗状态 ====================

export type DungeonId =
  | 'stardustMine' | 'herbGarden' | 'netherTrial'
  | 'thunderRealm' | 'chaosVision' | 'abyssRift'
  | 'tribulation' | 'ancientTrial';

export interface DungeonRecord {
  id: DungeonId;
  dailyUsed: number;
  dailyMax: number;
  lastResetAt: number;
  weeklyUsed: number;
  weeklyMax: number;
  weeklyResetAt: number;
  highestFloor: number;
  tribulationStage: number;
  ancientTrialStage: number;
}

export interface CombatState {
  currentPlanet: PlanetId;
  bossTimers: Record<string, number>;
  dungeons: DungeonRecord[];
  totalKills: number;
  totalCrits: number;
  totalDodges: number;
  bossKillCounts: Record<string, number>;
}

// ==================== 离线系统 ====================

export interface OfflineConfig {
  autoCollectPlanets: PlanetId[];
  autoProduce: boolean;
  autoHarvest: boolean;
  offlineMultiplier: number;
  maxOfflineSeconds: number;
}

export interface OfflineRewards {
  offlineSeconds: number;
  resources: Record<string, number>;
  starCoins: number;
  starYuan: number;
  farmHarvests: Record<string, number>;
  claimed: boolean;
}

// ==================== 周目系统 ====================

export interface CycleInheritance {
  equipmentIds: string[];
  skillIds: string[];
  deviceLevels: Record<string, number>;
  starCoins: number;
  spiritStones: number;
  daoYun: number;
}

export interface CycleState {
  currentCycle: number;
  monsterMultiplier: number;
  monsterHpMultiplier: number;
  bossAttackMultiplier: number;
  bossDefenseMultiplier: number;
  bossHpMultiplier: number;
  dropMultiplier: number;
  starYuanMultiplier: number;
  endlessUnlocked: boolean;
  inheritance: CycleInheritance | null;
}

// ==================== 无尽模式 ====================

export interface EndlessTalent {
  id: string;
  level: number;
  maxLevel: number;
}

export interface EndlessState {
  currentFloor: number;
  highestFloor: number;
  score: number;
  totalTalentPoints: number;
  spentTalentPoints: number;
  talents: Record<string, EndlessTalent>;
  unlockedSkills: string[];
  inProgress: boolean;
  currentFloorProgress: number;
  checkpoint: number;
}

// ==================== 科技树 ====================

export interface TechTreeState {
  researchPoints: number;
  researchStationLevel: number;
  nodes: Record<string, {
    researched: boolean;
    progress: number;
  }>;
}

// ==================== 商店 ====================

export interface ShopPurchaseRecord {
  itemId: string;
  purchasedCount: number;
  limitCount: number;
}

export interface ShopState {
  dailyPurchases: ShopPurchaseRecord[];
  dailyRefreshedAt: number;
  weeklyPurchases: ShopPurchaseRecord[];
  weeklyRefreshedAt: number;
}

// ==================== 星舟 ====================

export interface StarShip {
  capacityLevel: number;
  capacity: number;
  autoRouteUnlocked: boolean;
  portalUnlocked: boolean;
  portalFuel: number;
  autoRoute: {
    enabled: boolean;
    sourcePlanet: string;
    targetPlanet: string;
    transportItems: string[];
  } | null;
}

// ==================== 图鉴 ====================

export interface CodexState {
  collectedEquipments: string[];
  collectedMaterials: string[];
  completedSets: string[];
  setProgress: Record<string, number>;
  defeatedBosses: string[];
  exploredAreas: string[];
}

// ==================== 天气 ====================

export interface WeatherState {
  currentWeathers: Record<PlanetId, WeatherType>;
  weatherRemaining: Record<PlanetId, number>;
  nextWeatherEventAt: number;
  specialWeatherGatherCount: number;
}

// ==================== 玩家属性 ====================

export interface PlayerStats {
  attack: number;
  defense: number;
  hp: number;
  critRate: number;
  critDamage: number;
  penetration: number;
  dodgeRate: number;
  hpRegen: number;
  currentHp: number;
}

/** 境界基础属性（不含装备加成，用于属性计算基准） */
export interface BaseStats {
  attack: number;
  defense: number;
  hp: number;
}

// ==================== 统计 ====================

export interface GameStats {
  totalOnlineSeconds: number;
  totalOfflineSeconds: number;
  totalStarCoinsEarned: number;
  totalSpiritStonesEarned: number;
  totalDaoYunEarned: number;
  totalGatherCount: number;
  totalProduceCount: number;
  totalCraftCount: number;
  totalAlchemyCount: number;
  totalEnhanceCount: number;
  highestEnhanceLevel: number;
  totalAffixCount: number;
  specialWeatherGatherCount: number;
  totalDungeonClears: number;
  learnedSkillCount: number;
  highestDamage: number;
  consecutiveLoginDays: number;
  skillKillCount: number;
  killByType: Record<string, number>;
  noHitBossKills: number;
  speedKillBoss: number;
  fastestDungeonClear: number;
  uniqueEquipmentsCollected: number;
  qualityEquipments: Record<string, number>;
  setsCompleted: number;
  uniqueMaterialsCollected: number;
  totalAreasExplored: number;
  areasExploredPerPlanet: Record<string, number>;
}

// ==================== 设置 ====================

export interface PlayerSettings {
  autoCombat: boolean;
  showDamageNumbers: boolean;
  sfxVolume: number;
  bgmVolume: number;
  offlineNotify: boolean;
  combatSpeed: 1 | 2 | 3;
  autoBossChallenge: boolean;
  hpPotionThreshold: number;
  autoUseBuffs: boolean;
}

// ==================== PlayerState 顶层结构 ====================

export interface PlayerState {
  // 元数据
  version: number;
  createdAt: number;
  lastSavedAt: number;
  lastOnlineAt: number;
  playerName?: string;
  /** 新手引导是否已完成/跳过 */
  tutorialCompleted: boolean;

  // 核心数据
  realm: RealmProgress;
  stats: PlayerStats;
  /** 境界基础属性（不含装备加成，用于属性计算基准） */
  baseStats: BaseStats;
  currency: Currency;
  inventory: Inventory;
  equippedGear: Record<EquipmentSlot, string | null>;
  allEquipment: Record<string, Equipment>;
  skills: Record<string, Skill>;
  unlockedActiveSlots: number;
  unlockedPassiveSlots: number;
  activeSkillSlots: (string | null)[];
  passiveSkillSlots: (string | null)[];

  // 生产系统
  devices: Record<DeviceType, Device>;

  // 星球系统
  planets: Record<PlanetId, Planet>;
  starShip: StarShip;

  // 任务与成就
  quests: QuestState;
  achievements: Record<string, Achievement>;
  unlockedTitles: string[];
  equippedTitle: string | null;
  codex: CodexState;

  // 天气
  weather: WeatherState;

  // 战斗
  combat: CombatState;
  autoChallengeBoss: {
    enabled: boolean;
    targetBossIds: string[];
    retryOnFail: boolean;
    retreatHpThreshold: number;
  };

  // 商店
  shop: ShopState;
  bossChallengeTickets: number;

  // 离线
  offlineConfig: OfflineConfig;
  pendingOfflineRewards: OfflineRewards | null;

  // 周目
  cycle: CycleState;
  endless: EndlessState;

  // 科技树
  techTree: TechTreeState;

  // 其他
  stats_log: GameStats;
  settings: PlayerSettings;
}

// ==================== 默认值工厂 ====================

const SAVE_VERSION = 1;

function createDefaultInvasion(): InvasionState {
  return {
    active: false, wave: 0, totalWaves: 0,
    pendingMonsters: [], activeMonsters: [],
    killedCount: 0, totalCount: 0, startedAt: 0,
    waveInterval: 0, nextWaveAt: 0, defenseSuccessCount: 0,
  };
}

function createDefaultPlanet(id: PlanetId, name: string, unlocked: boolean, resources: Record<string, { current: number; max: number; regenRate: number }> = {}): Planet {
  return {
    id, name, unlocked,
    autoCollect: false,
    maxFarmPlots: 0, farmPlots: [], exploredAreas: [],
    bossLastKilledAt: 0, hiddenBossUnlocked: false,
    hiddenBossProgress: {},
    currentWeather: 'normal', weatherRemaining: 0,
    resourceReserves: resources,
    mapTiles: [], defenseBuildings: [],
    invasion: createDefaultInvasion(),
  };
}

export function createNewPlayerState(): PlayerState {
  const now = Date.now();

  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSavedAt: now,
    lastOnlineAt: now,
    tutorialCompleted: false,

    realm: { realm: '练气', tier: 1, level: 1, starYuan: 0, starYuanToNext: 100 },
    stats: {
      attack: 15, defense: 8, hp: 50,
      critRate: 0, critDamage: 0, penetration: 0,
      dodgeRate: 0, hpRegen: 1, currentHp: 50,
    },
    baseStats: { attack: 15, defense: 8, hp: 50 },
    currency: { starCoins: 0, spiritStones: 0, daoYun: 0 },
    inventory: { items: {}, capacity: 0 },
    equippedGear: {
      weapon: null, helmet: null, armor: null,
      gauntlet: null, boot: null, talisman: null,
    },
    allEquipment: {},
    skills: {},
    unlockedActiveSlots: 1,
    unlockedPassiveSlots: 0,
    activeSkillSlots: [null, null, null, null, null],
    passiveSkillSlots: [null, null, null],

    devices: {
      smelter:        { type: 'smelter',        unlocked: true,  level: 0, maxLevel: 5, queue: [], queueCapacity: 3 },
      distiller:      { type: 'distiller',      unlocked: false, level: 0, maxLevel: 5, queue: [], queueCapacity: 3 },
      extractor:      { type: 'extractor',      unlocked: false, level: 0, maxLevel: 5, queue: [], queueCapacity: 3 },
      alchemyFurnace: { type: 'alchemyFurnace', unlocked: false, level: 0, maxLevel: 5, queue: [], queueCapacity: 3 },
      refiner:        { type: 'refiner',        unlocked: false, level: 0, maxLevel: 5, queue: [], queueCapacity: 3 },
      forge:          { type: 'forge',          unlocked: true,  level: 0, maxLevel: 5, queue: [], queueCapacity: 3 },
      spaceFolder:    { type: 'spaceFolder',    unlocked: false, level: 0, maxLevel: 5, queue: [], queueCapacity: 3 },
    },

    planets: {
      origin: createDefaultPlanet('origin', '起源星', true, {
        iron_ore:      { current: 50000, max: 50000, regenRate: 500 },
        copper_ore:    { current: 50000, max: 50000, regenRate: 500 },
        star_dust:     { current: 50000, max: 50000, regenRate: 500 },
        wood_crystal:  { current: 50000, max: 50000, regenRate: 500 },
        spirit_liquid: { current: 50000, max: 50000, regenRate: 500 },
      }),
      xuantie: createDefaultPlanet('xuantie', '玄铁星', true, {
        refined_iron: { current: 100000, max: 100000, regenRate: 1000 },
        iron_ore:     { current: 100000, max: 100000, regenRate: 1000 },
        copper_ore:   { current: 100000, max: 100000, regenRate: 1000 },
        star_dust:    { current: 100000, max: 100000, regenRate: 1000 },
      }),
      lingzhi: createDefaultPlanet('lingzhi', '灵植星', true, {
        wood_crystal:  { current: 100000, max: 100000, regenRate: 1000 },
        spirit_liquid: { current: 100000, max: 100000, regenRate: 1000 },
        spore:         { current: 30000, max: 30000, regenRate: 0 },
        life_dew:      { current: 20000, max: 20000, regenRate: 0 },
      }),
      youming: createDefaultPlanet('youming', '幽冥星', false, {
        soul_stone: { current: 80000, max: 80000, regenRate: 800 },
        dark_moss:  { current: 80000, max: 80000, regenRate: 800 },
        ghost_fire: { current: 25000, max: 25000, regenRate: 0 },
      }),
      tianjing: createDefaultPlanet('tianjing', '天晶星', false, {
        sky_crystal:    { current: 50000, max: 50000, regenRate: 0 },
        thunder_marrow: { current: 25000, max: 25000, regenRate: 0 },
        arc_stone:      { current: 50000, max: 50000, regenRate: 0 },
      }),
      huoshan: createDefaultPlanet('huoshan', '火山星', false, {
        fire_crystal:  { current: 50000, max: 50000, regenRate: 0 },
        lava_essence:  { current: 30000, max: 30000, regenRate: 0 },
        earth_fire:    { current: 10000, max: 10000, regenRate: 0 },
      }),
      bingfeng: createDefaultPlanet('bingfeng', '冰封星', false, {
        ice_stone:     { current: 50000, max: 50000, regenRate: 0 },
        ice_soul:      { current: 30000, max: 30000, regenRate: 0 },
        frost_essence: { current: 10000, max: 10000, regenRate: 0 },
      }),
      hundun: createDefaultPlanet('hundun', '混沌星', false, {
        chaos_stone:  { current: 10000, max: 10000, regenRate: 0 },
        void_vine:    { current: 10000, max: 10000, regenRate: 0 },
        dao_fragment: { current: 5000, max: 5000, regenRate: 0 },
      }),
      fukong: createDefaultPlanet('fukong', '浮空星', false, {
        wind_stone:    { current: 30000, max: 30000, regenRate: 0 },
        cloud_crystal: { current: 30000, max: 30000, regenRate: 0 },
        sky_water:     { current: 10000, max: 10000, regenRate: 0 },
      }),
      shenyuan: createDefaultPlanet('shenyuan', '深渊星', false, {
        abyss_stone:   { current: 10000, max: 10000, regenRate: 0 },
        chaos_origin:  { current: 5000, max: 5000, regenRate: 0 },
        void_essence:  { current: 3000, max: 3000, regenRate: 0 },
      }),
    },

    starShip: {
      capacityLevel: 1, capacity: 20,
      autoRouteUnlocked: false, portalUnlocked: false, portalFuel: 0,
      autoRoute: null,
    },

    quests: { currentChapter: 1, activeQuestId: '1.1', quests: {} },
    achievements: {},
    unlockedTitles: [],
    equippedTitle: null,
    codex: {
      collectedEquipments: [], collectedMaterials: [],
      completedSets: [], setProgress: {},
      defeatedBosses: [], exploredAreas: [],
    },

    weather: {
      currentWeathers: {
        origin: 'normal', xuantie: 'normal', lingzhi: 'normal', youming: 'normal',
        tianjing: 'normal', huoshan: 'normal', bingfeng: 'normal',
        hundun: 'normal', fukong: 'normal', shenyuan: 'normal',
      },
      weatherRemaining: {
        origin: 0, xuantie: 0, lingzhi: 0, youming: 0,
        tianjing: 0, huoshan: 0, bingfeng: 0,
        hundun: 0, fukong: 0, shenyuan: 0,
      },
      nextWeatherEventAt: now + 300000,
      specialWeatherGatherCount: 0,
    },

    combat: {
      currentPlanet: 'xuantie',
      bossTimers: {},
      dungeons: [
        { id: 'stardustMine',  dailyUsed: 0, dailyMax: 3, lastResetAt: now, weeklyUsed: 0, weeklyMax: 0, weeklyResetAt: 0, highestFloor: 0, tribulationStage: 0, ancientTrialStage: 0 },
        { id: 'herbGarden',    dailyUsed: 0, dailyMax: 3, lastResetAt: now, weeklyUsed: 0, weeklyMax: 0, weeklyResetAt: 0, highestFloor: 0, tribulationStage: 0, ancientTrialStage: 0 },
        { id: 'netherTrial',   dailyUsed: 0, dailyMax: 3, lastResetAt: now, weeklyUsed: 0, weeklyMax: 0, weeklyResetAt: 0, highestFloor: 0, tribulationStage: 0, ancientTrialStage: 0 },
        { id: 'thunderRealm',  dailyUsed: 0, dailyMax: 3, lastResetAt: now, weeklyUsed: 0, weeklyMax: 0, weeklyResetAt: 0, highestFloor: 0, tribulationStage: 0, ancientTrialStage: 0 },
        { id: 'chaosVision',   dailyUsed: 0, dailyMax: 3, lastResetAt: now, weeklyUsed: 0, weeklyMax: 0, weeklyResetAt: 0, highestFloor: 0, tribulationStage: 0, ancientTrialStage: 0 },
        { id: 'abyssRift',     dailyUsed: 0, dailyMax: 0, lastResetAt: 0,  weeklyUsed: 0, weeklyMax: 3, weeklyResetAt: now, highestFloor: 0, tribulationStage: 0, ancientTrialStage: 0 },
        { id: 'tribulation',   dailyUsed: 0, dailyMax: 1, lastResetAt: now, weeklyUsed: 0, weeklyMax: 0, weeklyResetAt: 0, highestFloor: 0, tribulationStage: 0, ancientTrialStage: 0 },
        { id: 'ancientTrial',  dailyUsed: 0, dailyMax: 1, lastResetAt: now, weeklyUsed: 0, weeklyMax: 0, weeklyResetAt: 0, highestFloor: 0, tribulationStage: 0, ancientTrialStage: 0 },
      ],
      totalKills: 0, totalCrits: 0, totalDodges: 0, bossKillCounts: {},
    },

    shop: {
      dailyPurchases: [], dailyRefreshedAt: 0,
      weeklyPurchases: [], weeklyRefreshedAt: 0,
    },
    bossChallengeTickets: 0,
    autoChallengeBoss: {
      enabled: false, targetBossIds: [],
      retryOnFail: false, retreatHpThreshold: 0,
    },

    offlineConfig: {
      autoCollectPlanets: [], autoProduce: false,
      autoHarvest: false, offlineMultiplier: 0.5, maxOfflineSeconds: 28800,
    },
    pendingOfflineRewards: null,

    cycle: {
      currentCycle: 1, monsterMultiplier: 1.0, monsterHpMultiplier: 1.0,
      bossAttackMultiplier: 1.0, bossDefenseMultiplier: 1.0, bossHpMultiplier: 1.0,
      dropMultiplier: 1.0, starYuanMultiplier: 1.0,
      endlessUnlocked: false, inheritance: null,
    },
    endless: {
      currentFloor: 0, highestFloor: 0, score: 0,
      totalTalentPoints: 0, spentTalentPoints: 0,
      talents: {}, unlockedSkills: [],
      inProgress: false, currentFloorProgress: 0, checkpoint: 0,
    },

    techTree: {
      researchPoints: 0, researchStationLevel: 0, nodes: {},
    },

    stats_log: {
      totalOnlineSeconds: 0, totalOfflineSeconds: 0,
      totalStarCoinsEarned: 0, totalSpiritStonesEarned: 0, totalDaoYunEarned: 0,
      totalGatherCount: 0, totalProduceCount: 0, totalCraftCount: 0,
      totalAlchemyCount: 0, totalEnhanceCount: 0, highestEnhanceLevel: 0,
      totalAffixCount: 0, specialWeatherGatherCount: 0, totalDungeonClears: 0,
      learnedSkillCount: 0, highestDamage: 0,
      consecutiveLoginDays: 0, skillKillCount: 0,
      killByType: {}, noHitBossKills: 0, speedKillBoss: 0, fastestDungeonClear: 999999,
      uniqueEquipmentsCollected: 0, qualityEquipments: {}, setsCompleted: 0, uniqueMaterialsCollected: 0,
      totalAreasExplored: 0, areasExploredPerPlanet: {},
    },

    settings: {
      autoCombat: true, showDamageNumbers: true,
      sfxVolume: 0.8, bgmVolume: 0.5, offlineNotify: true,
      combatSpeed: 1, autoBossChallenge: false,
      hpPotionThreshold: 0.5, autoUseBuffs: true,
    },
  };
}

/**
 * 星渊仙途 - 资源采集系统
 *
 * 职责：
 * - 管理各星球资源储量、采集速率计算
 * - 手动采集：消耗体力、产出资源、更新储量
 * - 自动采集：update(dt) 中持续产出
 * - 离线收益计算
 * - 资源储量管理（再生/枯竭）
 *
 * 设计参考：02-星球与资源系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState, PlanetId } from '../core/GameState';
import type { PlanetSystem } from './PlanetSystem';
import type { RealmSystem } from './RealmSystem';
import { addToInventory } from '../utils/inventory';

/** 资源配置 */
interface ResourceConfig {
  id?: string;
  name: string;
  baseRate: number;
  autoRate: number;
  maxReserve: number;
  regenRate: number;
  type: 'basic' | 'rare';
}

/** 星球资源配置 */
interface PlanetResourceConfig {
  id: string;
  name: string;
  resources: Record<string, ResourceConfig>;
}

export class ResourceSystem implements GameSystem {
  readonly name = 'Resource';

  private state: PlayerState;
  private events: EventBus;
  private planetSystem: PlanetSystem;
  private realmSystem: RealmSystem;
  private planetConfigs: Record<string, PlanetResourceConfig>;

  /** 自动采集计时器（秒） */
  private autoCollectTimer = 0;
  /** 资源再生计时器（秒） */
  private regenTimer = 0;

  constructor(
    state: PlayerState,
    events: EventBus,
    planetSystem: PlanetSystem,
    realmSystem: RealmSystem,
    planetConfigs: Record<string, PlanetResourceConfig>,
  ) {
    this.state = state;
    this.events = events;
    this.planetSystem = planetSystem;
    this.realmSystem = realmSystem; // 保留，后续用于境界加成
    this.planetConfigs = planetConfigs;
  }

  /**
   * 每帧更新：自动采集 + 资源再生
   */
  update(dt: number): void {
    // 自动采集（每秒结算一次）
    this.autoCollectTimer += dt;
    if (this.autoCollectTimer >= 1) {
      this.autoCollectTimer -= 1;
      this.processAutoCollect();
    }

    // 资源再生（每秒更新）
    this.regenTimer += dt;
    if (this.regenTimer >= 1) {
      this.regenTimer -= 1;
      this.processResourceRegen();
    }
  }

  /**
   * 手动采集
   *
   * @param resourceId 资源ID
   * @returns 实际采集数量
   */
  manualGather(resourceId: string): number {
    const planetId = this.planetSystem.getCurrentPlanet();
    const planet = this.state.planets[planetId];
    const config = this.planetConfigs[planetId]?.resources[resourceId];

    if (!config || !planet) return 0;

    // 检查储量
    const reserve = planet.resourceReserves[resourceId];
    if (!reserve || reserve.current <= 0) return 0;

    // 计算采集量
    const baseRate = config.baseRate;
    const currentStats = this.realmSystem.getCurrentStats();
    const realmBonus = 1 + (currentStats?.level ?? 1) * 0.05;
    const weatherBonus = this.planetSystem.getWeatherGatherMultiplier();
    const gatherSpeedBonus = this.getGatherSpeedBonus();
    const planetMultiplier = this.getPlanetGatherMultiplier(planetId);

    let amount = Math.floor(baseRate * realmBonus * weatherBonus * gatherSpeedBonus * planetMultiplier);

    // 枯竭惩罚
    const reservePercent = reserve.current / reserve.max;
    if (reservePercent <= 0) {
      amount = config.type === 'rare' ? 0 : Math.floor(amount * 0.1);
    } else if (reservePercent < 0.1) {
      amount = Math.floor(amount * 0.5);
    }

    // 限制不超过储量
    amount = Math.min(amount, reserve.current);

    if (amount <= 0) return 0;

    // 扣除储量
    reserve.current -= amount;

    // 添加到背包
    this.addToInventory(resourceId, config.name, amount);

    // 更新统计
    this.state.stats_log.totalGatherCount += 1;

    // 特殊天气采集统计
    if (planet.currentWeather !== 'normal') {
      this.state.weather.specialWeatherGatherCount += 1;
      this.state.stats_log.specialWeatherGatherCount += 1;
    }

    // 触发事件
    this.events.emit('resource:gathered', {
      planetId,
      resourceId,
      amount,
    });

    return amount;
  }

  /**
   * 处理自动采集（每秒）
   */
  private processAutoCollect(): void {
    for (const planetId of this.state.offlineConfig.autoCollectPlanets) {
      const planet = this.state.planets[planetId];
      if (!planet?.unlocked || !planet.autoCollect) continue;

      const config = this.planetConfigs[planetId];
      if (!config) continue;

      for (const [resourceId, resConfig] of Object.entries(config.resources)) {
        const reserve = planet.resourceReserves[resourceId];
        if (!reserve || reserve.current <= 0) continue;

        const rate = resConfig.autoRate;
        const realmBonus = 1 + this.state.realm.level * 0.05;
        const weatherBonus = this.planetSystem.getWeatherGatherMultiplier();

        let amount = Math.floor(rate * realmBonus * weatherBonus);

        // 枯竭惩罚
        const reservePercent = reserve.current / reserve.max;
        if (reservePercent <= 0) {
          amount = resConfig.type === 'rare' ? 0 : Math.floor(amount * 0.1);
        }

        amount = Math.min(amount, reserve.current);
        if (amount <= 0) continue;

        reserve.current -= amount;
        this.addToInventory(resourceId, resConfig.name, amount);
      }
    }
  }

  /**
   * 处理资源再生（每秒）
   *
   * 基础资源 1%/小时再生，稀有资源不可再生。
   */
  private processResourceRegen(): void {
    for (const planetId of Object.keys(this.state.planets) as PlanetId[]) {
      const planet = this.state.planets[planetId];
      if (!planet.unlocked) continue;

      for (const [, reserve] of Object.entries(planet.resourceReserves)) {
        if (reserve.regenRate <= 0) continue;
        if (reserve.current >= reserve.max) continue;

        // 每秒再生量 = 每小时再生量 / 3600
        const regenPerSecond = reserve.regenRate / 3600;
        reserve.current = Math.min(reserve.max, reserve.current + regenPerSecond);
      }
    }
  }

  /**
   * 计算离线收益
   *
   * @param offlineSeconds 离线时长（秒）
   * @returns 离线收益
   */
  calculateOfflineEarnings(offlineSeconds: number): Record<string, number> {
    const cappedSeconds = Math.min(
      offlineSeconds,
      this.state.offlineConfig.maxOfflineSeconds,
    );

    if (cappedSeconds < 60) return {};

    const minutes = cappedSeconds / 60;
    const multiplier = this.state.offlineConfig.offlineMultiplier;
    const earnings: Record<string, number> = {};

    for (const planetId of this.state.offlineConfig.autoCollectPlanets) {
      const planet = this.state.planets[planetId];
      if (!planet?.unlocked || !planet.autoCollect) continue;

      const config = this.planetConfigs[planetId];
      if (!config) continue;

      for (const [resourceId, resConfig] of Object.entries(config.resources)) {
        const rate = resConfig.autoRate;
        const amount = Math.floor(rate * minutes * multiplier);
        if (amount > 0) {
          earnings[resourceId] = (earnings[resourceId] ?? 0) + amount;
        }
      }
    }

    return earnings;
  }

  /**
   * 获取采集速度加成（来自装备词条）
   */
  private getGatherSpeedBonus(): number {
    let bonus = 1;

    // 检查装备的采集速度词条
    for (const equipId of Object.values(this.state.equippedGear)) {
      if (!equipId) continue;
      const equip = this.state.allEquipment[equipId];
      if (!equip) continue;

      for (const affix of equip.affixes) {
        if (affix.type === 'gatherSpeed') {
          bonus += affix.value;
        }
      }
    }

    return bonus;
  }

  /**
   * 获取星球采集倍率
   *
   * 来源：planet-config.json 中的 gatherMultiplier 字段
   * 起源星/玄铁星/灵植星: x1.0
   * 幽冥星/天晶星: x1.2
   * 火山星/混沌星: x1.5
   * 冰封星: x1.8
   * 浮空星: x2.5
   * 深渊星: x3.0
   */
  private getPlanetGatherMultiplier(planetId: PlanetId): number {
    const config = this.planetConfigs[planetId] as { gatherMultiplier?: number } | undefined;
    return config?.gatherMultiplier ?? 1.0;
  }

  /**
   * 添加物品到背包
   */
  private addToInventory(itemId: string, name: string, amount: number): void {
    addToInventory(this.state, itemId, name, amount, 'resource');
  }

  /**
   * 获取资源采集速率（用于UI显示）
   */
  getGatherRate(resourceId: string): number {
    const planetId = this.planetSystem.getCurrentPlanet();
    const config = this.planetConfigs[planetId]?.resources[resourceId];
    if (!config) return 0;

    const realmBonus = 1 + this.state.realm.level * 0.05;
    const weatherBonus = this.planetSystem.getWeatherGatherMultiplier();
    const gatherSpeedBonus = this.getGatherSpeedBonus();

    return Math.floor(config.baseRate * realmBonus * weatherBonus * gatherSpeedBonus);
  }

  /**
   * 获取自动采集速率（用于UI显示）
   */
  getAutoCollectRate(resourceId: string): number {
    const planetId = this.planetSystem.getCurrentPlanet();
    const config = this.planetConfigs[planetId]?.resources[resourceId];
    if (!config) return 0;

    const realmBonus = 1 + this.state.realm.level * 0.05;
    return Math.floor(config.autoRate * realmBonus);
  }

  /**
   * 切换自动采集
   */
  toggleAutoCollect(planetId: PlanetId): void {
    const planet = this.state.planets[planetId];
    if (!planet) return;

    planet.autoCollect = !planet.autoCollect;

    if (planet.autoCollect) {
      if (!this.state.offlineConfig.autoCollectPlanets.includes(planetId)) {
        this.state.offlineConfig.autoCollectPlanets.push(planetId);
      }
    } else {
      const idx = this.state.offlineConfig.autoCollectPlanets.indexOf(planetId);
      if (idx >= 0) {
        this.state.offlineConfig.autoCollectPlanets.splice(idx, 1);
      }
    }

    this.events.emit('resource:autoToggled', { planetId, enabled: planet.autoCollect });
  }

  /**
   * 获取星球资源列表（用于UI显示）
   */
  getPlanetResources(planetId: PlanetId): {
    id: string;
    name: string;
    reserve: number;
    maxReserve: number;
    reservePct: number;
    gatherRate: number;
    autoRate: number;
    type: 'basic' | 'rare';
  }[] {
    const config = this.planetConfigs[planetId];
    const planet = this.state.planets[planetId];
    if (!config || !planet) return [];

    return Object.entries(config.resources).map(([id, res]) => {
      const reserve = planet.resourceReserves[id];
      return {
        id,
        name: res.name,
        reserve: reserve?.current ?? 0,
        maxReserve: reserve?.max ?? 0,
        reservePct: reserve ? (reserve.current / reserve.max) * 100 : 0,
        gatherRate: this.getGatherRate(id),
        autoRate: this.getAutoCollectRate(id),
        type: res.type,
      };
    });
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {}
}

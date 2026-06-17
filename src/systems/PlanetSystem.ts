/**
 * 星渊仙途 - 星球管理系统
 *
 * 职责：
 * - 管理星球列表、解锁状态、当前所在星球
 * - 提供 switchPlanet(planetId) 切换
 * - 天气系统更新
 *
 * 设计参考：02-星球与资源系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState, PlanetId } from '../core/GameState';

export class PlanetSystem implements GameSystem {
  readonly name = 'Planet';

  private state: PlayerState;
  private events: EventBus;
  private weatherTimer = 0;

  constructor(state: PlayerState, events: EventBus) {
    this.state = state;
    this.events = events;
  }

  /**
   * 每帧更新：天气系统
   */
  update(dt: number): void {
    // 更新天气倒计时
    this.weatherTimer += dt;
    if (this.weatherTimer >= 1) {
      this.weatherTimer -= 1;
      this.updateWeather(1);
    }
  }

  /**
   * 获取当前星球ID
   */
  getCurrentPlanet(): PlanetId {
    return this.state.combat.currentPlanet;
  }

  /**
   * 获取当前星球数据
   */
  getCurrentPlanetData() {
    return this.state.planets[this.getCurrentPlanet()];
  }

  /**
   * 切换星球
   */
  switchPlanet(planetId: PlanetId): boolean {
    const planet = this.state.planets[planetId];
    if (!planet || !planet.unlocked) return false;

    this.state.combat.currentPlanet = planetId;
    this.events.emit('planet:switched', { planetId });
    return true;
  }

  /**
   * 解锁星球
   */
  unlockPlanet(planetId: PlanetId): boolean {
    const planet = this.state.planets[planetId];
    if (!planet || planet.unlocked) return false;

    planet.unlocked = true;
    this.events.emit('planet:unlocked', { planetId });
    return true;
  }

  /**
   * 检查星球解锁条件
   *
   * 条件来源：02-星球与资源系统.md 0.2节
   * 起源星/玄铁星/灵植星: 初始
   * 幽冥星/火山星: 金丹期（21级）
   * 天晶星/冰封星: 元婴期（31级）
   * 混沌星/浮空星/深渊星: 化神期（41级）
   */
  checkUnlockCondition(planetId: PlanetId): boolean {
    const conditions: Record<string, { level: number }> = {
      origin: { level: 1 },
      xuantie: { level: 1 },
      lingzhi: { level: 1 },
      youming: { level: 21 },
      tianjing: { level: 31 },
      huoshan: { level: 21 },
      bingfeng: { level: 31 },
      hundun: { level: 41 },
      fukong: { level: 41 },
      shenyuan: { level: 41 },
    };

    const cond = conditions[planetId];
    if (!cond) return true;
    return this.state.realm.level >= cond.level;
  }

  /**
   * 获取已解锁的星球列表
   */
  getUnlockedPlanets(): PlanetId[] {
    return (Object.keys(this.state.planets) as PlanetId[])
      .filter(id => this.state.planets[id].unlocked);
  }

  /**
   * 更新天气系统（每秒调用）
   */
  private updateWeather(dt: number): void {
    const weather = this.state.weather;

    // 更新各星球天气倒计时
    for (const planetId of Object.keys(weather.weatherRemaining) as PlanetId[]) {
      const remaining = weather.weatherRemaining[planetId];
      if (remaining > 0) {
        const newRemaining = Math.max(0, remaining - dt);
        weather.weatherRemaining[planetId] = newRemaining;

        // 同步到星球状态
        const planet = this.state.planets[planetId];
        if (planet) {
          planet.weatherRemaining = newRemaining;
        }

        if (newRemaining <= 0) {
          weather.currentWeathers[planetId] = 'normal';
          if (planet) {
            planet.currentWeather = 'normal';
          }
          this.events.emit('planet:weatherChanged', { planetId, weather: 'normal' });
        }
      }
    }

    // 检查是否触发新天气事件
    if (Date.now() >= weather.nextWeatherEventAt) {
      this.triggerRandomWeather();
      weather.nextWeatherEventAt = Date.now() + 300000; // 5分钟后下次事件
    }
  }

  /**
   * 触发随机天气事件
   */
  private triggerRandomWeather(): void {
    const unlocked = this.getUnlockedPlanets();
    if (unlocked.length === 0) return;

    // 随机选一个已解锁星球
    const planetId = unlocked[Math.floor(Math.random() * unlocked.length)];
    if (!planetId) return;
    const roll = Math.random();

    let weather: 'rain' | 'thunderstorm' | 'spatialRift';
    if (roll < 0.6) {
      weather = 'rain';
    } else if (roll < 0.9) {
      weather = 'thunderstorm';
    } else {
      weather = 'spatialRift';
    }

    const duration = 120 + Math.random() * 180; // 2-5分钟
    this.state.weather.currentWeathers[planetId] = weather;
    this.state.weather.weatherRemaining[planetId] = duration;
    this.state.planets[planetId].currentWeather = weather;
    this.state.planets[planetId].weatherRemaining = duration;

    this.events.emit('planet:weatherChanged', { planetId, weather });
  }

  /**
   * 获取当前星球天气对采集的加成倍率
   */
  getWeatherGatherMultiplier(): number {
    const planet = this.getCurrentPlanetData();
    switch (planet.currentWeather) {
      case 'rain': return 1.2;
      case 'thunderstorm': return 1.5;
      case 'spatialRift': return 2.0;
      default: return 1.0;
    }
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {}
}

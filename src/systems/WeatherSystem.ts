/**
 * 星渊仙途 - 天气系统
 *
 * 职责：
 * - 60分钟周期轮转 + 概率触发机制
 * - 每个星球独立天气状态
 * - 天气对采集的影响：特殊天气解锁专属资源
 *
 * 设计参考：02-星球与资源系统.md 天气部分
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState, PlanetId } from '../core/GameState';

/** 天气类型 */
export type WeatherType = 'normal' | 'rain' | 'thunderstorm' | 'spatialRift' | 'eruption' | 'blizzard' | 'cloudSea' | 'voidRift';

/** 天气配置 */
interface WeatherConfig {
  type: WeatherType;
  name: string;
  gatherMultiplier: number;
  icon: string;
}

/** 天气定义 */
const WEATHER_CONFIGS: WeatherConfig[] = [
  { type: 'normal',      name: '晴朗',     gatherMultiplier: 1.0, icon: '☀' },
  { type: 'rain',        name: '小雨',     gatherMultiplier: 1.2, icon: '🌧' },
  { type: 'thunderstorm', name: '雷暴',    gatherMultiplier: 1.5, icon: '⛈' },
  { type: 'spatialRift', name: '空间裂缝',  gatherMultiplier: 2.0, icon: '🌀' },
  { type: 'eruption',    name: '火山喷发',  gatherMultiplier: 1.5, icon: '🌋' },
  { type: 'blizzard',    name: '暴风雪',   gatherMultiplier: 1.8, icon: '❄' },
  { type: 'cloudSea',    name: '云海',     gatherMultiplier: 2.5, icon: '☁' },
  { type: 'voidRift',    name: '虚空裂缝',  gatherMultiplier: 3.0, icon: '🕳' },
];

/** 各星球可能出现的天气 */
const PLANET_WEATHERS: Record<PlanetId, WeatherType[]> = {
  origin:   ['normal', 'rain'],
  xuantie:  ['normal', 'rain', 'thunderstorm'],
  lingzhi:  ['normal', 'rain', 'thunderstorm'],
  youming:  ['normal', 'spatialRift'],
  tianjing: ['normal', 'thunderstorm'],
  huoshan:  ['normal', 'eruption'],
  bingfeng: ['normal', 'blizzard'],
  hundun:   ['normal', 'spatialRift', 'voidRift'],
  fukong:   ['normal', 'cloudSea'],
  shenyuan: ['normal', 'voidRift', 'spatialRift'],
};

export class WeatherSystem implements GameSystem {
  readonly name = 'Weather';

  private state: PlayerState;
  private events: EventBus;

  /** 天气更新计时器（秒） */
  private updateTimer = 0;
  /** 天气检查间隔（秒） */
  private readonly CHECK_INTERVAL = 60;

  constructor(state: PlayerState, events: EventBus) {
    this.state = state;
    this.events = events;
  }

  /**
   * 每帧更新
   */
  update(dt: number): void {
    this.updateTimer += dt;
    if (this.updateTimer >= this.CHECK_INTERVAL) {
      this.updateTimer -= this.CHECK_INTERVAL;
      this.checkWeatherChanges();
    }

    // 更新天气倒计时
    this.updateWeatherDurations(dt);
  }

  /**
   * 更新天气持续时间
   */
  private updateWeatherDurations(dt: number): void {
    const weather = this.state.weather;
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

        // 天气结束
        if (newRemaining <= 0) {
          this.setWeather(planetId, 'normal');
        }
      }
    }
  }

  /**
   * 检查天气变化
   */
  private checkWeatherChanges(): void {
    const now = Date.now();
    const weather = this.state.weather;

    // 检查是否到了天气事件触发时间
    if (now < weather.nextWeatherEventAt) return;

    // 设置下次天气事件时间（5-10分钟后）
    weather.nextWeatherEventAt = now + (300 + Math.random() * 300) * 1000;

    // 随机选择一个已解锁星球触发天气
    const unlockedPlanets = (Object.keys(this.state.planets) as PlanetId[])
      .filter(id => this.state.planets[id].unlocked);

    if (unlockedPlanets.length === 0) return;

    const planetId = unlockedPlanets[Math.floor(Math.random() * unlockedPlanets.length)];
    if (!planetId) return;

    // 获取该星球可能出现的天气
    const possibleWeathers = PLANET_WEATHERS[planetId] ?? ['normal'];
    const weatherType = this.rollWeather(possibleWeathers);

    if (weatherType !== 'normal') {
      // 持续时间 2-5 分钟
      const duration = 120 + Math.random() * 180;
      this.setWeather(planetId, weatherType, duration);
    }
  }

  /**
   * 随机选择天气
   */
  private rollWeather(possibleWeathers: WeatherType[]): WeatherType {
    // 70% 概率保持晴朗
    if (Math.random() < 0.7) return 'normal';

    // 从可能的天气中随机选择
    const index = Math.floor(Math.random() * possibleWeathers.length);
    return possibleWeathers[index] ?? 'normal';
  }

  /**
   * 设置天气
   */
  private setWeather(planetId: PlanetId, weatherType: WeatherType, duration = 0): void {
    const weather = this.state.weather;
    const planet = this.state.planets[planetId];

    weather.currentWeathers[planetId] = weatherType;
    weather.weatherRemaining[planetId] = duration;

    if (planet) {
      planet.currentWeather = weatherType;
      planet.weatherRemaining = duration;
    }

    this.events.emit('planet:weatherChanged', { planetId, weather: weatherType });
  }

  /**
   * 获取天气配置
   */
  getWeatherConfig(weatherType: WeatherType): WeatherConfig | undefined {
    return WEATHER_CONFIGS.find(w => w.type === weatherType);
  }

  /**
   * 获取当前星球天气
   */
  getCurrentWeather(planetId: PlanetId): WeatherType {
    return this.state.weather.currentWeathers[planetId] ?? 'normal';
  }

  /**
   * 获取天气采集倍率
   */
  getWeatherGatherMultiplier(planetId: PlanetId): number {
    const weatherType = this.getCurrentWeather(planetId);
    const config = this.getWeatherConfig(weatherType);
    return config?.gatherMultiplier ?? 1.0;
  }

  /**
   * 检查资源是否需要特定天气
   */
  isWeatherRequired(planetId: PlanetId, weatherRequired: string): boolean {
    const currentWeather = this.getCurrentWeather(planetId);
    return currentWeather === weatherRequired;
  }

  /**
   * 获取所有天气配置
   */
  getAllWeatherConfigs(): WeatherConfig[] {
    return WEATHER_CONFIGS;
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {
    this.updateTimer = 0;
  }
}

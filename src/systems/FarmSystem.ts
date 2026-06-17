/**
 * 星渊仙途 - 灵田系统
 *
 * 职责：
 * - 灵植星开辟灵田（最多12块）
 * - 种植灵草种子（10分钟/30分钟/2小时生长周期）
 * - 定时收获
 *
 * 设计参考：02-星球与资源系统.md 灵田部分
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState, FarmPlot } from '../core/GameState';
import { addToInventory, removeFromInventory } from '../utils/inventory';

/** 种子配置 */
interface SeedConfig {
  id: string;
  name: string;
  growTime: number;  // 生长周期（秒）
  output: { id: string; name: string; baseAmount: number };
  cost: { starCoins: number };
}

/** 种子配置表 */
const SEED_CONFIGS: Record<string, SeedConfig> = {
  spirit_grass_seed: {
    id: 'spirit_grass_seed',
    name: '灵草种子',
    growTime: 600,  // 10分钟
    output: { id: 'herb', name: '灵草', baseAmount: 4 },
    cost: { starCoins: 100 },
  },
  centennial_grass_seed: {
    id: 'centennial_grass_seed',
    name: '百年灵草种子',
    growTime: 1800,  // 30分钟
    output: { id: 'herb', name: '百年灵草', baseAmount: 3 },
    cost: { starCoins: 500 },
  },
  millennial_grass_seed: {
    id: 'millennial_grass_seed',
    name: '千年灵草种子',
    growTime: 7200,  // 2小时
    output: { id: 'herb', name: '千年灵草', baseAmount: 2 },
    cost: { starCoins: 2000 },
  },
};

export class FarmSystem implements GameSystem {
  readonly name = 'Farm';

  private state: PlayerState;
  private events: EventBus;

  constructor(state: PlayerState, events: EventBus) {
    this.state = state;
    this.events = events;
    void this.events; // 保留，后续用于触发事件
  }

  /**
   * 每帧更新：检查作物成熟
   */
  update(_dt: number): void {
    const now = Date.now();
    const lingzhi = this.state.planets.lingzhi;
    if (!lingzhi?.unlocked) return;

    for (const plot of lingzhi.farmPlots) {
      if (!plot.seedId) continue;
      if (now >= plot.harvestAt) {
        // 自动标记为可收获
      }
    }
  }

  /**
   * 种植种子
   */
  plantSeed(plotId: number, seedId: string): boolean {
    const lingzhi = this.state.planets.lingzhi;
    if (!lingzhi?.unlocked) return false;

    const plot = lingzhi.farmPlots.find(p => p.plotId === plotId);
    if (!plot || plot.seedId) return false;

    const seedConfig = SEED_CONFIGS[seedId];
    if (!seedConfig) return false;

    // 检查并扣除种子
    if (!removeFromInventory(this.state, seedId, 1)) return false;

    // 种植
    const now = Date.now();
    plot.seedId = seedId;
    plot.plantedAt = now;
    plot.harvestAt = now + seedConfig.growTime * 1000;

    return true;
  }

  /**
   * 收获作物
   */
  harvest(plotId: number): { id: string; name: string; amount: number } | null {
    const lingzhi = this.state.planets.lingzhi;
    if (!lingzhi?.unlocked) return null;

    const plot = lingzhi.farmPlots.find(p => p.plotId === plotId);
    if (!plot || !plot.seedId) return null;

    // 检查是否成熟
    if (Date.now() < plot.harvestAt) return null;

    const seedConfig = SEED_CONFIGS[plot.seedId];
    if (!seedConfig) return null;

    // 计算产量（灵田等级加成：每级+10%）
    const levelBonus = 1 + plot.level * 0.1;
    const amount = Math.floor(seedConfig.output.baseAmount * levelBonus);

    // 添加到背包
    addToInventory(this.state, seedConfig.output.id, seedConfig.output.name, amount, 'resource');

    // 清空灵田
    plot.seedId = null;
    plot.plantedAt = 0;
    plot.harvestAt = 0;

    // 自动补种
    if (plot.autoReplant) {
      this.plantSeed(plotId, seedConfig.id);
    }

    return { id: seedConfig.output.id, name: seedConfig.output.name, amount };
  }

  /**
   * 开辟新灵田
   */
  unlockPlot(): boolean {
    const lingzhi = this.state.planets.lingzhi;
    if (!lingzhi?.unlocked) return false;
    if (lingzhi.farmPlots.length >= 12) return false;

    const cost = 1000 * Math.pow(2, lingzhi.farmPlots.length);
    if (this.state.currency.starCoins < cost) return false;

    this.state.currency.starCoins -= cost;
    lingzhi.farmPlots.push({
      plotId: lingzhi.farmPlots.length + 1,
      seedId: null,
      plantedAt: 0,
      harvestAt: 0,
      level: 0,
      autoReplant: false,
    });

    return true;
  }

  /**
   * 获取灵田列表
   */
  getFarmPlots(): FarmPlot[] {
    const lingzhi = this.state.planets.lingzhi;
    return lingzhi?.farmPlots ?? [];
  }

  /**
   * 获取种子配置
   */
  getSeedConfigs(): SeedConfig[] {
    return Object.values(SEED_CONFIGS);
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {}
}

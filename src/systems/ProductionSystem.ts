/**
 * 星渊仙途 - 生产链系统
 *
 * 职责：
 * - 生产线管理，支持 startProduction/collectProduct
 * - 生产设备独立生产线
 * - 生产速度公式：baseTime / (1 + deviceLevel × accelCoeff)
 * - 设备升级系统
 *
 * 设计参考：03-生产链系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState, DeviceType } from '../core/GameState';

/** 配方配置 */
interface RecipeConfig {
  id: string;
  name: string;
  device: DeviceType;
  inputs: Record<string, number>;
  output: Record<string, number>;
  baseTime: number;
  unlockCondition: { level: number } | null;
}

/** 设备配置 */
interface DeviceConfig {
  id: string;
  name: string;
  unlockCondition: { level: number } | null;
  maxLevel: number;
  speedBonusPerLevel: number;
  successBonusPerLevel?: number;
}

/** 生产中的队列项（使用 GameState 中的 ProductionItem） */
import type { ProductionItem as ProductionJob } from '../core/GameState';

export class ProductionSystem implements GameSystem {
  readonly name = 'Production';

  private state: PlayerState;
  private events: EventBus;
  private recipes: Record<string, RecipeConfig>;
  private deviceConfigs: Record<string, DeviceConfig>;

  constructor(
    state: PlayerState,
    events: EventBus,
    recipes: Record<string, RecipeConfig>,
    deviceConfigs: Record<string, DeviceConfig>,
  ) {
    this.state = state;
    this.events = events;
    this.recipes = recipes;
    this.deviceConfigs = deviceConfigs;
  }

  /**
   * 每帧更新：检查生产完成
   */
  update(_dt: number): void {
    const now = Date.now();
    for (const deviceType of Object.keys(this.state.devices) as DeviceType[]) {
      const device = this.state.devices[deviceType];
      if (!device.unlocked) continue;

      const completedJobs: number[] = [];
      for (let i = 0; i < device.queue.length; i++) {
        const job = device.queue[i];
        if (job && now >= job.finishAt) {
          completedJobs.push(i);
        }
      }

      // 从后往前移除已完成的
      for (let i = completedJobs.length - 1; i >= 0; i--) {
        const idx = completedJobs[i];
        if (idx !== undefined) {
          const job = device.queue[idx];
          if (job) {
            this.completeJob(deviceType, job);
            device.queue.splice(idx, 1);
          }
        }
      }
    }
  }

  /**
   * 开始生产
   */
  startProduction(recipeId: string): boolean {
    const recipe = this.recipes[recipeId];
    if (!recipe) return false;

    const device = this.state.devices[recipe.device];
    if (!device || !device.unlocked) return false;

    // 检查队列容量
    if (device.queue.length >= device.queueCapacity) return false;

    // 检查解锁条件
    if (recipe.unlockCondition && this.state.realm.level < recipe.unlockCondition.level) return false;

    // 检查材料
    for (const [matId, amount] of Object.entries(recipe.inputs)) {
      const item = this.state.inventory.items[matId];
      if (!item || item.quantity < amount) return false;
    }

    // 扣除材料
    for (const [matId, amount] of Object.entries(recipe.inputs)) {
      const item = this.state.inventory.items[matId];
      if (item) {
        item.quantity -= amount;
        if (item.quantity <= 0) {
          delete this.state.inventory.items[matId];
        }
      }
    }

    // 计算生产时间
    const productionTime = this.calculateProductionTime(recipe);

    // 创建生产任务
    const now = Date.now();
    const outputAmount = Object.values(recipe.output)[0] ?? 1;

    const job: ProductionJob = {
      recipeId,
      outputName: recipe.name,
      quantity: outputAmount,
      startedAt: now,
      finishAt: now + productionTime * 1000,
    };

    device.queue.push(job);
    this.events.emit('production:started', { deviceType: recipe.device, recipeId });
    return true;
  }

  /**
   * 完成生产
   */
  private completeJob(deviceType: DeviceType, job: ProductionJob): void {
    // 从配方获取产物ID
    const recipe = this.recipes[job.recipeId];
    const outputId = recipe ? Object.keys(recipe.output)[0] : job.recipeId;

    if (!outputId) return;

    // 添加产物到背包
    const existing = this.state.inventory.items[outputId];
    if (existing) {
      existing.quantity += job.quantity;
    } else {
      this.state.inventory.items[outputId] = {
        id: outputId,
        name: job.outputName,
        type: 'material',
        quantity: job.quantity,
        maxStack: 0,
      };
    }

    this.state.stats_log.totalProduceCount += 1;
    this.events.emit('production:completed', {
      deviceType,
      outputId,
      quantity: job.quantity,
    });
  }

  /**
   * 计算生产时间（秒）
   *
   * 公式：baseTime / (1 + deviceLevel × speedBonusPerLevel)
   */
  calculateProductionTime(recipe: RecipeConfig): number {
    const device = this.state.devices[recipe.device];
    const deviceConfig = this.deviceConfigs[recipe.device];
    if (!device || !deviceConfig) return recipe.baseTime;

    const speedBonus = 1 + device.level * deviceConfig.speedBonusPerLevel;
    return recipe.baseTime / speedBonus;
  }

  /**
   * 收取产物（一键收取指定设备的全部完成产物）
   */
  collectProduct(deviceType: DeviceType): void {
    const device = this.state.devices[deviceType];
    if (!device) return;

    const now = Date.now();
    const completed = device.queue.filter(job => now >= job.finishAt);
    for (const job of completed) {
      this.completeJob(deviceType, job);
    }
    device.queue = device.queue.filter(job => now < job.finishAt);
  }

  /**
   * 升级设备
   */
  upgradeDevice(deviceType: DeviceType): boolean {
    const device = this.state.devices[deviceType];
    const config = this.deviceConfigs[deviceType];
    if (!device || !config || !device.unlocked) return false;
    if (device.level >= config.maxLevel) return false;

    // 升级消耗（简化：星币）
    const cost = 1000 * Math.pow(2, device.level);
    if (this.state.currency.starCoins < cost) return false;

    this.state.currency.starCoins -= cost;
    device.level += 1;
    return true;
  }

  /**
   * 获取可用配方
   */
  getAvailableRecipes(deviceType: DeviceType): RecipeConfig[] {
    return Object.values(this.recipes).filter(recipe => {
      if (recipe.device !== deviceType) return false;
      if (recipe.unlockCondition && this.state.realm.level < recipe.unlockCondition.level) return false;
      return true;
    });
  }

  /**
   * 获取设备信息
   */
  getDeviceInfo(deviceType: DeviceType): {
    name: string;
    level: number;
    maxLevel: number;
    unlocked: boolean;
    queueCount: number;
    queueCapacity: number;
  } | null {
    const device = this.state.devices[deviceType];
    const config = this.deviceConfigs[deviceType];
    if (!device || !config) return null;

    return {
      name: config.name,
      level: device.level,
      maxLevel: config.maxLevel,
      unlocked: device.unlocked,
      queueCount: device.queue.length,
      queueCapacity: device.queueCapacity,
    };
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {}
}

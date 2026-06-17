/**
 * 星渊仙途 - 商店系统
 *
 * 职责：
 * - 商店商品列表管理，按境界解锁过滤
 * - buy(itemId, count) 购买
 * - sell(item) 出售
 * - 货币管理：星币、灵石的 add/spend/getBalance
 *
 * 设计参考：05-商店系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState } from '../core/GameState';
import { addToInventory } from '../utils/inventory';

/** 商品配置 */
interface ShopItemConfig {
  id: string;
  name: string;
  type: 'resource' | 'skill';
  giveItems?: Record<string, number>;
  skillId?: string;
  price: { starCoins?: number; spiritStones?: number; daoYun?: number };
  unlockCondition?: { level: number };
}

/** 商店分类配置 */
interface ShopCategoryConfig {
  name: string;
  items: Record<string, ShopItemConfig>;
}

export class ShopSystem implements GameSystem {
  readonly name = 'Shop';

  private state: PlayerState;
  private events: EventBus;
  private categories: Record<string, ShopCategoryConfig>;

  constructor(
    state: PlayerState,
    events: EventBus,
    categories: Record<string, ShopCategoryConfig>,
  ) {
    this.state = state;
    this.events = events;
    this.categories = categories;
  }

  update(_dt: number): void {}

  /**
   * 获取已解锁的商品列表
   */
  getAvailableItems(): { category: string; categoryName: string; items: ShopItemConfig[] }[] {
    const result: { category: string; categoryName: string; items: ShopItemConfig[] }[] = [];

    for (const [catId, cat] of Object.entries(this.categories)) {
      const availableItems = Object.values(cat.items).filter(item => {
        if (!item.unlockCondition) return true;
        return this.state.realm.level >= item.unlockCondition.level;
      });

      if (availableItems.length > 0) {
        result.push({
          category: catId,
          categoryName: cat.name,
          items: availableItems,
        });
      }
    }

    return result;
  }

  /**
   * 购买商品
   *
   * @param itemId 商品ID
   * @param count 购买数量
   * @returns 是否成功
   */
  buy(itemId: string, count = 1): boolean {
    // 查找商品配置
    const item = this.findItem(itemId);
    if (!item) return false;

    // 检查解锁条件
    if (item.unlockCondition && this.state.realm.level < item.unlockCondition.level) {
      return false;
    }

    // 一次性商品检查（功法/蓝图只能购买一次）
    if (item.type === 'skill' && item.skillId) {
      const existing = this.state.skills[item.skillId];
      if (existing && existing.status === 'learned') return false;
    }
    if (item.giveItems) {
      // 蓝图类商品检查是否已拥有
      const isBlueprint = Object.keys(item.giveItems).some(id => id.startsWith('blueprint_'));
      if (isBlueprint) {
        for (const giveId of Object.keys(item.giveItems)) {
          if (this.state.inventory.items[giveId]) return false;
        }
      }
    }

    // 计算总价
    const totalCost = {
      starCoins: (item.price.starCoins ?? 0) * count,
      spiritStones: (item.price.spiritStones ?? 0) * count,
      daoYun: (item.price.daoYun ?? 0) * count,
    };

    // 检查余额
    if (this.state.currency.starCoins < totalCost.starCoins) return false;
    if (this.state.currency.spiritStones < totalCost.spiritStones) return false;
    if (this.state.currency.daoYun < totalCost.daoYun) return false;

    // 扣费
    this.state.currency.starCoins -= totalCost.starCoins;
    this.state.currency.spiritStones -= totalCost.spiritStones;
    this.state.currency.daoYun -= totalCost.daoYun;

    // 发放物品
    if (item.type === 'resource' && item.giveItems) {
      for (const [giveId, giveAmount] of Object.entries(item.giveItems)) {
        this.addToInventory(giveId, giveId, giveAmount * count);
      }
    }

    // 学习功法
    if (item.type === 'skill' && item.skillId) {
      const existing = this.state.skills[item.skillId];
      if (existing) {
        existing.status = 'learned';
      } else {
        this.state.skills[item.skillId] = {
          id: item.skillId,
          name: item.name,
          type: 'active',
          status: 'learned',
          evolutionLevel: 0,
          fragmentCount: 0,
          fragmentRequired: 0,
          cooldownEndsAt: 0,
        };
      }
      this.state.stats_log.learnedSkillCount += 1;
    }

    // 更新统计
    this.state.stats_log.totalStarCoinsEarned -= totalCost.starCoins; // 花费

    this.events.emit('shop:purchased', {
      itemId,
      quantity: count,
      cost: totalCost,
    });

    return true;
  }

  /**
   * 出售物品
   */
  sell(itemId: string, count = 1): boolean {
    const item = this.state.inventory.items[itemId];
    if (!item || item.quantity < count) return false;

    // 出售价格（按物品类型）
    const sellPrice = this.getSellPrice(itemId, item.type);
    const totalGain = sellPrice * count;

    // 扣除物品
    item.quantity -= count;
    if (item.quantity <= 0) {
      delete this.state.inventory.items[itemId];
    }

    // 增加星币
    this.state.currency.starCoins += totalGain;

    this.events.emit('shop:sold', {
      itemId,
      quantity: count,
      gain: totalGain,
    });

    return true;
  }

  /**
   * 获取出售价格
   */
  private getSellPrice(itemId: string, _type: string): number {
    // 资源类物品基础售价
    const basePrices: Record<string, number> = {
      iron_ore: 5,
      copper_ore: 6,
      star_dust: 10,
      stone: 2,
      wood: 2,
      herb: 3,
    };

    return basePrices[itemId] ?? 1;
  }

  /**
   * 查找商品配置
   */
  private findItem(itemId: string): ShopItemConfig | null {
    for (const cat of Object.values(this.categories)) {
      if (cat.items[itemId]) return cat.items[itemId];
    }
    return null;
  }

  /**
   * 添加物品到背包
   */
  private addToInventory(itemId: string, name: string, amount: number): void {
    addToInventory(this.state, itemId, name, amount, 'resource');
  }

  /**
   * 获取货币余额
   */
  getBalance(): { starCoins: number; spiritStones: number; daoYun: number } {
    return {
      starCoins: this.state.currency.starCoins,
      spiritStones: this.state.currency.spiritStones,
      daoYun: this.state.currency.daoYun,
    };
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {}
}

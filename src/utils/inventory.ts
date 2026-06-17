/**
 * 星渊仙途 - 背包公共工具函数
 *
 * 消除各系统中 addToInventory 的重复代码。
 */

import type { PlayerState, InventoryItem } from '../core/GameState';

/**
 * 向背包添加物品
 *
 * @param state 玩家状态
 * @param itemId 物品ID
 * @param name 物品名称
 * @param amount 数量
 * @param type 物品类型
 */
export function addToInventory(
  state: PlayerState,
  itemId: string,
  name: string,
  amount: number,
  type: InventoryItem['type'] = 'resource',
): void {
  const items = state.inventory.items;
  if (items[itemId]) {
    items[itemId].quantity += amount;
  } else {
    items[itemId] = {
      id: itemId,
      name,
      type,
      quantity: amount,
      maxStack: 0,
    };
  }
}

/**
 * 从背包移除物品
 *
 * @returns 是否成功移除
 */
export function removeFromInventory(
  state: PlayerState,
  itemId: string,
  amount: number,
): boolean {
  const item = state.inventory.items[itemId];
  if (!item || item.quantity < amount) return false;

  item.quantity -= amount;
  if (item.quantity <= 0) {
    delete state.inventory.items[itemId];
  }
  return true;
}

/**
 * 获取背包物品数量
 */
export function getInventoryCount(state: PlayerState, itemId: string): number {
  return state.inventory.items[itemId]?.quantity ?? 0;
}

/**
 * 检查背包是否有足够物品
 */
export function hasInventoryItem(state: PlayerState, itemId: string, amount: number): boolean {
  return getInventoryCount(state, itemId) >= amount;
}

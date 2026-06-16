/**
 * 星渊仙途 - 星舟运输系统
 *
 * 基础版：手动搬运，每次携带20单位，跨星球运输时间5秒。
 * 设计参考：02-星球与资源系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState, PlanetId } from '../core/GameState';

interface TransportTask {
  id: string;
  fromPlanet: PlanetId;
  toPlanet: PlanetId;
  items: Record<string, number>;
  startedAt: number;
  arriveAt: number;
  completed: boolean;
}

export class TransportSystem implements GameSystem {
  readonly name = 'Transport';

  private state: PlayerState;
  private events: EventBus;
  private tasks: TransportTask[] = [];
  private taskIdCounter = 0;

  /** 运输时间（秒） */
  private readonly TRANSPORT_TIME = 5;

  constructor(state: PlayerState, events: EventBus) {
    this.state = state;
    this.events = events;
  }

  /**
   * 每帧更新：检查运输任务完成
   */
  update(_dt: number): void {
    const now = Date.now();
    for (const task of this.tasks) {
      if (!task.completed && now >= task.arriveAt) {
        this.completeTask(task);
      }
    }

    // 清理已完成任务
    this.tasks = this.tasks.filter(t => !t.completed);
  }

  /**
   * 发起运输
   *
   * @param fromPlanet 出发星球
   * @param toPlanet 目标星球
   * @param items 运输物品 { resourceId: amount }
   * @returns 是否成功发起
   */
  transport(fromPlanet: PlanetId, toPlanet: PlanetId, items: Record<string, number>): boolean {
    // 验证星球已解锁
    if (!this.state.planets[fromPlanet]?.unlocked) return false;
    if (!this.state.planets[toPlanet]?.unlocked) return false;

    // 验证背包有足够物品
    const totalAmount = Object.values(items).reduce((sum, v) => sum + v, 0);
    if (totalAmount > this.state.starShip.capacity) return false;

    for (const [resourceId, amount] of Object.entries(items)) {
      const item = this.state.inventory.items[resourceId];
      if (!item || item.quantity < amount) return false;
    }

    // 扣除背包物品
    for (const [resourceId, amount] of Object.entries(items)) {
      const item = this.state.inventory.items[resourceId];
      if (!item) return false;
      item.quantity -= amount;
      if (item.quantity <= 0) {
        delete this.state.inventory.items[resourceId];
      }
    }

    // 创建运输任务
    const now = Date.now();
    const task: TransportTask = {
      id: `transport_${++this.taskIdCounter}`,
      fromPlanet,
      toPlanet,
      items,
      startedAt: now,
      arriveAt: now + this.TRANSPORT_TIME * 1000,
      completed: false,
    };

    this.tasks.push(task);
    this.events.emit('transport:started', { task: { ...task } });
    return true;
  }

  /**
   * 完成运输任务
   */
  private completeTask(task: TransportTask): void {
    task.completed = true;

    // 将物品添加到目标星球的资源储量
    const planet = this.state.planets[task.toPlanet];
    if (planet) {
      for (const [resourceId, amount] of Object.entries(task.items)) {
        const reserve = planet.resourceReserves[resourceId];
        if (reserve) {
          reserve.current = Math.min(reserve.max, reserve.current + amount);
        }
      }
    }

    this.events.emit('transport:completed', {
      fromPlanet: task.fromPlanet,
      toPlanet: task.toPlanet,
      items: task.items,
    });
  }

  /**
   * 获取进行中的运输任务
   */
  getActiveTasks(): TransportTask[] {
    return this.tasks.filter(t => !t.completed);
  }

  /**
   * 获取星舟容量
   */
  getCapacity(): number {
    return this.state.starShip.capacity;
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {
    this.tasks = [];
  }
}

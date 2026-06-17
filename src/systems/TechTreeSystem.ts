/**
 * 星渊仙途 - 科技树系统
 *
 * 职责：
 * - 研究点累积、科技解锁、前置依赖校验
 * - 科技效果通过 modifier 注入各系统
 *
 * 设计参考：12-科技树系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState } from '../core/GameState';

/** 科技节点配置 */
interface TechNodeConfig {
  id: string;
  name: string;
  branch: 'gather' | 'produce' | 'explore';
  tier: number;
  cost: number;
  prerequisites: string[];
  effects: Record<string, number>;
}

export class TechTreeSystem implements GameSystem {
  readonly name = 'TechTree';

  private state: PlayerState;
  private events: EventBus;
  private nodeConfigs: Record<string, TechNodeConfig>;

  /** 研究点累积计时器 */
  private researchTimer = 0;

  constructor(state: PlayerState, events: EventBus, nodeConfigs: Record<string, TechNodeConfig>) {
    this.state = state;
    this.events = events;
    this.nodeConfigs = nodeConfigs;
  }

  /**
   * 每帧更新：累积研究点
   */
  update(dt: number): void {
    this.researchTimer += dt;
    if (this.researchTimer >= 1) {
      this.researchTimer -= 1;
      this.state.techTree.researchPoints += this.getResearchRate();
    }
  }

  /**
   * 获取研究速率（点/秒）
   */
  getResearchRate(): number {
    const level = this.state.techTree.researchStationLevel;
    const rates = [0.5, 1.5, 4, 10];
    return (rates[level] ?? 0.5) / 60;
  }

  /**
   * 解锁科技
   */
  unlockTech(nodeId: string): boolean {
    const config = this.nodeConfigs[nodeId];
    if (!config) return false;

    const node = this.state.techTree.nodes[nodeId];
    if (node?.researched) return false;

    // 检查前置依赖
    for (const prereq of config.prerequisites) {
      if (!this.state.techTree.nodes[prereq]?.researched) return false;
    }

    // 检查研究点
    if (this.state.techTree.researchPoints < config.cost) return false;

    // 扣除研究点
    this.state.techTree.researchPoints -= config.cost;

    // 解锁
    this.state.techTree.nodes[nodeId] = {
      researched: true,
      progress: 1,
    };

    this.events.emit('tech:unlocked', { nodeId, effects: config.effects });
    return true;
  }

  /**
   * 获取科技效果加成
   */
  getTechBonus(effectType: string): number {
    let bonus = 0;
    for (const [nodeId, node] of Object.entries(this.state.techTree.nodes)) {
      if (!node.researched) continue;
      const config = this.nodeConfigs[nodeId];
      if (config?.effects[effectType]) {
        bonus += config.effects[effectType];
      }
    }
    return bonus;
  }

  /**
   * 获取所有科技节点状态
   */
  getTechNodes(): { id: string; name: string; branch: string; tier: number; researched: boolean; canUnlock: boolean; cost: number }[] {
    return Object.entries(this.nodeConfigs).map(([id, config]) => {
      const node = this.state.techTree.nodes[id];
      const researched = node?.researched ?? false;
      const canUnlock = !researched && this.canUnlock(id);
      return {
        id,
        name: config.name,
        branch: config.branch,
        tier: config.tier,
        researched,
        canUnlock,
        cost: config.cost,
      };
    });
  }

  /**
   * 检查是否可解锁
   */
  private canUnlock(nodeId: string): boolean {
    const config = this.nodeConfigs[nodeId];
    if (!config) return false;

    // 检查前置
    for (const prereq of config.prerequisites) {
      if (!this.state.techTree.nodes[prereq]?.researched) return false;
    }

    // 检查研究点
    return this.state.techTree.researchPoints >= config.cost;
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {
    this.researchTimer = 0;
  }
}

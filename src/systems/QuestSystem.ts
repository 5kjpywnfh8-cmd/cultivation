/**
 * 星渊仙途 - 主线任务系统
 *
 * 职责：
 * - 任务状态机（locked→active→completed→claimed）
 * - 任务进度追踪
 * - 章节奖励发放
 *
 * 设计参考：08-主线任务系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState, QuestStatus } from '../core/GameState';
import { getItemName } from '../utils/names';

/** 任务配置 */
interface QuestConfig {
  id: string;
  chapter: number;
  name: string;
  description: string;
  objectives: { type: string; target: string; count: number }[];
  rewards: { starCoins?: number; spiritStones?: number; items?: Record<string, number> };
  unlockCondition?: { level?: number; questId?: string };
}

export class QuestSystem implements GameSystem {
  readonly name = 'Quest';

  private state: PlayerState;
  private events: EventBus;
  private questConfigs: Record<string, QuestConfig>;

  constructor(state: PlayerState, events: EventBus, questConfigs: Record<string, QuestConfig>) {
    this.state = state;
    this.events = events;
    this.questConfigs = questConfigs;
  }

  update(_dt: number): void {}

  /**
   * 接受任务
   */
  acceptQuest(questId: string): boolean {
    const config = this.questConfigs[questId];
    if (!config) return false;

    const quest = this.state.quests.quests[questId];
    if (quest && quest.status !== 'locked') return false;

    this.state.quests.quests[questId] = {
      questId,
      status: 'active',
      currentProgress: 0,
      targetProgress: config.objectives.reduce((sum, obj) => sum + obj.count, 0),
      completedAt: 0,
    };

    this.state.quests.activeQuestId = questId;
    return true;
  }

  /**
   * 更新任务进度
   */
  updateProgress(questId: string, amount = 1): void {
    const quest = this.state.quests.quests[questId];
    if (!quest || quest.status !== 'active') return;

    quest.currentProgress = Math.min(quest.currentProgress + amount, quest.targetProgress);

    if (quest.currentProgress >= quest.targetProgress) {
      quest.status = 'completed';
      quest.completedAt = Date.now();
      this.events.emit('quest:completed', { questId });
    }
  }

  /**
   * 领取奖励
   */
  claimReward(questId: string): boolean {
    const quest = this.state.quests.quests[questId];
    if (!quest || quest.status !== 'completed') return false;

    const config = this.questConfigs[questId];
    if (!config) return false;

    // 发放奖励
    if (config.rewards.starCoins) {
      this.state.currency.starCoins += config.rewards.starCoins;
    }
    if (config.rewards.spiritStones) {
      this.state.currency.spiritStones += config.rewards.spiritStones;
    }
    if (config.rewards.items) {
      for (const [itemId, amount] of Object.entries(config.rewards.items)) {
        const existing = this.state.inventory.items[itemId];
        if (existing) {
          existing.quantity += amount;
        } else {
          this.state.inventory.items[itemId] = {
            id: itemId,
            name: getItemName(itemId),
            type: 'resource',
            quantity: amount,
            maxStack: 0,
          };
        }
      }
    }

    quest.status = 'completed' as QuestStatus;
    this.events.emit('quest:rewardClaimed', { questId, rewards: config.rewards });
    return true;
  }

  /**
   * 获取当前活跃任务
   */
  getActiveQuest(): QuestConfig | null {
    const activeId = this.state.quests.activeQuestId;
    if (!activeId) return null;
    return this.questConfigs[activeId] ?? null;
  }

  /**
   * 获取任务状态
   */
  getQuestStatus(questId: string): QuestStatus {
    return this.state.quests.quests[questId]?.status ?? 'locked';
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {}
}

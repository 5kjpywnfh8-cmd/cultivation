/**
 * 星渊仙途 - 新手引导系统
 *
 * 第零章7步引导，逐步解锁采集/打造/战斗/商店功能。
 * 每步高亮对应 UI 元素，引导玩家完成基础操作。
 *
 * 设计参考：08-主线任务系统.md 第零章
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState } from '../core/GameState';

/** 引导步骤 */
export interface TutorialStep {
  id: number;
  title: string;
  description: string;
  target: string; // 高亮目标的 CSS 选择器
  action: string; // 提示操作
  completed: boolean;
}

/** 引导状态 */
export type TutorialStatus = 'active' | 'completed' | 'skipped';

export class TutorialSystem implements GameSystem {
  readonly name = 'Tutorial';

  private state: PlayerState;
  private events: EventBus;

  /** 当前引导状态 */
  status: TutorialStatus = 'active';
  /** 当前步骤索引 */
  currentStepIndex = 0;
  /** 引导步骤列表 */
  steps: TutorialStep[] = [];

  constructor(state: PlayerState, events: EventBus) {
    this.state = state;
    this.events = events;
    this.initSteps();
  }

  /**
   * 初始化引导步骤
   */
  private initSteps(): void {
    this.steps = [
      {
        id: 0,
        title: '欢迎来到星渊仙途',
        description: '你是一名低阶修士，驾驶星舟穿梭各星球。让我们开始修炼之旅！',
        target: '.realm-panel',
        action: '点击"修炼"按钮开始累积星元',
        completed: false,
      },
      {
        id: 1,
        title: '境界突破',
        description: '当星元累积到足够时，点击"突破"按钮提升境界等级。',
        target: '.btn-breakthrough',
        action: '点击"突破"按钮',
        completed: false,
      },
      {
        id: 2,
        title: '探索星球',
        description: '前往星球面板，探索不同的星球获取资源。',
        target: '[data-route="planet"]',
        action: '切换到星球面板',
        completed: false,
      },
      {
        id: 3,
        title: '采集资源',
        description: '在星球面板点击"采集"按钮获取资源，或开启自动采集。',
        target: '.btn-gather',
        action: '点击"采集"按钮',
        completed: false,
      },
      {
        id: 4,
        title: '打造装备',
        description: '前往装备面板的"锻造台"，消耗材料打造你的第一件装备。',
        target: '[data-route="equipment"]',
        action: '切换到装备面板，打造一件装备',
        completed: false,
      },
      {
        id: 5,
        title: '强化装备',
        description: '前往强化面板，提升装备的属性。',
        target: '[data-route="enhance"]',
        action: '切换到强化面板，强化一件装备',
        completed: false,
      },
      {
        id: 6,
        title: '自动战斗',
        description: '前往战斗面板，开启自动战斗获取经验和掉落。',
        target: '[data-route="combat"]',
        action: '切换到战斗面板',
        completed: false,
      },
      {
        id: 7,
        title: '商店交易',
        description: '前往商店面板，购买你需要的资源和功法。',
        target: '[data-route="shop"]',
        action: '切换到商店面板',
        completed: false,
      },
    ];
  }

  update(_dt: number): void {}

  /**
   * 获取当前引导步骤
   */
  getCurrentStep(): TutorialStep | null {
    if (this.status !== 'active') return null;
    return this.steps[this.currentStepIndex] ?? null;
  }

  /**
   * 完成当前步骤
   */
  completeCurrentStep(): void {
    if (this.status !== 'active') return;
    const step = this.steps[this.currentStepIndex];
    if (step) {
      step.completed = true;
      this.currentStepIndex++;

      // 检查是否全部完成
      if (this.currentStepIndex >= this.steps.length) {
        this.status = 'completed';
        this.state.tutorialCompleted = true;
        this.events.emit('tutorial:completed', {});
      } else {
        this.events.emit('tutorial:stepCompleted', {
          stepId: step.id,
          nextStep: this.steps[this.currentStepIndex],
        });
      }
    }
  }

  /**
   * 跳过引导
   */
  skip(): void {
    this.status = 'skipped';
    this.state.tutorialCompleted = true;
    this.events.emit('tutorial:skipped', {});
  }

  /**
   * 检查是否已完成
   */
  isCompleted(): boolean {
    return this.status === 'completed' || this.status === 'skipped';
  }

  /**
   * 获取进度百分比
   */
  getProgress(): number {
    const completed = this.steps.filter(s => s.completed).length;
    return Math.floor((completed / this.steps.length) * 100);
  }

  beforeSave(): void {}

  /**
   * 读档后回调：从存档恢复引导状态
   */
  afterLoad(): void {
    if (this.state.tutorialCompleted) {
      this.status = 'completed';
      this.currentStepIndex = this.steps.length;
      this.steps.forEach(s => s.completed = true);
    }
  }

  reset(): void {
    this.status = 'active';
    this.currentStepIndex = 0;
    this.initSteps();
  }
}

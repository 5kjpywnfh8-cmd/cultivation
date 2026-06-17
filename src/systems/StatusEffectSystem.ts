/**
 * 星渊仙途 - 状态效果系统
 *
 * 职责：
 * - 管理战斗中的状态效果（灼烧/流血/减速/冰冻/麻痹/眩晕/破防）
 * - Boss对同种控制5秒免疫
 * - DoT伤害计算
 *
 * 设计参考：06-战斗与Boss系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState } from '../core/GameState';

/** 状态效果类型 */
export type StatusEffectType =
  | 'burn'        // 灼烧：DoT 2%/s
  | 'bleed'       // 流血：DoT 50%攻击/s
  | 'slow'        // 减速：-50%
  | 'freeze'      // 冰冻：控制
  | 'paralyze'    // 麻痹：控制
  | 'stun'        // 眩晕：控制
  | 'defenseBreak'; // 破防：-50%防御

/** 状态效果实例 */
export interface StatusEffect {
  type: StatusEffectType;
  duration: number;      // 剩余持续时间（秒）
  value: number;         // 效果数值
  source: string;        // 来源ID
  appliedAt: number;     // 施加时间戳
}

/** 控制类效果 */
const CONTROL_EFFECTS: StatusEffectType[] = ['freeze', 'paralyze', 'stun'];

/** Boss免疫记录 */
interface ImmunityRecord {
  effectType: StatusEffectType;
  immuneUntil: number;
}

export class StatusEffectSystem implements GameSystem {
  readonly name = 'StatusEffect';

  private state: PlayerState;
  private events: EventBus;

  /** 玩家身上的状态效果 */
  playerEffects: StatusEffect[] = [];
  /** Boss身上的状态效果 */
  bossEffects: StatusEffect[] = [];
  /** Boss免疫记录 */
  private bossImmunities: ImmunityRecord[] = [];

  constructor(state: PlayerState, events: EventBus) {
    this.state = state;
    this.events = events;
  }

  /**
   * 每帧更新：处理DoT和效果过期
   */
  update(dt: number): void {
    this.processEffects(this.playerEffects, dt, 'player');
    this.processEffects(this.bossEffects, dt, 'boss');
    this.cleanupImmunities();
  }

  /**
   * 处理效果列表
   */
  private processEffects(effects: StatusEffect[], dt: number, target: 'player' | 'boss'): void {
    const expired: number[] = [];

    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      if (!effect) continue;

      // 处理DoT伤害
      if (effect.type === 'burn' || effect.type === 'bleed') {
        const damage = this.calculateDotDamage(effect, target);
        if (damage > 0) {
          if (target === 'player') {
            this.state.stats.currentHp = Math.max(0, this.state.stats.currentHp - damage);
          }
          this.events.emit('status:dot', { target, type: effect.type, damage });
        }
      }

      // 减少持续时间
      effect.duration -= dt;
      if (effect.duration <= 0) {
        expired.push(i);
      }
    }

    // 移除过期效果（从后往前）
    for (let i = expired.length - 1; i >= 0; i--) {
      const idx = expired[i];
      if (idx !== undefined) {
        effects.splice(idx, 1);
      }
    }
  }

  /**
   * 计算DoT伤害
   */
  private calculateDotDamage(effect: StatusEffect, target: 'player' | 'boss'): number {
    if (effect.type === 'burn') {
      // 灼烧：最大生命值的2%/秒
      const maxHp = target === 'player' ? this.state.stats.hp : 5000; // Boss最大生命从配置读取
      return Math.floor(maxHp * effect.value);
    }
    if (effect.type === 'bleed') {
      // 流血：攻击的50%/秒
      const attack = target === 'player' ? this.state.stats.attack : 30;
      return Math.floor(attack * effect.value);
    }
    return 0;
  }

  /**
   * 施加状态效果
   */
  applyEffect(target: 'player' | 'boss', effectType: StatusEffectType, duration: number, value: number, source: string): boolean {
    // 检查Boss免疫
    if (target === 'boss' && CONTROL_EFFECTS.includes(effectType)) {
      const isImmune = this.bossImmunities.some(
        imm => imm.effectType === effectType && Date.now() < imm.immuneUntil
      );
      if (isImmune) return false;
    }

    const effects = target === 'player' ? this.playerEffects : this.bossEffects;

    // 检查是否已有同类型效果（刷新持续时间）
    const existing = effects.find(e => e.type === effectType);
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      existing.value = Math.max(existing.value, value);
      return true;
    }

    // 添加新效果
    effects.push({
      type: effectType,
      duration,
      value,
      source,
      appliedAt: Date.now(),
    });

    // Boss控制免疫（5秒）
    if (target === 'boss' && CONTROL_EFFECTS.includes(effectType)) {
      this.bossImmunities.push({
        effectType,
        immuneUntil: Date.now() + 5000,
      });
    }

    this.events.emit('status:applied', { target, effectType, duration, value });
    return true;
  }

  /**
   * 移除状态效果
   */
  removeEffect(target: 'player' | 'boss', effectType: StatusEffectType): void {
    const effects = target === 'player' ? this.playerEffects : this.bossEffects;
    const index = effects.findIndex(e => e.type === effectType);
    if (index >= 0) {
      effects.splice(index, 1);
    }
  }

  /**
   * 清除所有效果
   */
  clearAll(target: 'player' | 'boss'): void {
    if (target === 'player') {
      this.playerEffects = [];
    } else {
      this.bossEffects = [];
    }
  }

  /**
   * 检查是否有控制效果
   */
  isControlled(target: 'player' | 'boss'): boolean {
    const effects = target === 'player' ? this.playerEffects : this.bossEffects;
    return effects.some(e => CONTROL_EFFECTS.includes(e.type));
  }

  /**
   * 获取防御修正（破防效果）
   */
  getDefenseMultiplier(target: 'player' | 'boss'): number {
    const effects = target === 'player' ? this.playerEffects : this.bossEffects;
    const defenseBreak = effects.find(e => e.type === 'defenseBreak');
    return defenseBreak ? (1 - defenseBreak.value) : 1;
  }

  /**
   * 获取速度修正（减速效果）
   */
  getSpeedMultiplier(target: 'player' | 'boss'): number {
    const effects = target === 'player' ? this.playerEffects : this.bossEffects;
    const slow = effects.find(e => e.type === 'slow');
    return slow ? (1 - slow.value) : 1;
  }

  /**
   * 清理过期免疫
   */
  private cleanupImmunities(): void {
    const now = Date.now();
    this.bossImmunities = this.bossImmunities.filter(imm => now < imm.immuneUntil);
  }

  /**
   * 获取当前效果列表（用于UI显示）
   */
  getActiveEffects(target: 'player' | 'boss'): StatusEffect[] {
    return target === 'player' ? [...this.playerEffects] : [...this.bossEffects];
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {
    this.playerEffects = [];
    this.bossEffects = [];
    this.bossImmunities = [];
  }
}

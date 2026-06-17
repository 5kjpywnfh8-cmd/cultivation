/**
 * 星渊仙途 - 技能系统
 *
 * 职责：
 * - 技能槽管理（练气1主动0被动→筑基2主动1被动→金丹3主动1被动）
 * - 主动技能释放：伤害计算、特效应用、冷却
 * - 被动技能效果：通过 modifier 叠加
 *
 * 设计参考：07-技能系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState } from '../core/GameState';

/** 技能配置 */
interface SkillConfig {
  id: string;
  name: string;
  type: 'active' | 'passive';
  description: string;
  damageMultiplier?: number;
  cooldown: number;
  effects?: Record<string, number>;
  unlockCondition?: { level?: number; item?: string };
}

export class SkillSystem implements GameSystem {
  readonly name = 'Skill';

  private state: PlayerState;
  private events: EventBus;
  private skillConfigs: Record<string, SkillConfig>;

  constructor(state: PlayerState, events: EventBus, skillConfigs: Record<string, SkillConfig>) {
    this.state = state;
    this.events = events;
    this.skillConfigs = skillConfigs;
  }

  update(_dt: number): void {}

  /**
   * 学习技能
   */
  learnSkill(skillId: string): boolean {
    const config = this.skillConfigs[skillId];
    if (!config) return false;

    const existing = this.state.skills[skillId];
    if (existing?.status === 'learned') return false;

    this.state.skills[skillId] = {
      id: skillId,
      name: config.name,
      type: config.type,
      status: 'learned',
      evolutionLevel: 0,
      fragmentCount: 0,
      fragmentRequired: 0,
      cooldownEndsAt: 0,
    };

    this.state.stats_log.learnedSkillCount += 1;
    this.events.emit('skill:learned', { skillId });
    return true;
  }

  /**
   * 释放主动技能
   */
  useSkill(skillId: string): { damage: number; effects: string[] } | null {
    const config = this.skillConfigs[skillId];
    if (!config || config.type !== 'active') return null;

    const skill = this.state.skills[skillId];
    if (!skill || skill.status !== 'learned') return null;

    // 检查冷却
    if (Date.now() < skill.cooldownEndsAt) return null;

    // 计算伤害
    const attack = this.state.stats.attack;
    const multiplier = config.damageMultiplier ?? 1.0;
    const damage = Math.floor(attack * multiplier);

    // 设置冷却
    const cdr = this.getCooldownReduction();
    const finalCd = config.cooldown * (1 - Math.min(cdr, 0.5));
    skill.cooldownEndsAt = Date.now() + finalCd * 1000;

    // 应用特效
    const effects: string[] = [];
    if (config.effects) {
      for (const [effect, value] of Object.entries(config.effects)) {
        effects.push(`${effect}: ${value}`);
      }
    }

    this.events.emit('skill:used', { skillId, damage, effects });
    return { damage, effects };
  }

  /**
   * 获取被动技能加成
   */
  getPassiveBonus(effectType: string): number {
    let bonus = 0;
    for (const [skillId, skill] of Object.entries(this.state.skills)) {
      if (skill.status !== 'learned' || skill.type !== 'passive') continue;
      const config = this.skillConfigs[skillId];
      if (config?.effects?.[effectType]) {
        bonus += config.effects[effectType];
      }
    }
    return bonus;
  }

  /**
   * 获取冷却缩减
   */
  getCooldownReduction(): number {
    let cdr = 0;
    // 装备词条
    for (const equipId of Object.values(this.state.equippedGear)) {
      if (!equipId) continue;
      const equip = this.state.allEquipment[equipId];
      if (!equip) continue;
      for (const affix of equip.affixes) {
        if (affix.type === 'cdReduction') cdr += affix.value;
      }
    }
    return cdr;
  }

  /**
   * 获取技能列表
   */
  getSkillList(): { id: string; name: string; type: string; learned: boolean; cooldownRemaining: number }[] {
    return Object.entries(this.skillConfigs).map(([id, config]) => {
      const skill = this.state.skills[id];
      const learned = skill?.status === 'learned';
      const cooldownRemaining = learned ? Math.max(0, (skill.cooldownEndsAt - Date.now()) / 1000) : 0;
      return {
        id,
        name: config.name,
        type: config.type,
        learned,
        cooldownRemaining,
      };
    });
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {}
}

/**
 * 星渊仙途 - Boss战斗系统
 *
 * 职责：
 * - Boss技能系统：按优先级和冷却自动释放
 * - Boss掉落表：独立掉落表，按概率判定
 * - Boss刷新机制：击败后进入冷却
 * - Boss挑战券：灵石阁购买，立即刷新
 *
 * 设计参考：06-战斗与Boss系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState } from '../core/GameState';
import type { StatusEffectSystem, StatusEffectType } from './StatusEffectSystem';
import { addToInventory } from '../utils/inventory';

/** Boss技能配置 */
interface BossSkillConfig {
  id: string;
  name: string;
  damageMultiplier?: number;
  defenseMultiplier?: number;
  attackMultiplier?: number;
  duration?: number;
  cooldown: number;
  effectType?: StatusEffectType;
  effectDuration?: number;
  triggerHpPercent?: number;
  priority: number;
}

/** Boss配置 */
export interface BossConfig {
  id: string;
  name: string;
  planet: string;
  stats: { attack: number; defense: number; hp: number };
  skills: BossSkillConfig[];
  drops: { id: string; chance: number; min: number; max: number }[];
  refreshInterval: number;
  unlockCondition: { level: number };
}

/** Boss战斗状态 */
interface BossBattleState {
  bossId: string;
  currentHp: number;
  maxHp: number;
  attack: number;
  defense: number;
  skillCooldowns: Record<string, number>;
  enrageTriggered: boolean;
  startTime: number;
}

export class BossSystem implements GameSystem {
  readonly name = 'Boss';

  private state: PlayerState;
  private events: EventBus;
  private statusEffectSystem: StatusEffectSystem;
  private bossConfigs: Record<string, BossConfig>;

  /** 当前Boss战斗状态 */
  currentBattle: BossBattleState | null = null;

  constructor(
    state: PlayerState,
    events: EventBus,
    statusEffectSystem: StatusEffectSystem,
    bossConfigs: Record<string, BossConfig>,
  ) {
    this.state = state;
    this.events = events;
    this.statusEffectSystem = statusEffectSystem;
    this.bossConfigs = bossConfigs;
  }

  update(_dt: number): void {}

  /**
   * 挑战Boss
   */
  challengeBoss(bossId: string): boolean {
    const config = this.bossConfigs[bossId];
    if (!config) return false;

    // 检查解锁条件
    if (this.state.realm.level < config.unlockCondition.level) return false;

    // 检查冷却
    const lastKilled = this.state.combat.bossTimers[bossId] ?? 0;
    if (Date.now() < lastKilled) return false;

    // 初始化Boss战斗
    this.currentBattle = {
      bossId,
      currentHp: config.stats.hp,
      maxHp: config.stats.hp,
      attack: config.stats.attack,
      defense: config.stats.defense,
      skillCooldowns: {},
      enrageTriggered: false,
      startTime: Date.now(),
    };

    this.events.emit('combat:bossStart', { bossId, bossName: config.name });
    return true;
  }

  /**
   * 执行Boss战斗回合
   */
  executeRound(): { playerDamage: number; bossDamage: number; bossAction: string; drops: Record<string, number> } | null {
    if (!this.currentBattle) return null;

    const battle = this.currentBattle;
    const config = this.bossConfigs[battle.bossId];
    if (!config) return null;

    let bossAction = '普通攻击';
    let bossDamage = battle.attack;

    // 检查狂暴
    if (!battle.enrageTriggered && battle.currentHp / battle.maxHp < 0.2) {
      battle.enrageTriggered = true;
      battle.attack = Math.floor(battle.attack * 1.5);
      bossAction = '狂暴';
    }

    // Boss技能释放
    const skill = this.selectBossSkill(battle, config);
    if (skill) {
      bossAction = skill.name;
      if (skill.damageMultiplier) {
        bossDamage = Math.floor(battle.attack * skill.damageMultiplier);
      }
      if (skill.effectType && skill.effectDuration) {
        this.statusEffectSystem.applyEffect('player', skill.effectType, skill.effectDuration, 0, battle.bossId);
      }
      if (skill.defenseMultiplier) {
        battle.defense = Math.floor(config.stats.defense * skill.defenseMultiplier);
      }
      battle.skillCooldowns[skill.id] = Date.now() + skill.cooldown * 1000;
    }

    // 计算玩家伤害
    const playerAttack = this.state.stats.attack;
    const effectiveDefense = battle.defense * this.statusEffectSystem.getDefenseMultiplier('boss');
    const reductionRate = effectiveDefense / (effectiveDefense + 1000 + this.state.realm.level * 50);
    const isCrit = Math.random() < this.state.stats.critRate;
    const critMultiplier = isCrit ? (1.5 + this.state.stats.critDamage) : 1;
    const playerDamage = Math.max(1, Math.floor(playerAttack * (1 - reductionRate) * critMultiplier));

    // 扣除Boss生命
    battle.currentHp = Math.max(0, battle.currentHp - playerDamage);

    // 扣除玩家生命
    const playerDefense = this.state.stats.defense * this.statusEffectSystem.getDefenseMultiplier('player');
    const playerReduction = playerDefense / (playerDefense + 1000 + battle.attack * 50);
    const playerDamageTaken = Math.max(1, Math.floor(bossDamage * (1 - playerReduction)));
    this.state.stats.currentHp = Math.max(0, this.state.stats.currentHp - playerDamageTaken);

    // 检查Boss是否死亡
    if (battle.currentHp <= 0) {
      const drops = this.rollDrops(config);
      this.onBossDefeated(battle.bossId, drops);
      return { playerDamage, bossDamage: playerDamageTaken, bossAction, drops };
    }

    // 检查玩家是否死亡
    if (this.state.stats.currentHp <= 0) {
      this.events.emit('combat:defeat', { bossId: battle.bossId });
      this.currentBattle = null;
      return { playerDamage, bossDamage: playerDamageTaken, bossAction, drops: {} };
    }

    return { playerDamage, bossDamage: playerDamageTaken, bossAction, drops: {} };
  }

  /**
   * 选择Boss技能
   */
  private selectBossSkill(battle: BossBattleState, config: BossConfig): BossSkillConfig | null {
    const now = Date.now();
    const hpPercent = battle.currentHp / battle.maxHp;

    // 按优先级排序
    const availableSkills = config.skills
      .filter(skill => {
        // 检查冷却
        const cd = battle.skillCooldowns[skill.id] ?? 0;
        if (now < cd) return false;
        // 检查血量触发条件
        if (skill.triggerHpPercent && hpPercent > skill.triggerHpPercent) return false;
        return true;
      })
      .sort((a, b) => b.priority - a.priority);

    return availableSkills[0] ?? null;
  }

  /**
   * 掉落判定
   */
  private rollDrops(config: BossConfig): Record<string, number> {
    const drops: Record<string, number> = {};
    for (const drop of config.drops) {
      if (Math.random() < drop.chance) {
        const amount = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
        drops[drop.id] = amount;
      }
    }
    return drops;
  }

  /**
   * Boss被击败
   */
  private onBossDefeated(bossId: string, drops: Record<string, number>): void {
    const config = this.bossConfigs[bossId];

    // 设置刷新冷却
    this.state.combat.bossTimers[bossId] = Date.now() + (config?.refreshInterval ?? 180) * 1000;

    // 更新统计
    this.state.combat.bossKillCounts[bossId] = (this.state.combat.bossKillCounts[bossId] ?? 0) + 1;

    // 发放掉落
    for (const [itemId, amount] of Object.entries(drops)) {
      if (itemId === 'starCoins') {
        this.state.currency.starCoins += amount;
      } else if (itemId === 'spiritStones') {
        this.state.currency.spiritStones += amount;
      } else {
        addToInventory(this.state, itemId, itemId, amount, 'resource');
      }
    }

    this.currentBattle = null;
    this.events.emit('combat:victory', { bossId, drops, isBoss: true });
  }

  /**
   * 使用Boss挑战券
   */
  useChallengeTicket(bossId: string): boolean {
    // 检查挑战券
    if (this.state.bossChallengeTickets <= 0) return false;

    // 清除冷却
    this.state.combat.bossTimers[bossId] = 0;
    this.state.bossChallengeTickets -= 1;

    return true;
  }

  /**
   * 获取Boss状态
   */
  getBossStatus(bossId: string): {
    available: boolean;
    cooldownRemaining: number;
    killCount: number;
    config: BossConfig | null;
  } {
    const config = this.bossConfigs[bossId] ?? null;
    const lastKilled = this.state.combat.bossTimers[bossId] ?? 0;
    const cooldownRemaining = Math.max(0, lastKilled - Date.now()) / 1000;

    return {
      available: Date.now() >= lastKilled,
      cooldownRemaining,
      killCount: this.state.combat.bossKillCounts[bossId] ?? 0,
      config,
    };
  }

  /**
   * 获取当前战斗状态
   */
  getCurrentBattle(): BossBattleState | null {
    return this.currentBattle;
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {
    this.currentBattle = null;
  }
}

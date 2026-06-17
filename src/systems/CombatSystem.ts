/**
 * 星渊仙途 - 基础战斗系统
 *
 * 职责：
 * - 伤害公式：actualDmg = attack × skillMultiplier × (1 - reductionRate) × critCoeff
 * - 减伤率：def / (def + 1000 + attackerLevel × 50)
 * - 暴击判定：软上限30%、硬上限80%
 * - 自动战斗：普通区域每秒结算一次
 * - Boss战：手动操作，Boss技能按冷却释放
 * - 掉落系统
 *
 * 设计参考：06-战斗与Boss系统.md
 */

import type { GameSystem } from '../core/GameLoop';
import type { EventBus } from '../core/EventBus';
import type { PlayerState, PlanetId } from '../core/GameState';
import { getItemName } from '../utils/names';

/** 怪物模板 */
interface MonsterTemplate {
  id: string;
  name: string;
  planet: string;
  type: 'normal' | 'boss';
  stats: { attack: number; defense: number; hp: number };
  skills: MonsterSkill[];
  drops: Record<string, { min: number; max: number; chance?: number }>;
  refreshInterval?: number;
  unlockCondition?: { level: number };
}

/** 怪物技能 */
interface MonsterSkill {
  id: string;
  name: string;
  damageMultiplier?: number;
  defenseMultiplier?: number;
  attackMultiplier?: number;
  duration?: number;
  cooldown: number;
  triggerHpPercent?: number;
  type?: string;
}

/** 战斗实例 */
interface CombatInstance {
  monsterId: string;
  monsterName: string;
  monsterHp: number;
  monsterMaxHp: number;
  monsterAttack: number;
  monsterDefense: number;
  monsterSkills: MonsterSkill[];
  skillCooldowns: Record<string, number>;
  isBoss: boolean;
  startTime: number;
}

/** 战斗结果 */
export interface CombatResult {
  victory: boolean;
  damageDealt: number;
  damageTaken: number;
  isCrit: boolean;
  drops: Record<string, number>;
  duration: number;
}

export class CombatSystem implements GameSystem {
  readonly name = 'Combat';

  private state: PlayerState;
  private events: EventBus;
  private monsterTemplates: Record<string, MonsterTemplate>;
  private bossTemplates: Record<string, MonsterTemplate>;

  /** 当前战斗实例 */
  private currentCombat: CombatInstance | null = null;
  /** 自动战斗计时器 */
  private autoCombatTimer = 0;
  /** 自动战斗开关 */
  autoCombatEnabled = true;

  /** 战斗日志 */
  combatLog: string[] = [];

  constructor(
    state: PlayerState,
    events: EventBus,
    monsterTemplates: Record<string, MonsterTemplate>,
    bossTemplates: Record<string, MonsterTemplate>,
  ) {
    this.state = state;
    this.events = events;
    this.monsterTemplates = monsterTemplates;
    this.bossTemplates = bossTemplates;
  }

  /**
   * 每帧更新：自动战斗
   */
  update(dt: number): void {
    if (!this.autoCombatEnabled) return;
    if (this.currentCombat) return; // 已有战斗进行中

    this.autoCombatTimer += dt;
    if (this.autoCombatTimer >= 1) {
      this.autoCombatTimer -= 1;
      this.processAutoCombat();
    }
  }

  /**
   * 处理自动战斗（每秒）
   */
  private processAutoCombat(): void {
    const planetId = this.state.combat.currentPlanet;
    const monsters = this.getMonstersForPlanet(planetId);
    if (monsters.length === 0) return;

    // 随机选一个怪物
    const monster = monsters[Math.floor(Math.random() * monsters.length)];
    if (!monster) return;

    // 执行战斗
    const result = this.executeCombat(monster);

    if (result.victory) {
      // 处理掉落
      this.processDrops(result.drops);
      this.events.emit('combat:victory', {
        targetId: monster.id,
        drops: result.drops,
      });
    } else {
      this.events.emit('combat:defeat', {
        targetId: monster.id,
      });
    }
  }

  /**
   * 执行战斗
   */
  executeCombat(monster: MonsterTemplate): CombatResult {
    const playerStats = this.state.stats;
    const monsterStats = monster.stats;

    let playerHp = playerStats.currentHp;
    let monsterHp = monsterStats.hp;
    let totalDamageDealt = 0;
    let totalDamageTaken = 0;
    const startTime = Date.now();

    // 战斗循环（最多100回合）
    for (let round = 0; round < 100; round++) {
      // 玩家攻击
      const playerDamage = this.calculateDamage(
        playerStats.attack,
        playerStats.critRate,
        playerStats.critDamage,
        playerStats.penetration,
        monsterStats.defense,
        this.state.realm.level,
      );

      monsterHp -= playerDamage.damage;
      totalDamageDealt += playerDamage.damage;

      if (monsterHp <= 0) {
        // 玩家胜利
        const drops = this.rollDrops(monster.drops);
        this.state.combat.totalKills += 1;
        if (playerDamage.isCrit) this.state.combat.totalCrits += 1;

        // 战斗胜利后恢复生命（简化处理）
        this.state.stats.currentHp = this.state.stats.hp;

        return {
          victory: true,
          damageDealt: totalDamageDealt,
          damageTaken: totalDamageTaken,
          isCrit: playerDamage.isCrit,
          drops,
          duration: (Date.now() - startTime) / 1000,
        };
      }

      // 怪物攻击
      const monsterDamage = this.calculateDamage(
        monsterStats.attack,
        0.1, // 怪物暴击率10%
        0.3, // 怪物暴击伤害30%
        0,   // 怪物无穿透
        playerStats.defense,
        1,   // 怪物等级1
      );

      // 闪避判定
      if (Math.random() < playerStats.dodgeRate) {
        this.state.combat.totalDodges += 1;
        continue;
      }

      playerHp -= monsterDamage.damage;
      totalDamageTaken += monsterDamage.damage;

      if (playerHp <= 0) {
        // 玩家失败，恢复生命
        this.state.stats.currentHp = this.state.stats.hp;

        return {
          victory: false,
          damageDealt: totalDamageDealt,
          damageTaken: totalDamageTaken,
          isCrit: false,
          drops: {},
          duration: (Date.now() - startTime) / 1000,
        };
      }
    }

    // 超过回合数，视为失败，恢复生命
    this.state.stats.currentHp = this.state.stats.hp;
    return {
      victory: false,
      damageDealt: totalDamageDealt,
      damageTaken: totalDamageTaken,
      isCrit: false,
      drops: {},
      duration: (Date.now() - startTime) / 1000,
    };
  }

  /**
   * 计算伤害
   *
   * 公式：actualDmg = attack × skillMultiplier × (1 - reductionRate) × critCoeff
   * 减伤率：def / (def + 1000 + attackerLevel × 50)
   * 暴击伤害：1.5 + critDamage
   */
  calculateDamage(
    attack: number,
    critRate: number,
    critDamage: number,
    penetration: number,
    defenderDefense: number,
    attackerLevel: number,
    skillMultiplier = 1.0,
  ): { damage: number; isCrit: boolean } {
    // 穿透
    const effectiveDefense = defenderDefense * (1 - Math.min(penetration, 0.75));

    // 减伤率
    const reductionRate = effectiveDefense / (effectiveDefense + 1000 + attackerLevel * 50);

    // 暴击判定（软上限30%、硬上限80%）
    const effectiveCritRate = Math.min(Math.max(critRate, 0), 0.8);
    const isCrit = Math.random() < effectiveCritRate;
    const critMultiplier = isCrit ? (1.5 + critDamage) : 1.0;

    // 基础伤害
    let damage = attack * skillMultiplier * (1 - reductionRate) * critMultiplier;

    // 最低保底
    damage = Math.max(attack * 0.01, damage);

    return { damage: Math.floor(damage), isCrit };
  }

  /**
   * 获取星球怪物列表
   */
  private getMonstersForPlanet(planetId: PlanetId): MonsterTemplate[] {
    return Object.values(this.monsterTemplates)
      .filter(m => m.planet === planetId && m.type === 'normal');
  }

  /**
   * 掉落判定
   */
  private rollDrops(drops: Record<string, { min: number; max: number; chance?: number }>): Record<string, number> {
    const result: Record<string, number> = {};

    for (const [itemId, drop] of Object.entries(drops)) {
      const chance = drop.chance ?? 1.0;
      if (Math.random() < chance) {
        const amount = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
        result[itemId] = amount;
      }
    }

    return result;
  }

  /**
   * 处理掉落物
   */
  private processDrops(drops: Record<string, number>): void {
    for (const [itemId, amount] of Object.entries(drops)) {
      if (itemId === 'starCoins') {
        this.state.currency.starCoins += amount;
        this.state.stats_log.totalStarCoinsEarned += amount;
      } else if (itemId === 'spiritStones') {
        this.state.currency.spiritStones += amount;
        this.state.stats_log.totalSpiritStonesEarned += amount;
      } else {
        // 添加到背包
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
  }

  /**
   * 挑战Boss
   */
  challengeBoss(bossId: string): CombatResult | null {
    const boss = this.bossTemplates[bossId];
    if (!boss) return null;

    // 检查解锁条件
    if (boss.unlockCondition && this.state.realm.level < boss.unlockCondition.level) {
      return null;
    }

    // 检查刷新时间
    const lastKilled = this.state.combat.bossTimers[bossId] ?? 0;
    const now = Date.now();
    if (now < lastKilled) {
      return null; // 还在冷却中
    }

    // 执行Boss战
    const result = this.executeCombat(boss);

    if (result.victory) {
      // 处理掉落
      this.processDrops(result.drops);

      // 设置刷新时间
      const refreshInterval = (boss.refreshInterval ?? 180) * 1000;
      this.state.combat.bossTimers[bossId] = now + refreshInterval;

      // 更新统计
      this.state.combat.bossKillCounts[bossId] =
        (this.state.combat.bossKillCounts[bossId] ?? 0) + 1;

      this.events.emit('combat:victory', {
        targetId: bossId,
        drops: result.drops,
        isBoss: true,
      });
    } else {
      this.events.emit('combat:defeat', {
        targetId: bossId,
        isBoss: true,
      });
    }

    return result;
  }

  /**
   * 获取Boss状态
   */
  getBossStatus(bossId: string): {
    available: boolean;
    cooldownRemaining: number;
    killCount: number;
  } {
    const lastKilled = this.state.combat.bossTimers[bossId] ?? 0;
    const now = Date.now();
    const cooldownRemaining = Math.max(0, lastKilled - now);

    return {
      available: now >= lastKilled,
      cooldownRemaining: cooldownRemaining / 1000,
      killCount: this.state.combat.bossKillCounts[bossId] ?? 0,
    };
  }

  /**
   * 获取当前战斗实例
   */
  getCurrentCombat(): CombatInstance | null {
    return this.currentCombat;
  }

  /**
   * 添加战斗日志
   */
  addLog(message: string): void {
    this.combatLog.unshift(message);
    if (this.combatLog.length > 50) {
      this.combatLog.pop();
    }
  }

  beforeSave(): void {}
  afterLoad(): void {}
  reset(): void {
    this.currentCombat = null;
    this.combatLog = [];
  }
}

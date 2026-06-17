<script setup lang="ts">
/**
 * 战斗 UI 面板
 *
 * 显示玩家/怪物血条、战斗日志、自动战斗开关、Boss挑战入口。
 * 设计参考：06-战斗与Boss系统.md
 */
import { computed, ref } from 'vue';
import type { PlayerState } from '../core/GameState';
import type { CombatSystem, CombatResult } from '../systems/CombatSystem';
import { displayValue } from '../utils/ScientificNumber';

const props = defineProps<{
  state: PlayerState;
  combatSystem: CombatSystem;
  /** Boss模板配置（从monster-templates.json传入） */
  bossTemplates?: Record<string, { id: string; name: string; planet: string; unlockCondition?: { level: number } }>;
}>();

defineEmits<{
  challengeBoss: [bossId: string];
}>();

const lastResult = ref<CombatResult | null>(null);

const autoCombat = computed(() => props.combatSystem.autoCombatEnabled);

const playerHpPct = computed(() => {
  const { currentHp, hp } = props.state.stats;
  if (hp <= 0) return 0;
  return Math.max(0, Math.min(100, (currentHp / hp) * 100));
});

const combatLog = computed(() => props.combatSystem.combatLog.slice(0, 20));

function toggleAutoCombat() {
  props.combatSystem.autoCombatEnabled = !props.combatSystem.autoCombatEnabled;
}

function handleChallengeBoss(bossId: string) {
  const result = props.combatSystem.challengeBoss(bossId);
  if (result) {
    lastResult.value = result;
  }
}

const bossList = computed(() => {
  const planetId = props.state.combat.currentPlanet;
  const bosses: { id: string; name: string; available: boolean; cooldown: number; kills: number }[] = [];

  // 从配置中获取当前星球的Boss
  if (props.bossTemplates) {
    for (const [bossId, boss] of Object.entries(props.bossTemplates)) {
      if (boss.planet !== planetId) continue;

      // 检查解锁条件
      if (boss.unlockCondition && props.state.realm.level < boss.unlockCondition.level) continue;

      const status = props.combatSystem.getBossStatus(bossId);
      bosses.push({
        id: bossId,
        name: boss.name,
        available: status.available,
        cooldown: status.cooldownRemaining,
        kills: status.killCount,
      });
    }
  }

  return bosses;
});
</script>

<template>
  <div class="combat-panel">
    <!-- 玩家状态 -->
    <div class="player-status">
      <div class="hp-bar">
        <div class="hp-label">
          <span>生命</span>
          <span>{{ displayValue(state.stats.currentHp) }} / {{ displayValue(state.stats.hp) }}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill hp-fill" :style="{ width: playerHpPct + '%' }"></div>
        </div>
      </div>
    </div>

    <!-- 自动战斗开关 -->
    <div class="auto-combat">
      <label>
        <input type="checkbox" :checked="autoCombat" @change="toggleAutoCombat" />
        自动战斗
      </label>
    </div>

    <!-- Boss挑战 -->
    <div class="boss-section" v-if="bossList.length > 0">
      <h3>Boss挑战</h3>
      <div class="boss-list">
        <div
          v-for="boss in bossList"
          :key="boss.id"
          class="boss-item"
        >
          <div class="boss-info">
            <span class="boss-name">{{ boss.name }}</span>
            <span class="boss-kills">击杀: {{ boss.kills }}</span>
          </div>
          <button
            class="btn btn-boss"
            :disabled="!boss.available"
            @click="handleChallengeBoss(boss.id)"
          >
            {{ boss.available ? '挑战' : `${Math.ceil(boss.cooldown)}秒` }}
          </button>
        </div>
      </div>
    </div>

    <!-- 战斗结果 -->
    <div v-if="lastResult" class="combat-result" :class="lastResult.victory ? 'victory' : 'defeat'">
      <h3>{{ lastResult.victory ? '胜利！' : '失败...' }}</h3>
      <div class="result-details">
        <span>造成伤害: {{ displayValue(lastResult.damageDealt) }}</span>
        <span>承受伤害: {{ displayValue(lastResult.damageTaken) }}</span>
        <span>耗时: {{ lastResult.duration.toFixed(1) }}秒</span>
      </div>
      <div v-if="Object.keys(lastResult.drops).length > 0" class="result-drops">
        <span>获得: </span>
        <span v-for="(amount, itemId) in lastResult.drops" :key="itemId">
          {{ itemId }}×{{ amount }}
        </span>
      </div>
    </div>

    <!-- 战斗日志 -->
    <div class="combat-log">
      <h3>战斗日志</h3>
      <div class="log-list">
        <div v-for="(msg, idx) in combatLog" :key="idx" class="log-entry">
          {{ msg }}
        </div>
        <div v-if="combatLog.length === 0" class="empty-state">
          暂无战斗记录
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.combat-panel {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.player-status {
  margin-bottom: 16px;
}

.hp-label {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #e0e0e0;
  margin-bottom: 6px;
}

.bar-track {
  height: 16px;
  background: #2a2a4a;
  border-radius: 8px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 8px;
  transition: width 0.2s;
}

.hp-fill {
  background: linear-gradient(90deg, #ff6b6b, #ff4444);
}

.auto-combat {
  margin-bottom: 16px;
  font-size: 14px;
  color: #e0e0e0;
}

.auto-combat input {
  margin-right: 6px;
}

.boss-section h3,
.combat-log h3 {
  font-size: 16px;
  color: #e0e0e0;
  margin-bottom: 10px;
}

.boss-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.boss-item {
  background: #1e2a4a;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.boss-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.boss-name {
  font-size: 16px;
  color: #ff9800;
  font-weight: bold;
}

.boss-kills {
  font-size: 12px;
  color: #8892b0;
}

.btn-boss {
  padding: 8px 20px;
  background: #4a2a2a;
  border: 1px solid #ff6b6b;
  border-radius: 6px;
  color: #ff6b6b;
  cursor: pointer;
  font-size: 14px;
}

.btn-boss:hover:not(:disabled) {
  background: #5a3a3a;
}

.btn-boss:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.combat-result {
  padding: 14px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.combat-result.victory {
  background: #1a3a2a;
  border: 1px solid #6bcb77;
}

.combat-result.defeat {
  background: #3a1a1a;
  border: 1px solid #ff6b6b;
}

.combat-result h3 {
  font-size: 18px;
  margin-bottom: 8px;
}

.combat-result.victory h3 {
  color: #6bcb77;
}

.combat-result.defeat h3 {
  color: #ff6b6b;
}

.result-details {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 14px;
  color: #e0e0e0;
  margin-bottom: 6px;
}

.result-drops {
  font-size: 14px;
  color: #ffd93d;
}

.log-list {
  max-height: 200px;
  overflow-y: auto;
}

.log-entry {
  font-size: 13px;
  color: #8892b0;
  padding: 4px 0;
  border-bottom: 1px solid #2a2a4a;
}

.empty-state {
  text-align: center;
  padding: 16px;
  color: #4a4a6a;
}
</style>

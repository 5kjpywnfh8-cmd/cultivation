<script setup lang="ts">
/**
 * 强化 UI 面板
 *
 * 选择装备 → 显示当前强化等级/属性/成功率/消耗 → 强化按钮
 * 设计参考：04-装备系统.md
 */
import { computed } from 'vue';
import type { PlayerState } from '../core/GameState';
import type { EnhanceSystem } from '../systems/EnhanceSystem';
import type { EquipmentSystem } from '../systems/EquipmentSystem';
import { formatNumber } from '../utils/formatters';

const AFFIX_LABELS: Record<string, string> = {
  atkPct: '攻击', defPct: '防御', hpPct: '生命',
  critRate: '暴击率', critDmg: '暴击伤害', penetration: '穿透',
  dodge: '闪避', starYuanGain: '星元获取', gatherSpeed: '采集速度',
  prodSpeed: '生产速度', dropRate: '掉率', cdReduction: '冷却缩减',
  skillDmg: '技能伤害', lifeSteal: '吸血', dmgReduction: '减伤',
  allStats: '全属性', berserkerRage: '狂战士之怒', ironWall: '铁壁守护',
  lifeDrain: '生命汲取', critMaster: '暴击大师', gatherMaster: '采集达人',
  prodMaster: '生产大师', luckyStar: '幸运之星', endlessPower: '无尽之力',
};

const props = defineProps<{
  state: PlayerState;
  enhanceSystem: EnhanceSystem;
  equipmentSystem: EquipmentSystem;
}>();

const emit = defineEmits<{
  enhance: [equipmentId: string];
}>();

const maxLevel = computed(() => props.enhanceSystem.getMaxEnhanceLevel());

/** 可强化的装备列表（已穿戴的） */
const enhanceableEquipments = computed(() => {
  const result: {
    id: string;
    name: string;
    level: number;
    successRate: number;
    cost: { stones: number; starCoins: number };
    failurePenalty: number;
    canEnhance: boolean;
    isMax: boolean;
    attack: number;
    defense: number;
    hp: number;
    affixes: { type: string; value: number; isNegative: boolean }[];
  }[] = [];

  for (const eqId of Object.values(props.state.equippedGear)) {
    if (!eqId) continue;
    const eq = props.state.allEquipment[eqId];
    if (!eq) continue;

    const info = props.enhanceSystem.getEnhanceInfo(eq.id);
    const stats = props.equipmentSystem.getEquipmentStats(eq.id);
    const isMax = eq.enhanceLevel >= maxLevel.value;

    result.push({
      id: eq.id,
      name: eq.name,
      level: eq.enhanceLevel,
      successRate: info?.successRate ?? 0,
      cost: info?.cost ?? { stones: 0, starCoins: 0 },
      failurePenalty: info?.failurePenalty ?? 0,
      canEnhance: info?.canEnhance ?? false,
      isMax,
      attack: stats?.attack ?? 0,
      defense: stats?.defense ?? 0,
      hp: stats?.hp ?? 0,
      affixes: eq.affixes ?? [],
    });
  }
  return result;
});

function handleEnhance(equipmentId: string) {
  emit('enhance', equipmentId);
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + '%';
}

function formatAffix(affix: { type: string; value: number; isNegative: boolean }): string {
  const label = AFFIX_LABELS[affix.type] ?? affix.type;
  const pct = Math.round(affix.value * 100);
  return `${label} ${affix.isNegative ? '-' : '+'}${pct}%`;
}
</script>

<template>
  <div class="enhance-panel">
    <h3>装备强化</h3>

    <div class="enhance-list">
      <div
        v-for="eq in enhanceableEquipments"
        :key="eq.id"
        class="enhance-item"
      >
        <div class="equip-info">
          <span class="equip-name">{{ eq.name }}<span v-if="eq.level > 0" class="equip-enhance">+{{ eq.level }}</span></span>
          <span class="equip-level" :class="{ max: eq.isMax }">
            {{ eq.isMax ? '已满级' : '+' + eq.level }}
          </span>
        </div>

        <div class="equip-stats">
          <span v-if="eq.attack > 0" class="stat">攻+{{ eq.attack }}</span>
          <span v-if="eq.defense > 0" class="stat">防+{{ eq.defense }}</span>
          <span v-if="eq.hp > 0" class="stat">命+{{ eq.hp }}</span>
        </div>

        <div v-if="eq.affixes.length > 0" class="equip-affixes">
          <span v-for="(affix, idx) in eq.affixes" :key="idx" class="affix-tag" :class="{ negative: affix.isNegative }">
            {{ formatAffix(affix) }}
          </span>
        </div>

        <div class="enhance-details">
          <span class="detail">成功率: {{ formatPercent(eq.successRate) }}</span>
          <span class="detail">消耗: {{ eq.cost.stones }}强化石 + {{ formatNumber(eq.cost.starCoins) }}星币</span>
          <span v-if="eq.failurePenalty > 0" class="detail warning">
            失败降{{ eq.failurePenalty }}级
          </span>
        </div>

        <button
          class="btn btn-enhance"
          :disabled="!eq.canEnhance || eq.isMax"
          @click="handleEnhance(eq.id)"
        >
          {{ eq.isMax ? '已满级' : '强化' }}
        </button>
      </div>

      <div v-if="enhanceableEquipments.length === 0" class="empty-state">
        请先穿戴装备
      </div>
    </div>
  </div>
</template>

<style scoped>
.enhance-panel {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.enhance-panel h3 {
  font-size: 18px;
  color: #e0e0e0;
  margin-bottom: 16px;
}

.enhance-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.enhance-item {
  background: #1e2a4a;
  padding: 14px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.equip-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 120px;
}

.equip-name {
  font-size: 16px;
  color: #e0e0e0;
}

.equip-level {
  font-size: 16px;
  color: #64ffda;
  font-weight: bold;
}

.equip-level.max {
  color: #ffd700;
}

.enhance-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.detail {
  font-size: 13px;
  color: #8892b0;
}

.detail.warning {
  color: #ff6b6b;
}

.equip-enhance {
  color: #64ffda;
  margin-left: 4px;
}

.equip-stats {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #64ffda;
}

.stat {
  background: #1a3a2a;
  padding: 1px 6px;
  border-radius: 3px;
}

.equip-affixes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.affix-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: #1a3a2a;
  color: #6bcb77;
}

.affix-tag.negative {
  background: #3a1a1a;
  color: #ff6b6b;
}

.btn-enhance {
  padding: 8px 20px;
  background: #2a4a3a;
  border: 1px solid #64ffda;
  border-radius: 6px;
  color: #64ffda;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}

.btn-enhance:hover:not(:disabled) {
  background: #3a5a4a;
}

.btn-enhance:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: #8892b0;
}

@media (max-width: 768px) {
  .enhance-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

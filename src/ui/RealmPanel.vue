<script setup lang="ts">
/**
 * 境界 UI 面板
 *
 * 显示当前境界、属性值、星元进度条、突破按钮、预计突破时间。
 * 设计参考：01-游戏核心设计.md
 */
import { computed } from 'vue';
import type { PlayerState } from '../core/GameState';
import type { RealmSystem } from '../systems/RealmSystem';
import { displayValue } from '../utils/ScientificNumber';

const props = defineProps<{
  state: PlayerState;
  realmSystem: RealmSystem;
}>();

const emit = defineEmits<{
  breakthrough: [];
}>();

const realm = computed(() => props.state.realm);
const stats = computed(() => props.state.stats);

/** 星元进度百分比 */
const progressPct = computed(() => {
  const { starYuan, starYuanToNext } = realm.value;
  if (starYuanToNext <= 0) return 100;
  return Math.min(100, (starYuan / starYuanToNext) * 100);
});

/** 是否可突破 */
const canBreakthrough = computed(() => {
  return realm.value.starYuan >= realm.value.starYuanToNext;
});

/** 星元获取速率 */
const starYuanRate = computed(() => {
  return props.realmSystem.getStarYuanRate();
});

/** 预计突破时间（秒） */
const etaSeconds = computed(() => {
  if (canBreakthrough.value) return 0;
  const needed = realm.value.starYuanToNext - realm.value.starYuan;
  const rate = starYuanRate.value;
  if (rate <= 0) return Infinity;
  return needed / rate;
});

/** 格式化时间 */
function formatTime(seconds: number): string {
  if (seconds === 0) return '可突破';
  if (!isFinite(seconds)) return '∞';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

function handleBreakthrough() {
  emit('breakthrough');
}
</script>

<template>
  <div class="realm-panel">
    <!-- 境界信息 -->
    <div class="realm-header">
      <h2 class="realm-title">{{ realm.realm }}{{ realm.tier }}阶</h2>
      <span class="realm-level">等级 {{ realm.level }}</span>
    </div>

    <!-- 星元进度条 -->
    <div class="star-yuan-section">
      <div class="progress-label">
        <span>星元</span>
        <span>{{ displayValue(realm.starYuan, 1) }} / {{ displayValue(realm.starYuanToNext, 1) }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
      </div>
      <div class="progress-info">
        <span class="rate">+{{ displayValue(starYuanRate, 1) }}/秒</span>
        <span class="eta">{{ formatTime(etaSeconds) }}</span>
      </div>
    </div>

    <!-- 属性面板 -->
    <div class="stats-section">
      <h3>属性</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">攻击</span>
          <span class="stat-value">{{ displayValue(stats.attack) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">防御</span>
          <span class="stat-value">{{ displayValue(stats.defense) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">生命</span>
          <span class="stat-value">{{ displayValue(stats.hp) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">暴击率</span>
          <span class="stat-value">{{ (stats.critRate * 100).toFixed(1) }}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">暴击伤害</span>
          <span class="stat-value">{{ (stats.critDamage * 100).toFixed(1) }}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">穿透</span>
          <span class="stat-value">{{ (stats.penetration * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <!-- 突破按钮 -->
    <div class="action-section">
      <button
        class="btn btn-breakthrough"
        :class="{ 'btn-ready': canBreakthrough }"
        :disabled="!canBreakthrough"
        @click="handleBreakthrough"
      >
        {{ canBreakthrough ? '突破' : '星元不足' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.realm-panel {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.realm-header {
  text-align: center;
  margin-bottom: 24px;
}

.realm-title {
  font-size: 24px;
  color: #64ffda;
  margin-bottom: 4px;
}

.realm-level {
  font-size: 14px;
  color: #8892b0;
}

.star-yuan-section {
  margin-bottom: 24px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #e0e0e0;
  margin-bottom: 8px;
}

.progress-bar {
  height: 20px;
  background: #2a2a4a;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #64ffda, #48c9b0);
  border-radius: 10px;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8892b0;
  margin-top: 4px;
}

.stats-section h3 {
  font-size: 16px;
  color: #e0e0e0;
  margin-bottom: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-item {
  background: #1e2a4a;
  padding: 10px;
  border-radius: 6px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #8892b0;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 16px;
  color: #e0e0e0;
  font-weight: bold;
}

.action-section {
  text-align: center;
  margin-top: 24px;
}

.btn-breakthrough {
  padding: 12px 48px;
  font-size: 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: #2a2a4a;
  color: #8892b0;
  transition: all 0.2s;
}

.btn-breakthrough.btn-ready {
  background: #64ffda;
  color: #1a1a2e;
  font-weight: bold;
  box-shadow: 0 0 20px rgba(100, 255, 218, 0.3);
}

.btn-breakthrough.btn-ready:hover {
  transform: scale(1.05);
}

.btn-breakthrough:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* 手机端 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

<script setup lang="ts">
/**
 * 星球 UI 面板
 *
 * 显示当前星球资源列表、储量百分比、采集按钮、自动采集状态、切换星球入口。
 * 设计参考：02-星球与资源系统.md
 */
import { computed } from 'vue';
import type { PlayerState, PlanetId } from '../core/GameState';
import type { PlanetSystem } from '../systems/PlanetSystem';
import type { ResourceSystem } from '../systems/ResourceSystem';
import { displayValue } from '../utils/ScientificNumber';

const props = defineProps<{
  state: PlayerState;
  planetSystem: PlanetSystem;
  resourceSystem: ResourceSystem;
}>();

const emit = defineEmits<{
  gather: [resourceId: string];
  switchPlanet: [planetId: PlanetId];
  toggleAutoCollect: [];
}>();

const currentPlanetId = computed(() => props.planetSystem.getCurrentPlanet());
const currentPlanet = computed(() => props.state.planets[currentPlanetId.value]);

const resources = computed(() =>
  props.resourceSystem.getPlanetResources(currentPlanetId.value)
);

const unlockedPlanets = computed(() =>
  props.planetSystem.getUnlockedPlanets()
);

const weatherLabel = computed(() => {
  const w = currentPlanet.value.currentWeather;
  switch (w) {
    case 'rain': return '🌧 小雨（采集+20%）';
    case 'thunderstorm': return '⛈ 雷暴（采集+50%）';
    case 'spatialRift': return '🌀 空间裂缝（采集+100%）';
    default: return '☀ 晴朗';
  }
});

const weatherClass = computed(() => {
  const w = currentPlanet.value.currentWeather;
  if (w === 'normal') return '';
  return 'weather-active';
});

function handleGather(resourceId: string) {
  emit('gather', resourceId);
}

function handleSwitchPlanet(planetId: PlanetId) {
  emit('switchPlanet', planetId);
}

function handleToggleAutoCollect() {
  emit('toggleAutoCollect');
}

function getPlanetName(planetId: PlanetId): string {
  return props.state.planets[planetId]?.name ?? planetId;
}
</script>

<template>
  <div class="planet-panel">
    <!-- 星球选择 -->
    <div class="planet-selector">
      <button
        v-for="pid in unlockedPlanets"
        :key="pid"
        class="planet-tab"
        :class="{ active: pid === currentPlanetId }"
        @click="handleSwitchPlanet(pid)"
      >
        {{ getPlanetName(pid) }}
      </button>
    </div>

    <!-- 星球信息 -->
    <div class="planet-info">
      <h2>{{ currentPlanet.name }}</h2>
      <div class="weather" :class="weatherClass">{{ weatherLabel }}</div>
      <div class="auto-collect">
        <label>
          <input
            type="checkbox"
            :checked="currentPlanet.autoCollect"
            @change="handleToggleAutoCollect"
          />
          自动采集
        </label>
      </div>
    </div>

    <!-- 资源列表 -->
    <div class="resource-list">
      <div
        v-for="res in resources"
        :key="res.id"
        class="resource-item"
      >
        <div class="resource-header">
          <span class="resource-name">{{ res.name }}</span>
          <span class="resource-type" :class="res.type">
            {{ res.type === 'basic' ? '基础' : '稀有' }}
          </span>
        </div>

        <!-- 储量条 -->
        <div class="reserve-bar">
          <div
            class="reserve-fill"
            :style="{ width: res.reservePct + '%' }"
            :class="{ depleted: res.reservePct <= 0 }"
          ></div>
        </div>
        <div class="reserve-info">
          <span>{{ displayValue(res.reserve) }} / {{ displayValue(res.maxReserve) }}</span>
          <span>{{ res.reservePct.toFixed(1) }}%</span>
        </div>

        <!-- 采集按钮 -->
        <div class="resource-actions">
          <button
            class="btn btn-gather"
            :disabled="res.reserve <= 0"
            @click="handleGather(res.id)"
          >
            采集 ({{ displayValue(res.gatherRate) }}/次)
          </button>
          <span class="auto-rate" v-if="currentPlanet.autoCollect">
            自动 {{ displayValue(res.autoRate) }}/秒
          </span>
        </div>
      </div>

      <div v-if="resources.length === 0" class="empty-state">
        该星球暂无可采集资源
      </div>
    </div>
  </div>
</template>

<style scoped>
.planet-panel {
  padding: 16px;
  max-width: 700px;
  margin: 0 auto;
}

.planet-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.planet-tab {
  padding: 8px 16px;
  background: #1e2a4a;
  border: 1px solid #2a2a4a;
  border-radius: 6px;
  color: #8892b0;
  cursor: pointer;
  white-space: nowrap;
  font-size: 14px;
}

.planet-tab.active {
  background: #64ffda;
  color: #1a1a2e;
  font-weight: bold;
}

.planet-info {
  margin-bottom: 16px;
}

.planet-info h2 {
  font-size: 20px;
  color: #e0e0e0;
  margin-bottom: 8px;
}

.weather {
  font-size: 14px;
  color: #8892b0;
  margin-bottom: 8px;
}

.weather-active {
  color: #ffd93d;
}

.auto-collect {
  font-size: 14px;
  color: #e0e0e0;
}

.auto-collect input {
  margin-right: 6px;
}

.resource-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.resource-item {
  background: #1e2a4a;
  padding: 14px;
  border-radius: 8px;
}

.resource-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.resource-name {
  font-size: 16px;
  color: #e0e0e0;
  font-weight: bold;
}

.resource-type {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.resource-type.basic {
  background: #2a4a3a;
  color: #6bcb77;
}

.resource-type.rare {
  background: #4a2a4a;
  color: #c084fc;
}

.reserve-bar {
  height: 8px;
  background: #2a2a4a;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.reserve-fill {
  height: 100%;
  background: #64ffda;
  border-radius: 4px;
  transition: width 0.2s;
}

.reserve-fill.depleted {
  background: #ff6b6b;
}

.reserve-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8892b0;
  margin-bottom: 8px;
}

.resource-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-gather {
  padding: 6px 16px;
  background: #2a4a3a;
  border: 1px solid #64ffda;
  border-radius: 4px;
  color: #64ffda;
  cursor: pointer;
  font-size: 14px;
}

.btn-gather:hover:not(:disabled) {
  background: #3a5a4a;
}

.btn-gather:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.auto-rate {
  font-size: 12px;
  color: #8892b0;
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: #8892b0;
}

@media (max-width: 768px) {
  .planet-selector {
    flex-wrap: nowrap;
  }
}
</style>

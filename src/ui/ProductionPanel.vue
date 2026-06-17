<script setup lang="ts">
/**
 * 生产 UI 面板
 *
 * 设备列表、配方选择、生产队列、进度条、一键收取、设备升级入口。
 * 设计参考：03-生产链系统.md
 */
import { computed, ref } from 'vue';
import type { PlayerState, DeviceType } from '../core/GameState';
import type { ProductionSystem } from '../systems/ProductionSystem';
import { getItemName } from '../utils/names';

const props = defineProps<{
  state: PlayerState;
  productionSystem: ProductionSystem;
}>();

const emit = defineEmits<{
  produce: [recipeId: string];
  collect: [deviceType: DeviceType];
  upgrade: [deviceType: DeviceType];
}>();

const selectedDevice = ref<DeviceType>('smelter');

const devices = computed(() => {
  const result: { type: DeviceType; name: string; level: number; unlocked: boolean; queueCount: number }[] = [];
  for (const type of Object.keys(props.state.devices) as DeviceType[]) {
    const info = props.productionSystem.getDeviceInfo(type);
    if (info) {
      result.push({ type, ...info });
    }
  }
  return result;
});

const currentDevice = computed(() => {
  return props.productionSystem.getDeviceInfo(selectedDevice.value);
});

const availableRecipes = computed(() => {
  return props.productionSystem.getAvailableRecipes(selectedDevice.value);
});

const currentQueue = computed(() => {
  const device = props.state.devices[selectedDevice.value];
  return device?.queue ?? [];
});

function handleProduce(recipeId: string) {
  emit('produce', recipeId);
}

function handleCollect() {
  emit('collect', selectedDevice.value);
}

function handleUpgrade() {
  emit('upgrade', selectedDevice.value);
}

function getProgress(job: { startedAt: number; finishAt: number }): number {
  const now = Date.now();
  const total = job.finishAt - job.startedAt;
  const elapsed = now - job.startedAt;
  return Math.min(100, (elapsed / total) * 100);
}

function getTimeRemaining(job: { finishAt: number }): string {
  const remaining = Math.max(0, job.finishAt - Date.now()) / 1000;
  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
</script>

<template>
  <div class="production-panel">
    <!-- 设备选择 -->
    <div class="device-tabs">
      <button
        v-for="device in devices"
        :key="device.type"
        class="device-tab"
        :class="{ active: selectedDevice === device.type, locked: !device.unlocked }"
        :disabled="!device.unlocked"
        @click="selectedDevice = device.type"
      >
        {{ device.name }}
        <span v-if="device.unlocked" class="device-level">Lv.{{ device.level }}</span>
        <span v-else class="device-locked">🔒</span>
      </button>
    </div>

    <!-- 设备信息 -->
    <div v-if="currentDevice" class="device-info">
      <div class="device-header">
        <h3>{{ currentDevice.name }}</h3>
        <span class="device-level-badge">Lv.{{ currentDevice.level }}/{{ currentDevice.maxLevel }}</span>
      </div>
      <div class="device-stats">
        <span>队列: {{ currentDevice.queueCount }}/{{ currentDevice.queueCapacity }}</span>
      </div>
      <button
        v-if="currentDevice.level < currentDevice.maxLevel"
        class="btn btn-upgrade"
        @click="handleUpgrade"
      >
        升级 ({{ 1000 * Math.pow(2, currentDevice.level) }} 星币)
      </button>
    </div>

    <!-- 配方列表 -->
    <div class="recipe-section">
      <h4>可生产配方</h4>
      <div class="recipe-list">
        <div
          v-for="recipe in availableRecipes"
          :key="recipe.id"
          class="recipe-item"
        >
          <div class="recipe-info">
            <span class="recipe-name">{{ recipe.name }}</span>
            <span class="recipe-time">{{ recipe.baseTime }}秒</span>
          </div>
          <div class="recipe-inputs">
            <span v-for="(amount, matId) in recipe.inputs" :key="matId" class="recipe-input">
              {{ getItemName(matId) }}: {{ state.inventory.items[matId]?.quantity ?? 0 }}/{{ amount }}
            </span>
          </div>
          <button
            class="btn btn-produce"
            @click="handleProduce(recipe.id)"
          >
            生产
          </button>
        </div>
      </div>
    </div>

    <!-- 生产队列 -->
    <div class="queue-section">
      <div class="queue-header">
        <h4>生产队列</h4>
        <button
          v-if="currentQueue.length > 0"
          class="btn btn-collect"
          @click="handleCollect"
        >
          一键收取
        </button>
      </div>
      <div class="queue-list">
        <div
          v-for="(job, idx) in currentQueue"
          :key="idx"
          class="queue-item"
        >
          <span class="queue-name">{{ job.outputName }} ×{{ job.quantity }}</span>
          <div class="queue-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: getProgress(job) + '%' }"></div>
            </div>
            <span class="queue-time">{{ getTimeRemaining(job) }}</span>
          </div>
        </div>
        <div v-if="currentQueue.length === 0" class="empty-state">
          队列为空
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.production-panel {
  padding: 16px;
  max-width: 700px;
  margin: 0 auto;
}

.device-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
}

.device-tab {
  padding: 8px 12px;
  background: #1e2a4a;
  border: 1px solid #2a2a4a;
  border-radius: 6px;
  color: #8892b0;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.device-tab.active {
  background: #64ffda;
  color: #1a1a2e;
  font-weight: bold;
}

.device-tab.locked {
  opacity: 0.5;
  cursor: not-allowed;
}

.device-level {
  font-size: 12px;
}

.device-locked {
  font-size: 14px;
}

.device-info {
  background: #1e2a4a;
  padding: 14px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.device-header h3 {
  color: #e0e0e0;
}

.device-level-badge {
  font-size: 14px;
  color: #64ffda;
}

.device-stats {
  font-size: 14px;
  color: #8892b0;
  margin-bottom: 8px;
}

.btn-upgrade {
  padding: 6px 16px;
  background: #4a3a2a;
  border: 1px solid #ffd93d;
  border-radius: 4px;
  color: #ffd93d;
  cursor: pointer;
}

.recipe-section h4,
.queue-section h4 {
  color: #e0e0e0;
  margin-bottom: 10px;
}

.recipe-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.recipe-item {
  background: #1e2a4a;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.recipe-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 100px;
}

.recipe-name {
  font-size: 16px;
  color: #e0e0e0;
}

.recipe-time {
  font-size: 12px;
  color: #8892b0;
}

.recipe-inputs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.recipe-input {
  font-size: 12px;
  color: #8892b0;
  background: #2a2a4a;
  padding: 2px 8px;
  border-radius: 4px;
}

.btn-produce {
  padding: 6px 16px;
  background: #2a4a3a;
  border: 1px solid #64ffda;
  border-radius: 4px;
  color: #64ffda;
  cursor: pointer;
  white-space: nowrap;
}

.btn-produce:hover {
  background: #3a5a4a;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.btn-collect {
  padding: 6px 16px;
  background: #64ffda;
  border: none;
  border-radius: 4px;
  color: #1a1a2e;
  cursor: pointer;
  font-weight: bold;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queue-item {
  background: #1e2a4a;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.queue-name {
  font-size: 14px;
  color: #e0e0e0;
  min-width: 120px;
}

.queue-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #2a2a4a;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #64ffda;
  border-radius: 4px;
  transition: width 0.5s;
}

.queue-time {
  font-size: 12px;
  color: #8892b0;
  min-width: 40px;
  text-align: right;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: #4a4a6a;
}

@media (max-width: 768px) {
  .recipe-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .queue-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

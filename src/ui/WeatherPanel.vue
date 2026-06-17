<script setup lang="ts">
/**
 * 天气 UI 面板
 *
 * 显示当前星球天气状态、倒计时、特殊天气提示。
 * 设计参考：02-星球与资源系统.md
 */
import { computed } from 'vue';
import type { PlayerState, PlanetId } from '../core/GameState';
import type { WeatherSystem } from '../systems/WeatherSystem';

const props = defineProps<{
  state: PlayerState;
  weatherSystem: WeatherSystem;
  currentPlanet: PlanetId;
}>();

const currentWeather = computed(() => {
  return props.weatherSystem.getCurrentWeather(props.currentPlanet);
});

const weatherConfig = computed(() => {
  return props.weatherSystem.getWeatherConfig(currentWeather.value);
});

const weatherRemaining = computed(() => {
  return props.state.weather.weatherRemaining[props.currentPlanet] ?? 0;
});

const isSpecialWeather = computed(() => {
  return currentWeather.value !== 'normal';
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
</script>

<template>
  <div class="weather-panel" :class="{ special: isSpecialWeather }">
    <div class="weather-icon">{{ weatherConfig?.icon ?? '☀' }}</div>
    <div class="weather-info">
      <span class="weather-name">{{ weatherConfig?.name ?? '晴朗' }}</span>
      <span v-if="isSpecialWeather" class="weather-remaining">
        {{ formatTime(weatherRemaining) }}
      </span>
    </div>
    <div v-if="isSpecialWeather" class="weather-bonus">
      采集 +{{ Math.round(((weatherConfig?.gatherMultiplier ?? 1) - 1) * 100) }}%
    </div>
  </div>
</template>

<style scoped>
.weather-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #1e2a4a;
  border-radius: 6px;
  border: 1px solid #2a2a4a;
}

.weather-panel.special {
  border-color: #ffd93d;
  background: #2a2a1a;
}

.weather-icon {
  font-size: 20px;
}

.weather-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.weather-name {
  font-size: 14px;
  color: #e0e0e0;
}

.weather-remaining {
  font-size: 12px;
  color: #ffd93d;
}

.weather-bonus {
  font-size: 12px;
  color: #64ffda;
  margin-left: auto;
}
</style>

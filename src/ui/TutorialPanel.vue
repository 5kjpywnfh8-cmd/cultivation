<script setup lang="ts">
/**
 * 新手引导 UI 面板
 *
 * 显示当前引导步骤、进度、高亮提示。
 * 设计参考：08-主线任务系统.md 第零章
 */
import { computed } from 'vue';
import type { TutorialSystem } from '../systems/TutorialSystem';

const props = defineProps<{
  tutorialSystem: TutorialSystem;
}>();

const emit = defineEmits<{
  skip: [];
  next: [];
}>();

const currentStep = computed(() => props.tutorialSystem.getCurrentStep());
const progress = computed(() => props.tutorialSystem.getProgress());
const isCompleted = computed(() => props.tutorialSystem.isCompleted());

function handleSkip() {
  emit('skip');
}

function handleNext() {
  emit('next');
}
</script>

<template>
  <div v-if="!isCompleted && currentStep" class="tutorial-panel">
    <div class="tutorial-header">
      <span class="tutorial-title">📖 新手引导</span>
      <button class="btn-skip" @click="handleSkip">跳过</button>
    </div>

    <div class="tutorial-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <span class="progress-text">{{ progress }}%</span>
    </div>

    <div class="tutorial-content">
      <h3 class="step-title">{{ currentStep.title }}</h3>
      <p class="step-description">{{ currentStep.description }}</p>
      <div class="step-action">
        <span class="action-icon">👉</span>
        <span class="action-text">{{ currentStep.action }}</span>
      </div>
    </div>

    <button class="btn-next" @click="handleNext">
      {{ currentStep.id === 7 ? '完成引导' : '下一步' }}
    </button>
  </div>
</template>

<style scoped>
.tutorial-panel {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #1e2a4a;
  border: 2px solid #64ffda;
  border-radius: 12px;
  padding: 16px;
  min-width: 320px;
  max-width: 480px;
  z-index: 1000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.tutorial-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tutorial-title {
  font-size: 16px;
  color: #64ffda;
  font-weight: bold;
}

.btn-skip {
  background: none;
  border: 1px solid #4a4a6a;
  border-radius: 4px;
  padding: 4px 12px;
  color: #8892b0;
  cursor: pointer;
  font-size: 12px;
}

.btn-skip:hover {
  border-color: #ff6b6b;
  color: #ff6b6b;
}

.tutorial-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #2a2a4a;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #64ffda;
  border-radius: 3px;
  transition: width 0.3s;
}

.progress-text {
  font-size: 12px;
  color: #8892b0;
  min-width: 36px;
  text-align: right;
}

.tutorial-content {
  margin-bottom: 12px;
}

.step-title {
  font-size: 18px;
  color: #e0e0e0;
  margin-bottom: 8px;
}

.step-description {
  font-size: 14px;
  color: #8892b0;
  margin-bottom: 8px;
  line-height: 1.5;
}

.step-action {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2a4a3a;
  padding: 8px 12px;
  border-radius: 6px;
}

.action-icon {
  font-size: 16px;
}

.action-text {
  font-size: 14px;
  color: #64ffda;
}

.btn-next {
  width: 100%;
  padding: 10px;
  background: #64ffda;
  border: none;
  border-radius: 6px;
  color: #1a1a2e;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
}

.btn-next:hover {
  background: #48c9b0;
}
</style>

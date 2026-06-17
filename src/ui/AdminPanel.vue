<script setup lang="ts">
/**
 * 管理员面板 UI
 *
 * 快捷键 ~ 或顶栏按钮打开。
 * 提供资源添加、境界跳过、解锁、重置等测试功能。
 */
import { computed, ref } from 'vue';
import type { AdminSystem } from '../systems/AdminSystem';

const props = defineProps<{
  adminSystem: AdminSystem;
}>();

const emit = defineEmits<{
  execute: [commandId: string];
  close: [];
}>();

const selectedCategory = ref('resource');

const CATEGORY_LABELS: Record<string, string> = {
  resource: '💰 资源',
  realm: '👤 境界',
  unlock: '🔓 解锁',
  combat: '⚔ 战斗',
  reset: '🔄 重置',
  debug: '🐛 调试',
};

const categories = computed(() => props.adminSystem.getCommandsByCategory());

const currentCommands = computed(() => {
  return categories.value[selectedCategory.value] ?? [];
});

function handleExecute(commandId: string) {
  emit('execute', commandId);
}

function handleClose() {
  emit('close');
}
</script>

<template>
  <div class="admin-overlay" @click.self="handleClose">
    <div class="admin-panel">
      <div class="admin-header">
        <h2>🛠 管理员模式</h2>
        <button class="btn-close" @click="handleClose">✕</button>
      </div>

      <!-- 分类标签 -->
      <div class="category-tabs">
        <button
          v-for="(label, key) in CATEGORY_LABELS"
          :key="key"
          class="category-tab"
          :class="{ active: selectedCategory === key }"
          @click="selectedCategory = key"
        >
          {{ label }}
        </button>
      </div>

      <!-- 命令列表 -->
      <div class="command-list">
        <div
          v-for="cmd in currentCommands"
          :key="cmd.id"
          class="command-item"
        >
          <div class="command-info">
            <span class="command-name">{{ cmd.name }}</span>
            <span class="command-desc">{{ cmd.description }}</span>
          </div>
          <button
            class="btn btn-execute"
            :class="{ danger: cmd.category === 'reset' }"
            @click="handleExecute(cmd.id)"
          >
            执行
          </button>
        </div>
      </div>

      <div class="admin-footer">
        <span class="admin-hint">按 ` 键关闭</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-panel {
  background: #1a1a2e;
  border: 2px solid #ff6b6b;
  border-radius: 12px;
  width: 500px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #2a2a4a;
}

.admin-header h2 {
  color: #ff6b6b;
  font-size: 18px;
}

.btn-close {
  background: none;
  border: none;
  color: #8892b0;
  font-size: 20px;
  cursor: pointer;
}

.btn-close:hover {
  color: #ff6b6b;
}

.category-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  overflow-x: auto;
  border-bottom: 1px solid #2a2a4a;
}

.category-tab {
  padding: 6px 12px;
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  border-radius: 6px;
  color: #8892b0;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
}

.category-tab.active {
  background: #ff6b6b;
  color: #fff;
  border-color: #ff6b6b;
}

.command-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.command-item {
  background: #1e2a4a;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.command-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.command-name {
  font-size: 14px;
  color: #e0e0e0;
  font-weight: bold;
}

.command-desc {
  font-size: 12px;
  color: #8892b0;
}

.btn-execute {
  padding: 6px 16px;
  background: #2a4a3a;
  border: 1px solid #64ffda;
  border-radius: 4px;
  color: #64ffda;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.btn-execute:hover {
  background: #3a5a4a;
}

.btn-execute.danger {
  background: #4a2a2a;
  border-color: #ff6b6b;
  color: #ff6b6b;
}

.btn-execute.danger:hover {
  background: #5a3a3a;
}

.admin-footer {
  padding: 12px 16px;
  border-top: 1px solid #2a2a4a;
  text-align: center;
}

.admin-hint {
  font-size: 12px;
  color: #4a4a6a;
}
</style>

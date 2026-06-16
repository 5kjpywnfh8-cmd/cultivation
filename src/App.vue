<script setup lang="ts">
/**
 * 星渊仙途 - 根组件
 *
 * 负责整体布局：顶栏、侧边导航、内容区、底栏
 */
</script>

<template>
  <div class="app">
    <header class="topbar">
      <h1 class="game-title">星渊仙途</h1>
    </header>
    <main class="content">
      <p>游戏加载中...</p>
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #e0e0e0;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.topbar {
  height: 48px;
  background: #16213e;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #2a2a4a;
}

.game-title {
  font-size: 18px;
  color: #64ffda;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
</style>

/**
 * 星渊仙途 - 游戏入口
 *
 * 启动流程：
 * 1. 创建 Vue 应用
 * 2. 初始化游戏系统
 * 3. 挂载到 DOM
 */
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')

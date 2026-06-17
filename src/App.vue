<script setup lang="ts">
/**
 * 星渊仙途 - 根组件
 *
 * 负责整体布局：顶栏、侧边导航、内容区、底栏。
 * 集成所有系统，管理游戏状态。
 */
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { createNewPlayerState } from './core/GameState';
import type { PlayerState, DeviceType } from './core/GameState';
import { EventBus } from './core/EventBus';
import { GameLoop } from './core/GameLoop';

// 系统
import { RealmSystem } from './systems/RealmSystem';
import { PlanetSystem } from './systems/PlanetSystem';
import { ResourceSystem } from './systems/ResourceSystem';
import { EquipmentSystem } from './systems/EquipmentSystem';
import { EnhanceSystem } from './systems/EnhanceSystem';
import { CombatSystem } from './systems/CombatSystem';
import { ShopSystem } from './systems/ShopSystem';
import { SaveSystem } from './systems/SaveSystem';
import { TransportSystem } from './systems/TransportSystem';

// UI
import RealmPanel from './ui/RealmPanel.vue';
import PlanetPanel from './ui/PlanetPanel.vue';
import EquipmentPanel from './ui/EquipmentPanel.vue';
import EnhancePanel from './ui/EnhancePanel.vue';
import CombatPanel from './ui/CombatPanel.vue';
import ShopPanel from './ui/ShopPanel.vue';
import TutorialPanel from './ui/TutorialPanel.vue';
import AdminPanel from './ui/AdminPanel.vue';

// 引导系统
import { TutorialSystem } from './systems/TutorialSystem';
// 天气系统
import { WeatherSystem } from './systems/WeatherSystem';
// 生产系统
import { ProductionSystem } from './systems/ProductionSystem';
import ProductionPanel from './ui/ProductionPanel.vue';
// 管理员系统
import { AdminSystem } from './systems/AdminSystem';
// 词条系统
import { AffixSystem } from './systems/AffixSystem';

// 配置
import realmStatsData from './config/realm-stats.json';
import equipmentTemplates from './config/equipment-templates.json';
import planetConfig from './config/planet-config.json';
import monsterTemplates from './config/monster-templates.json';
import shopConfig from './config/shop-config.json';
import enhanceConfig from './config/enhance-config.json';
import type { PlanetConfigData, MonsterTemplatesData, EnhanceConfigData } from './config/types';

// 冻结配置对象，防止意外修改
Object.freeze(realmStatsData);
Object.freeze(equipmentTemplates);
Object.freeze(planetConfig);
Object.freeze(monsterTemplates);
Object.freeze(shopConfig);
Object.freeze(enhanceConfig);

// ==================== 状态初始化 ====================

const state = ref<PlayerState>(createNewPlayerState());
const events = new EventBus();
const gameLoop = new GameLoop();

// ==================== 系统初始化 ====================

const realmSystem = new RealmSystem(state.value, events, realmStatsData.levels);
const planetSystem = new PlanetSystem(state.value, events);
const planetData = planetConfig as unknown as PlanetConfigData;
const monsterData = monsterTemplates as unknown as MonsterTemplatesData;
const enhanceData = enhanceConfig as unknown as EnhanceConfigData;

const resourceSystem = new ResourceSystem(
  state.value, events, planetSystem, realmSystem,
  planetData.planets,
);
const affixSystem = new AffixSystem(state.value, events);
const equipmentSystem = new EquipmentSystem(
  state.value, events,
  equipmentTemplates.templates as Record<string, { id: string; name: string; slot: 'weapon' | 'helmet' | 'armor' | 'gauntlet' | 'boot' | 'talisman'; realm: string; requiredMaterials: Record<string, number>; requiredStarCoins: number }>,
  affixSystem,
);
const enhanceSystem = new EnhanceSystem(state.value, events, enhanceData, affixSystem);
const combatSystem = new CombatSystem(
  state.value, events,
  monsterData.monsters,
  monsterData.bosses,
);
const shopSystem = new ShopSystem(
  state.value, events,
  shopConfig.categories as Record<string, { name: string; items: Record<string, { id: string; name: string; type: 'resource' | 'skill'; giveItems?: Record<string, number>; skillId?: string; price: { starCoins?: number; spiritStones?: number; daoYun?: number }; unlockCondition?: { level: number } }> }>,
);
const saveSystem = new SaveSystem(state.value, events);
const transportSystem = new TransportSystem(state.value, events);
const weatherSystem = new WeatherSystem(state.value, events);
const tutorialSystem = reactive(new TutorialSystem(state.value, events)) as InstanceType<typeof TutorialSystem>;

// 加载生产配方
import recipeConfigData from './config/recipe-config.json';
const productionSystem = new ProductionSystem(
  state.value, events,
  recipeConfigData.recipes as Record<string, { id: string; name: string; device: DeviceType; inputs: Record<string, number>; output: Record<string, number>; baseTime: number; unlockCondition: { level: number } | null }>,
  recipeConfigData.devices as Record<string, { id: string; name: string; unlockCondition: { level: number } | null; maxLevel: number; speedBonusPerLevel: number }>,
);

// ==================== UI 状态 ====================

const currentRoute = ref('realm');
const showAdmin = ref(false);
const toastMessages = ref<{ id: number; text: string; type: string }[]>([]);
let toastId = 0;

// 管理员系统
const adminSystem = new AdminSystem(state.value);

const routes = [
  { id: 'realm', icon: '👤', label: '境界' },
  { id: 'planet', icon: '🌍', label: '星球' },
  { id: 'equipment', icon: '🛡', label: '装备' },
  { id: 'enhance', icon: '🔨', label: '强化' },
  { id: 'production', icon: '🏭', label: '生产' },
  { id: 'combat', icon: '⚔', label: '战斗' },
  { id: 'shop', icon: '🛒', label: '商店' },
];

// ==================== 计算属性 ====================

const realmDisplay = computed(() => {
  const r = state.value.realm;
  return `${r.realm}${r.tier}阶`;
});

// ==================== 事件处理 ====================

function handleBreakthrough() {
  realmSystem.breakthrough();
}

function handleGather(resourceId: string) {
  resourceSystem.manualGather(resourceId);
}

function handleSwitchPlanet(planetId: string) {
  planetSystem.switchPlanet(planetId as 'origin' | 'xuantie' | 'lingzhi' | 'youming' | 'tianjing' | 'huoshan' | 'bingfeng' | 'hundun' | 'fukong' | 'shenyuan');
}

function handleToggleAutoCollect() {
  const planetId = planetSystem.getCurrentPlanet();
  resourceSystem.toggleAutoCollect(planetId);
}

function handleEquip(equipmentId: string) {
  equipmentSystem.equip(equipmentId);
}

function handleUnequip(slot: string) {
  equipmentSystem.unequip(slot as 'weapon' | 'helmet' | 'armor' | 'gauntlet' | 'boot' | 'talisman');
}

function handleDismantle(equipmentId: string) {
  equipmentSystem.dismantle(equipmentId);
}

function handleSellEquipment(equipmentId: string) {
  equipmentSystem.sell(equipmentId);
}

function handleEnhance(equipmentId: string) {
  const result = enhanceSystem.enhance(equipmentId);
  if (result) {
    showToast(result.message, result.success ? 'success' : 'error');
  }
}

function handleChallengeBoss(bossId: string) {
  combatSystem.challengeBoss(bossId);
}

function handleShopBuy(itemId: string, count: number) {
  const success = shopSystem.buy(itemId, count);
  if (success) {
    showToast('购买成功', 'success');
  } else {
    showToast('购买失败', 'error');
  }
}

function handleShopSell(itemId: string, count: number) {
  const success = shopSystem.sell(itemId, count);
  if (success) {
    showToast('出售成功', 'success');
  }
}

function handleCraft(templateId: string) {
  const result = equipmentSystem.craft(templateId);
  if (result) {
    showToast(`打造成功：${result.name}`, 'success');
  } else {
    showToast('打造失败：材料不足', 'error');
  }
}

// ==================== Toast ====================

function showToast(text: string, type = 'info', duration = 2000) {
  const id = ++toastId;
  toastMessages.value.push({ id, text, type });
  setTimeout(() => {
    toastMessages.value = toastMessages.value.filter(t => t.id !== id);
  }, duration);
}

// ==================== 生产系统 ====================

function handleProduce(recipeId: string) {
  const success = productionSystem.startProduction(recipeId);
  if (success) {
    showToast('开始生产', 'success');
  } else {
    showToast('生产失败：材料不足或队列已满', 'error');
  }
}

function handleCollect(deviceType: string) {
  productionSystem.collectProduct(deviceType as DeviceType);
  showToast('已收取产物', 'success');
}

function handleUpgradeDevice(deviceType: string) {
  const success = productionSystem.upgradeDevice(deviceType as DeviceType);
  if (success) {
    showToast('设备升级成功', 'success');
  } else {
    showToast('升级失败：星币不足', 'error');
  }
}

// ==================== 新手引导 ====================

function handleTutorialSkip() {
  tutorialSystem.skip();
  showToast('已跳过新手引导', 'info');
}

function handleTutorialNext() {
  tutorialSystem.completeCurrentStep();
  if (tutorialSystem.isCompleted()) {
    showToast('🎉 引导完成！开始你的修仙之旅吧！', 'success', 3000);
  }
}

// ==================== 管理员模式 ====================

function handleAdminExecute(commandId: string) {
  const result = adminSystem.executeCommand(commandId);
  showToast(result, 'info', 3000);
}

function handleAdminClose() {
  showAdmin.value = false;
}

function toggleAdmin() {
  showAdmin.value = !showAdmin.value;
}

// 快捷键 ~ 切换管理员模式
function handleKeydown(e: KeyboardEvent) {
  if (e.key === '`' || e.key === '~') {
    e.preventDefault();
    toggleAdmin();
  }
}

// ==================== 手动保存 ====================

function handleManualSave() {
  state.value.lastOnlineAt = Date.now();
  const success = saveSystem.save();
  if (success) {
    showToast('手动保存成功', 'success');
  } else {
    showToast('保存失败', 'error');
  }
}

// ==================== 存档导入/导出 ====================

function handleExportSave() {
  const json = saveSystem.exportSave();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `xingyan_save_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('存档已导出', 'success');
}

function handleImportSave() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      const imported = saveSystem.importSave(json);
      if (imported) {
        Object.assign(state.value, imported);
        realmSystem.afterLoad();
        equipmentSystem.afterLoad();
        showToast('存档导入成功', 'success');
      } else {
        showToast('存档导入失败：格式无效', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ==================== 离线收益 ====================

function calculateAndShowOfflineRewards() {
  const now = Date.now();
  const lastOnline = state.value.lastOnlineAt;
  const offlineSeconds = Math.floor((now - lastOnline) / 1000);

  // 离线不足1分钟不计算
  if (offlineSeconds < 60) return;

  // 限制离线时长
  const maxOffline = state.value.offlineConfig.maxOfflineSeconds;
  const cappedSeconds = Math.min(offlineSeconds, maxOffline);

  const minutes = cappedSeconds / 60;
  const multiplier = state.value.offlineConfig.offlineMultiplier;

  // 计算星元收益
  const starYuanRate = realmSystem.getStarYuanRate();
  const starYuanGain = Math.floor(starYuanRate * minutes * multiplier);

  // 计算星币收益
  const starCoinsRate = 50 + state.value.realm.level * 30;
  const starCoinsGain = Math.floor(starCoinsRate * minutes * multiplier);

  // 应用收益
  state.value.realm.starYuan += starYuanGain;
  state.value.currency.starCoins += starCoinsGain;

  // 更新统计
  state.value.stats_log.totalOfflineSeconds += cappedSeconds;
  state.value.stats_log.totalStarCoinsEarned += starCoinsGain;

  // 显示离线收益
  const hours = Math.floor(cappedSeconds / 3600);
  const mins = Math.floor((cappedSeconds % 3600) / 60);
  const timeStr = hours > 0 ? `${hours}时${mins}分` : `${mins}分钟`;

  showToast(
    `离线${timeStr}，获得 ${starYuanGain} 星元、${starCoinsGain} 星币`,
    'success',
    5000
  );

  // 更新最后在线时间
  state.value.lastOnlineAt = now;
}

// ==================== 生命周期 ====================

onMounted(() => {
  // 监听快捷键
  window.addEventListener('keydown', handleKeydown);

  // 加载存档
  const saved = saveSystem.load();
  if (saved) {
    Object.assign(state.value, saved);
    // 所有系统执行 afterLoad 回调
    realmSystem.afterLoad();
    planetSystem.afterLoad();
    resourceSystem.afterLoad();
    equipmentSystem.afterLoad();
    enhanceSystem.afterLoad();
    combatSystem.afterLoad();
    shopSystem.afterLoad();
    saveSystem.afterLoad();
    transportSystem.afterLoad();
    tutorialSystem.afterLoad();

    // 计算并显示离线收益
    calculateAndShowOfflineRewards();

    showToast('存档已加载', 'info');
  }

  // 注册系统到主循环
  gameLoop.register(realmSystem);
  gameLoop.register(planetSystem);
  gameLoop.register(resourceSystem);
  gameLoop.register(combatSystem);
  gameLoop.register(transportSystem);
  gameLoop.register(weatherSystem);

  // 设置自动保存（每30秒）
  gameLoop.onAutoSave = () => {
    state.value.lastOnlineAt = Date.now();
    saveSystem.save();
  };
  saveSystem.bindAutoSaveEvents();

  // 启动主循环
  gameLoop.start();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  saveSystem.save();
  gameLoop.stop();
});
</script>

<template>
  <div class="app">
    <!-- 顶栏 -->
    <header class="topbar">
      <h1 class="game-title">星渊仙途</h1>
      <div class="topbar-info">
        <span class="realm-badge">{{ realmDisplay }}</span>
        <span class="currency">💰 {{ state.currency.starCoins }}</span>
        <span class="currency spirit">💎 {{ state.currency.spiritStones }}</span>
        <span class="currency dao">✨ {{ state.currency.daoYun }}</span>
        <button class="btn-save" @click="handleManualSave" title="手动保存">💾</button>
        <button class="btn-admin" @click="toggleAdmin" title="管理员模式 (按`键切换)">🛠</button>
      </div>
    </header>

    <!-- 侧边导航 -->
    <nav class="sidebar">
      <button
        v-for="route in routes"
        :key="route.id"
        class="nav-item"
        :class="{ active: currentRoute === route.id }"
        @click="currentRoute = route.id"
      >
        <span class="nav-icon">{{ route.icon }}</span>
        <span class="nav-label">{{ route.label }}</span>
      </button>
    </nav>

    <!-- 内容区 -->
    <main class="content">
      <RealmPanel
        v-if="currentRoute === 'realm'"
        :state="state"
        :realmSystem="realmSystem"
        @breakthrough="handleBreakthrough"
      />
      <PlanetPanel
        v-if="currentRoute === 'planet'"
        :state="state"
        :planetSystem="planetSystem"
        :resourceSystem="resourceSystem"
        @gather="handleGather"
        @switchPlanet="handleSwitchPlanet"
        @toggleAutoCollect="handleToggleAutoCollect"
      />
      <EquipmentPanel
        v-if="currentRoute === 'equipment'"
        :state="state"
        :equipmentSystem="equipmentSystem"
        :equipmentTemplates="equipmentTemplates.templates as Record<string, { id: string; name: string; slot: string; realm: string; requiredMaterials: Record<string, number>; requiredStarCoins: number }>"
        @equip="handleEquip"
        @unequip="handleUnequip"
        @dismantle="handleDismantle"
        @sell="handleSellEquipment"
        @craft="handleCraft"
      />
      <EnhancePanel
        v-if="currentRoute === 'enhance'"
        :state="state"
        :enhanceSystem="enhanceSystem"
        :equipmentSystem="equipmentSystem"
        @enhance="handleEnhance"
      />
      <ProductionPanel
        v-if="currentRoute === 'production'"
        :state="state"
        :productionSystem="productionSystem"
        @produce="handleProduce"
        @collect="handleCollect"
        @upgrade="handleUpgradeDevice"
      />
      <CombatPanel
        v-if="currentRoute === 'combat'"
        :state="state"
        :combatSystem="combatSystem"
        :bossTemplates="monsterData.bosses"
        @challengeBoss="handleChallengeBoss"
      />
      <ShopPanel
        v-if="currentRoute === 'shop'"
        :state="state"
        :shopSystem="shopSystem"
        @buy="handleShopBuy"
        @sell="handleShopSell"
      />
    </main>

    <!-- 底栏 -->
    <footer class="bottombar">
      <span class="bottombar-left">星渊仙途 v0.1.0</span>
      <span class="bottombar-center">
        <span v-if="state.realm.starYuan >= state.realm.starYuanToNext" class="breakthrough-hint">
          ✨ 可突破
        </span>
      </span>
      <span class="bottombar-right">
        <button class="btn-bottombar" @click="handleExportSave" title="导出存档">📤</button>
        <button class="btn-bottombar" @click="handleImportSave" title="导入存档">📥</button>
        <span class="save-status">💾 {{ new Date(state.lastSavedAt).toLocaleTimeString() }}</span>
      </span>
    </footer>

    <!-- 新手引导 -->
    <TutorialPanel
      :tutorialSystem="tutorialSystem"
      @skip="handleTutorialSkip"
      @next="handleTutorialNext"
    />

    <!-- 管理员面板 -->
    <AdminPanel
      v-if="showAdmin"
      :adminSystem="adminSystem"
      @execute="handleAdminExecute"
      @close="handleAdminClose"
    />

    <!-- Toast容器 -->
    <div class="toast-container">
      <div
        v-for="toast in toastMessages"
        :key="toast.id"
        class="toast"
        :class="'toast-' + toast.type"
      >
        {{ toast.text }}
      </div>
    </div>
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
  display: grid;
  grid-template-rows: 48px 1fr 32px;
  grid-template-columns: 200px 1fr;
  height: 100vh;
}

.topbar {
  grid-column: 1 / -1;
  background: #16213e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid #2a2a4a;
}

.game-title {
  font-size: 18px;
  color: #64ffda;
}

.topbar-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.realm-badge {
  background: #2a4a3a;
  padding: 4px 10px;
  border-radius: 4px;
  color: #64ffda;
}

.currency {
  color: #ffd93d;
}

.currency.spirit {
  color: #64ffda;
}

.currency.dao {
  color: #c084fc;
}

.btn-save {
  background: none;
  border: 1px solid #4a4a6a;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.btn-save:hover {
  background: #2a4a3a;
  border-color: #64ffda;
}

.btn-admin {
  background: none;
  border: 1px solid #ff6b6b;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.btn-admin:hover {
  background: #4a2a2a;
  border-color: #ff6b6b;
}

.sidebar {
  grid-row: 2;
  background: #16213e;
  border-right: 1px solid #2a2a4a;
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #8892b0;
  cursor: pointer;
  font-size: 14px;
  text-align: left;
  transition: all 0.15s;
}

.nav-item:hover {
  background: #1e2a4a;
  color: #e0e0e0;
}

.nav-item.active {
  background: #64ffda;
  color: #1a1a2e;
  font-weight: bold;
}

.nav-icon {
  font-size: 18px;
}

.content {
  grid-row: 2;
  grid-column: 2;
  overflow-y: auto;
  background: #0f0f23;
}

.bottombar {
  grid-column: 1 / -1;
  background: #16213e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-size: 12px;
  color: #4a4a6a;
  border-top: 1px solid #2a2a4a;
}

.bottombar-left,
.bottombar-center,
.bottombar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.breakthrough-hint {
  color: #ffd93d;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.save-status {
  color: #4a4a6a;
}

.btn-bottombar {
  background: none;
  border: 1px solid #4a4a6a;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-bottombar:hover {
  background: #2a4a3a;
  border-color: #64ffda;
}

/* Toast */
.toast-container {
  position: fixed;
  top: 60px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
  animation: toast-in 0.3s ease;
}

.toast-info {
  background: #1e2a4a;
  color: #e0e0e0;
  border: 1px solid #2a2a4a;
}

.toast-success {
  background: #1a3a2a;
  color: #6bcb77;
  border: 1px solid #2a5a3a;
}

.toast-error {
  background: #3a1a1a;
  color: #ff6b6b;
  border: 1px solid #5a2a2a;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 响应式：平板 */
@media (min-width: 769px) and (max-width: 1024px) {
  .app {
    grid-template-columns: 60px 1fr;
  }

  .nav-label {
    display: none;
  }

  .nav-item {
    justify-content: center;
    padding: 10px;
  }
}

/* 响应式：手机 */
@media (max-width: 768px) {
  .app {
    grid-template-columns: 1fr;
    grid-template-rows: 48px 1fr 56px;
  }

  .sidebar {
    grid-row: 3;
    flex-direction: row;
    justify-content: space-around;
    border-right: none;
    border-top: 1px solid #2a2a4a;
    padding: 4px;
  }

  .nav-label {
    display: none;
  }

  .nav-item {
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    font-size: 10px;
  }

  .nav-icon {
    font-size: 20px;
  }

  .content {
    grid-column: 1;
  }
}
</style>

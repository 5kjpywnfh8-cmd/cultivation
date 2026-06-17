<script setup lang="ts">
/**
 * 商店 UI 面板
 *
 * 分页显示商品，显示价格、解锁条件、购买数量选择、余额显示。
 * 设计参考：05-商店系统.md
 */
import { computed, ref } from 'vue';
import type { PlayerState } from '../core/GameState';
import type { ShopSystem } from '../systems/ShopSystem';
import { displayValue } from '../utils/ScientificNumber';
import { getItemName } from '../utils/names';

const props = defineProps<{
  state: PlayerState;
  shopSystem: ShopSystem;
}>();

const emit = defineEmits<{
  buy: [itemId: string, count: number];
  sell: [itemId: string, count: number];
}>();

const activeTab = ref('resources');
/** 每个商品独立的购买数量 */
const buyCounts = ref<Record<string, number>>({});
/** 每个物品独立的出售数量 */
const sellCounts = ref<Record<string, number>>({});

function getBuyCount(itemId: string): number {
  return buyCounts.value[itemId] ?? 1;
}

function setBuyCount(itemId: string, count: number) {
  buyCounts.value[itemId] = Math.max(1, Math.min(99, count));
}

function handleBuyInput(itemId: string, event: Event) {
  const input = event.target as HTMLInputElement;
  const value = parseInt(input.value, 10);
  if (!isNaN(value) && value >= 1) {
    buyCounts.value[itemId] = Math.min(99, value);
  }
}

function getSellCount(itemId: string): number {
  return sellCounts.value[itemId] ?? 1;
}

function setSellCount(itemId: string, count: number) {
  const max = props.state.inventory.items[itemId]?.quantity ?? 1;
  sellCounts.value[itemId] = Math.max(1, Math.min(max, count));
}

function setSellMax(itemId: string) {
  const max = props.state.inventory.items[itemId]?.quantity ?? 1;
  sellCounts.value[itemId] = max;
}

function handleSellInput(itemId: string, event: Event) {
  const input = event.target as HTMLInputElement;
  const value = parseInt(input.value, 10);
  const max = props.state.inventory.items[itemId]?.quantity ?? 1;
  if (!isNaN(value) && value >= 1) {
    sellCounts.value[itemId] = Math.min(max, value);
  }
}

const categories = computed(() => props.shopSystem.getAvailableItems());

const balance = computed(() => props.shopSystem.getBalance());

const inventoryItems = computed(() => {
  return Object.values(props.state.inventory.items)
    .filter(item => item.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);
});

function handleBuy(itemId: string) {
  emit('buy', itemId, getBuyCount(itemId));
}

function isItemOwned(item: { type: string; skillId?: string; giveItems?: Record<string, number> }): boolean {
  if (item.type === 'skill' && item.skillId) {
    return props.state.skills[item.skillId]?.status === 'learned';
  }
  if (item.type === 'blueprint' && item.giveItems) {
    return Object.keys(item.giveItems).some(id => !!props.state.inventory.items[id]);
  }
  return false;
}

function handleSell(itemId: string, count?: number) {
  emit('sell', itemId, count ?? getSellCount(itemId));
}

function formatPrice(price: { starCoins?: number; spiritStones?: number; daoYun?: number }): string {
  const parts: string[] = [];
  if (price.starCoins) parts.push(`${price.starCoins}星币`);
  if (price.spiritStones) parts.push(`${price.spiritStones}灵石`);
  if (price.daoYun) parts.push(`${price.daoYun}道韵`);
  return parts.join(' + ');
}
</script>

<template>
  <div class="shop-panel">
    <!-- 余额显示 -->
    <div class="balance-bar">
      <span class="balance-item">💰 {{ displayValue(balance.starCoins) }}</span>
      <span class="balance-item">💎 {{ balance.spiritStones }}</span>
      <span class="balance-item">✨ {{ balance.daoYun }}</span>
    </div>

    <!-- 分类标签 -->
    <div class="tab-bar">
      <button
        v-for="cat in categories"
        :key="cat.category"
        class="tab"
        :class="{ active: activeTab === cat.category }"
        @click="activeTab = cat.category"
      >
        {{ cat.categoryName }}
      </button>
      <button
        class="tab"
        :class="{ active: activeTab === 'inventory' }"
        @click="activeTab = 'inventory'"
      >
        出售
      </button>
    </div>

    <!-- 商品列表 -->
    <div class="item-list" v-if="activeTab !== 'inventory'">
      <div
        v-for="cat in categories.filter(c => c.category === activeTab)"
        :key="cat.category"
      >
        <div
          v-for="item in cat.items"
          :key="item.id"
          class="shop-item"
        >
          <div class="item-info">
            <span class="item-name">
              {{ item.name }}
              <span v-if="isItemOwned(item)" class="owned-badge">已拥有</span>
            </span>
            <span class="item-price">{{ formatPrice(item.price) }}</span>
          </div>
          <div class="item-actions">
            <div class="count-selector" v-if="!isItemOwned(item)">
              <button @click="setBuyCount(item.id, getBuyCount(item.id) - 1)">-</button>
              <input
                type="number"
                class="count-input"
                :value="getBuyCount(item.id)"
                min="1"
                max="99"
                @input="handleBuyInput(item.id, $event)"
              />
              <button @click="setBuyCount(item.id, getBuyCount(item.id) + 1)">+</button>
            </div>
            <button class="btn btn-buy" :disabled="isItemOwned(item)" @click="handleBuy(item.id)">
              {{ isItemOwned(item) ? '已拥有' : '购买' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 出售列表 -->
    <div class="item-list" v-else>
      <div
        v-for="item in inventoryItems"
        :key="item.id"
        class="shop-item"
      >
        <div class="item-info">
          <span class="item-name">{{ getItemName(item.id) }}</span>
          <span class="item-qty">×{{ item.quantity }}</span>
        </div>
        <div class="item-actions">
          <div class="count-selector">
            <button @click="setSellCount(item.id, getSellCount(item.id) - 1)">-</button>
            <input
              type="number"
              class="count-input"
              :value="getSellCount(item.id)"
              min="1"
              :max="item.quantity"
              @input="handleSellInput(item.id, $event)"
            />
            <button @click="setSellCount(item.id, getSellCount(item.id) + 1)">+</button>
            <button class="btn-max" @click="setSellMax(item.id)">全部</button>
          </div>
          <button class="btn btn-sell" @click="handleSell(item.id)">出售</button>
        </div>
      </div>
      <div v-if="inventoryItems.length === 0" class="empty-state">
        背包为空
      </div>
    </div>
  </div>
</template>

<style scoped>
.shop-panel {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.balance-bar {
  display: flex;
  gap: 16px;
  background: #1e2a4a;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.balance-item {
  font-size: 14px;
  color: #ffd93d;
}

.tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
}

.tab {
  padding: 8px 16px;
  background: #1e2a4a;
  border: 1px solid #2a2a4a;
  border-radius: 6px;
  color: #8892b0;
  cursor: pointer;
  white-space: nowrap;
}

.tab.active {
  background: #64ffda;
  color: #1a1a2e;
  font-weight: bold;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shop-item {
  background: #1e2a4a;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-name {
  font-size: 16px;
  color: #e0e0e0;
}

.item-price {
  font-size: 13px;
  color: #ffd93d;
}

.item-qty {
  font-size: 13px;
  color: #8892b0;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.count-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-selector button {
  width: 28px;
  height: 28px;
  background: #2a2a4a;
  border: 1px solid #4a4a6a;
  border-radius: 4px;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 16px;
}

.btn-max {
  width: auto !important;
  padding: 0 8px;
  font-size: 12px !important;
  background: #4a3a2a !important;
  border-color: #ffd93d !important;
  color: #ffd93d !important;
}

.count-selector span {
  font-size: 14px;
  color: #e0e0e0;
  min-width: 24px;
  text-align: center;
}

.count-input {
  width: 48px;
  height: 28px;
  background: #2a2a4a;
  border: 1px solid #4a4a6a;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
  text-align: center;
  outline: none;
}

.count-input:focus {
  border-color: #64ffda;
}

/* 隐藏 number input 的上下箭头 */
.count-input::-webkit-inner-spin-button,
.count-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.count-input[type="number"] {
  -moz-appearance: textfield;
}

.btn-buy {
  padding: 6px 16px;
  background: #2a4a3a;
  border: 1px solid #64ffda;
  border-radius: 4px;
  color: #64ffda;
  cursor: pointer;
}

.btn-sell {
  padding: 6px 16px;
  background: #4a3a2a;
  border: 1px solid #ffd93d;
  border-radius: 4px;
  color: #ffd93d;
  cursor: pointer;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: #8892b0;
}

.owned-badge {
  font-size: 12px;
  color: #6bcb77;
  background: #1a3a2a;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 6px;
}

.btn-buy:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .shop-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>

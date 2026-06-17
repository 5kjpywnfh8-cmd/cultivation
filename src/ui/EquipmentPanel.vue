<script setup lang="ts">
/**
 * 装备 UI 面板
 *
 * 功能：装备槽位、打造装备、背包装备列表、穿戴/卸下/分解/出售
 * 设计参考：04-装备系统.md
 */
import { computed, ref } from 'vue';
import type { PlayerState, EquipmentSlot, Equipment, EquipmentQuality, Affix } from '../core/GameState';
import type { EquipmentSystem } from '../systems/EquipmentSystem';
import { getItemName } from '../utils/names';

const props = defineProps<{
  state: PlayerState;
  equipmentSystem: EquipmentSystem;
  /** 装备模板配置 */
  equipmentTemplates?: Record<string, { id: string; name: string; slot: string; realm: string; requiredMaterials: Record<string, number>; requiredStarCoins: number }>;
}>();

const emit = defineEmits<{
  equip: [equipmentId: string];
  unequip: [slot: EquipmentSlot];
  dismantle: [equipmentId: string];
  sell: [equipmentId: string];
  craft: [templateId: string];
}>();

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: '武器',
  helmet: '头盔',
  armor: '铠甲',
  gauntlet: '护腕',
  boot: '靴子',
  talisman: '法宝',
};

const SLOT_ICONS: Record<EquipmentSlot, string> = {
  weapon: '⚔',
  helmet: '🪖',
  armor: '🛡',
  gauntlet: '🧤',
  boot: '👢',
  talisman: '📿',
};

const QUALITY_COLORS: Record<EquipmentQuality, string> = {
  common: '#9e9e9e',
  fine: '#4caf50',
  rare: '#2196f3',
  epic: '#9c27b0',
  legendary: '#ff9800',
  mythic: '#f44336',
  ancient: '#ffd700',
};

const QUALITY_LABELS: Record<EquipmentQuality, string> = {
  common: '普通',
  fine: '精良',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
  ancient: '太古',
};

const activeTab = ref<'equipped' | 'craft' | 'inventory'>('equipped');

/** 已穿戴装备 */
const equippedItems = computed(() => {
  const result: Record<EquipmentSlot, Equipment | null> = {
    weapon: null, helmet: null, armor: null,
    gauntlet: null, boot: null, talisman: null,
  };
  for (const [slot, eqId] of Object.entries(props.state.equippedGear)) {
    if (eqId) {
      result[slot as EquipmentSlot] = props.state.allEquipment[eqId] ?? null;
    }
  }
  return result;
});

/** 背包中未穿戴的装备 */
const inventoryEquipments = computed(() => {
  const equippedIds = new Set(Object.values(props.state.equippedGear).filter(Boolean));
  return Object.values(props.state.allEquipment)
    .filter(eq => !equippedIds.has(eq.id))
    .sort((a, b) => {
      const qualityOrder: Record<EquipmentQuality, number> = {
        common: 0, fine: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, ancient: 6,
      };
      return qualityOrder[b.quality] - qualityOrder[a.quality];
    });
});

/** 可打造的装备列表 */
const craftableItems = computed(() => {
  if (!props.equipmentTemplates) return [];
  return Object.values(props.equipmentTemplates).map(template => {
    const canCraft = checkCanCraft(template);
    return { ...template, canCraft };
  });
});

/** 检查是否可以打造 */
function checkCanCraft(template: { requiredMaterials: Record<string, number>; requiredStarCoins: number }): boolean {
  // 检查材料
  for (const [matId, amount] of Object.entries(template.requiredMaterials)) {
    const item = props.state.inventory.items[matId];
    if (!item || item.quantity < amount) return false;
  }
  // 检查星币
  return props.state.currency.starCoins >= template.requiredStarCoins;
}

function getQualityColor(quality: EquipmentQuality): string {
  return QUALITY_COLORS[quality] ?? '#9e9e9e';
}

function getQualityLabel(quality: EquipmentQuality): string {
  return QUALITY_LABELS[quality] ?? quality;
}

function handleEquip(equipmentId: string) {
  emit('equip', equipmentId);
}

function handleUnequip(slot: EquipmentSlot) {
  emit('unequip', slot);
}

function handleDismantle(equipmentId: string) {
  emit('dismantle', equipmentId);
}

function handleSell(equipmentId: string) {
  emit('sell', equipmentId);
}

function getEquipStat(eq: Equipment, stat: 'attack' | 'defense' | 'hp'): number {
  const stats = props.equipmentSystem.getEquipmentStats(eq.id);
  return stats?.[stat] ?? 0;
}

const AFFIX_LABELS: Record<string, string> = {
  atkPct: '攻击', defPct: '防御', hpPct: '生命',
  critRate: '暴击率', critDmg: '暴击伤害', penetration: '穿透',
  dodge: '闪避', starYuanGain: '星元获取', gatherSpeed: '采集速度',
  prodSpeed: '生产速度', dropRate: '掉率', cdReduction: '冷却缩减',
  skillDmg: '技能伤害', lifeSteal: '吸血', dmgReduction: '减伤',
  allStats: '全属性', berserkerRage: '狂战士之怒', ironWall: '铁壁守护',
  lifeDrain: '生命汲取', critMaster: '暴击大师', gatherMaster: '采集达人',
  prodMaster: '生产大师', luckyStar: '幸运之星', endlessPower: '无尽之力',
};

function formatAffix(affix: Affix): string {
  const label = AFFIX_LABELS[affix.type] ?? affix.type;
  const pct = Math.round(affix.value * 100);
  return `${label} ${affix.isNegative ? '-' : '+'}${pct}%`;
}

function handleCraft(templateId: string) {
  emit('craft', templateId);
}
</script>

<template>
  <div class="equipment-panel">
    <!-- 标签页 -->
    <div class="tab-bar">
      <button class="tab" :class="{ active: activeTab === 'equipped' }" @click="activeTab = 'equipped'">已穿戴</button>
      <button class="tab" :class="{ active: activeTab === 'craft' }" @click="activeTab = 'craft'">锻造台</button>
      <button class="tab" :class="{ active: activeTab === 'inventory' }" @click="activeTab = 'inventory'">背包</button>
    </div>

    <!-- 已穿戴 -->
    <div v-if="activeTab === 'equipped'" class="slots-section">
      <div class="slots-grid">
        <div
          v-for="(item, slot) in equippedItems"
          :key="slot"
          class="slot-item"
          :class="{ equipped: !!item }"
          @click="item && handleUnequip(slot as EquipmentSlot)"
        >
          <div class="slot-icon">{{ SLOT_ICONS[slot as EquipmentSlot] }}</div>
          <div class="slot-label">{{ SLOT_LABELS[slot as EquipmentSlot] }}</div>
          <div v-if="item" class="slot-equip-detail">
            <span class="slot-equip-name" :style="{ color: getQualityColor(item.quality) }">
              {{ item.name }}<span v-if="item.enhanceLevel > 0">+{{ item.enhanceLevel }}</span>
            </span>
            <span class="slot-equip-stats">
              <span v-if="getEquipStat(item, 'attack') > 0">攻+{{ getEquipStat(item, 'attack') }}</span>
              <span v-if="getEquipStat(item, 'defense') > 0">防+{{ getEquipStat(item, 'defense') }}</span>
              <span v-if="getEquipStat(item, 'hp') > 0">命+{{ getEquipStat(item, 'hp') }}</span>
            </span>
            <div v-if="item.affixes.length > 0" class="slot-equip-affixes">
              <span v-for="(affix, idx) in item.affixes" :key="idx" class="affix-tag" :class="{ negative: affix.isNegative }">
                {{ formatAffix(affix) }}
              </span>
            </div>
          </div>
          <div v-else class="slot-empty">空</div>
        </div>
      </div>
    </div>

    <!-- 锻造台 -->
    <div v-if="activeTab === 'craft'" class="craft-section">
      <div class="craft-list">
        <div
          v-for="template in craftableItems"
          :key="template.id"
          class="craft-item"
          :class="{ disabled: !template.canCraft }"
        >
          <div class="craft-info">
            <span class="craft-name">{{ template.name }}</span>
            <span class="craft-slot">{{ SLOT_LABELS[template.slot as EquipmentSlot] }}</span>
          </div>
          <div class="craft-cost">
            <span v-for="(amount, matId) in template.requiredMaterials" :key="matId" class="cost-item">
              {{ getItemName(matId) }}: {{ props.state.inventory.items[matId]?.quantity ?? 0 }}/{{ amount }}
            </span>
            <span class="cost-item">💰 {{ template.requiredStarCoins }}</span>
          </div>
          <button
            class="btn btn-craft"
            :disabled="!template.canCraft"
            @click="handleCraft(template.id)"
          >
            打造
          </button>
        </div>
      </div>
    </div>

    <!-- 背包装备列表 -->
    <div v-if="activeTab === 'inventory'" class="inventory-section">
      <div class="equip-list">
        <div
          v-for="eq in inventoryEquipments"
          :key="eq.id"
          class="equip-item"
        >
          <div class="equip-info">
            <span class="equip-name" :style="{ color: getQualityColor(eq.quality) }">
              {{ eq.name }}
              <span v-if="eq.enhanceLevel > 0">+{{ eq.enhanceLevel }}</span>
            </span>
            <span class="equip-quality">{{ getQualityLabel(eq.quality) }}</span>
            <span class="equip-slot">{{ SLOT_LABELS[eq.slot] }}</span>
            <span class="equip-stats">
              <span v-if="getEquipStat(eq, 'attack') > 0">攻+{{ getEquipStat(eq, 'attack') }}</span>
              <span v-if="getEquipStat(eq, 'defense') > 0">防+{{ getEquipStat(eq, 'defense') }}</span>
              <span v-if="getEquipStat(eq, 'hp') > 0">命+{{ getEquipStat(eq, 'hp') }}</span>
            </span>
          </div>
          <div class="equip-actions">
            <button class="btn btn-sm btn-equip" @click="handleEquip(eq.id)">穿戴</button>
            <button class="btn btn-sm btn-sell" @click="handleSell(eq.id)">出售</button>
            <button class="btn btn-sm btn-dismantle" @click="handleDismantle(eq.id)">分解</button>
          </div>
        </div>
        <div v-if="inventoryEquipments.length === 0" class="empty-state">
          暂无装备
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.equipment-panel {
  padding: 16px;
  max-width: 700px;
  margin: 0 auto;
}

.tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tab {
  padding: 8px 16px;
  background: #1e2a4a;
  border: 1px solid #2a2a4a;
  border-radius: 6px;
  color: #8892b0;
  cursor: pointer;
}

.tab.active {
  background: #64ffda;
  color: #1a1a2e;
  font-weight: bold;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.slot-item {
  background: #1e2a4a;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.slot-item.equipped {
  border-color: #64ffda;
}

.slot-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.slot-label {
  font-size: 12px;
  color: #8892b0;
  margin-bottom: 4px;
}

.slot-equip {
  font-size: 14px;
  font-weight: bold;
}

.slot-empty {
  font-size: 14px;
  color: #4a4a6a;
}

.slot-equip-detail {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
}

.slot-equip-name {
  font-size: 14px;
  font-weight: bold;
}

.slot-equip-stats {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: #64ffda;
}

.slot-equip-affixes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.affix-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: #1a3a2a;
  color: #6bcb77;
}

.affix-tag.negative {
  background: #3a1a1a;
  color: #ff6b6b;
}

.craft-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.craft-item {
  background: #1e2a4a;
  padding: 14px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.craft-item.disabled {
  opacity: 0.6;
}

.craft-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 100px;
}

.craft-name {
  font-size: 16px;
  color: #e0e0e0;
  font-weight: bold;
}

.craft-slot {
  font-size: 12px;
  color: #8892b0;
}

.craft-cost {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}

.cost-item {
  font-size: 13px;
  color: #8892b0;
  background: #2a2a4a;
  padding: 2px 8px;
  border-radius: 4px;
}

.btn-craft {
  padding: 8px 20px;
  background: #2a4a3a;
  border: 1px solid #64ffda;
  border-radius: 6px;
  color: #64ffda;
  cursor: pointer;
  white-space: nowrap;
}

.btn-craft:hover:not(:disabled) {
  background: #3a5a4a;
}

.btn-craft:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.equip-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.equip-item {
  background: #1e2a4a;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.equip-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.equip-name {
  font-size: 16px;
  font-weight: bold;
}

.equip-quality {
  font-size: 12px;
  color: #8892b0;
}

.equip-slot {
  font-size: 12px;
  color: #8892b0;
}

.equip-stats {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #64ffda;
}

.equip-actions {
  display: flex;
  gap: 6px;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-equip {
  background: #2a4a3a;
  color: #64ffda;
}

.btn-sell {
  background: #4a3a2a;
  color: #ffd93d;
}

.btn-dismantle {
  background: #4a2a2a;
  color: #ff6b6b;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: #8892b0;
}

@media (max-width: 768px) {
  .slots-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .craft-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .equip-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>

# Phase 1: 核心循环 MVP

## 概述

Phase 1 的目标是搭建可玩的核心循环原型：玩家能在起源星和玄铁星采集资源、打造基础装备、进行自动战斗、在商店交易、通过境界修炼提升实力，并具备存档/读档能力。本阶段产出约2500行代码，覆盖练气期完整体验。

## 任务清单

### 1.1 项目基础架构

| 序号 | 任务 | 涉及文件 | 依赖 | 工时 |
|------|------|---------|------|------|
| 1.1.1 | 初始化项目工程（Vite + Vue3 + TypeScript），配置目录结构：src/core、src/systems、src/ui、src/config、src/utils | package.json, tsconfig.json, vite.config.ts | 无 | 2h |
| 1.1.2 | 实现核心状态管理（GameState），定义 PlayerState 顶层结构，包含 player、planets、inventory、production、quests、settings 字段 | src/core/GameState.ts | 无 | 3h |
| 1.1.3 | 实现事件总线（EventBus），支持 on/off/emit，用于系统间解耦通信 | src/core/EventBus.ts | 无 | 1h |
| 1.1.4 | 实现游戏主循环（GameLoop），requestAnimationFrame 驱动，每帧调用各 system.update(dt)，支持暂停/恢复 | src/core/GameLoop.ts | 1.1.2, 1.1.3 | 2h |
| 1.1.5 | 实现 ScientificNumber 工具类，支持大数加减乘除、比较、toDisplay() 格式化显示（K/M/B/T），用于后期数值防溢出 | src/utils/ScientificNumber.ts | 无 | 3h |

### 1.2 配置数据层

| 序号 | 任务 | 涉及文件 | 依赖 | 工时 |
|------|------|---------|------|------|
| 1.2.1 | 编写境界属性配置表 realm-stats.json（60级完整数据 + 无限境界参考），包含 level、attack、defense、hp、starYuanCost 字段 | src/config/realm-stats.json | 无 | 2h |
| 1.2.2 | 编写装备模板配置表 equipment-templates.json（练气期6件套：武器/头盔/铠甲/护腕/靴子/法宝），包含 baseStats、qualityCoefficients、partCoefficients | src/config/equipment-templates.json | 无 | 2h |
| 1.2.3 | 编写星球资源配置表 planet-config.json（起源星 + 玄铁星），包含 resources（type、baseRate、autoRate）、unlockCondition | src/config/planet-config.json | 无 | 2h |
| 1.2.4 | 编写怪物模板配置表 monster-templates.json（起源星怪物 + 玄铁星怪物 + 矿脉巨兽Boss），包含 stats、skills、drops | src/config/monster-templates.json | 无 | 2h |
| 1.2.5 | 编写商店商品配置表 shop-config.json（基础商店星币商品：资源、功法、图纸），包含 items、price、unlockCondition | src/config/shop-config.json | 无 | 2h |
| 1.2.6 | 编写强化配置表 enhance-config.json（强化系数 1.25^n、成功率公式、消耗公式、一周目+15上限） | src/config/enhance-config.json | 无 | 1h |

### 1.3 境界修炼系统

| 序号 | 任务 | 涉及文件 | 依赖 | 工时 |
|------|------|---------|------|------|
| 1.3.1 | 实现 RealmSystem：管理当前境界等级、星元累积、突破逻辑。update(dt) 中按公式累积星元，突破时校验星元是否足够 | src/systems/RealmSystem.ts | 1.1.2, 1.2.1 | 3h |
| 1.3.2 | 实现境界属性查询接口 getRealmStats(level)，返回 attack/defense/hp/baseStarYuanCost，数据从 realm-stats.json 读取 | src/systems/RealmSystem.ts | 1.2.1 | 1h |
| 1.3.3 | 实现境界突破函数 breakthrough()，消耗星元、更新等级、触发 realm:changed 事件、校验新境界解锁内容 | src/systems/RealmSystem.ts | 1.3.1, 1.3.2 | 2h |
| 1.3.4 | 实现星元获取速率计算：baseRate + 装备加成 + 功法加成 + 丹药加成，受境界等级影响 | src/systems/RealmSystem.ts | 1.3.1 | 1h |
| 1.3.5 | 实现境界 UI 面板：显示当前境界、属性值、星元进度条、突破按钮、预计突破时间 | src/ui/RealmPanel.vue | 1.3.1 | 3h |

### 1.4 星球与资源采集系统

| 序号 | 任务 | 涉及文件 | 依赖 | 工时 |
|------|------|---------|------|------|
| 1.4.1 | 实现 PlanetManager：管理星球列表、解锁状态、当前所在星球，提供 switchPlanet(planetId) 切换 | src/systems/PlanetManager.ts | 1.1.2, 1.2.3 | 2h |
| 1.4.2 | 实现 ResourceSystem：管理各星球资源储量、采集速率计算（基础速率 x 星球倍率 x 工具加成 x 境界加成） | src/systems/ResourceSystem.ts | 1.2.3, 1.3.2 | 3h |
| 1.4.3 | 实现手动采集函数 manualGather(resourceType)，消耗体力、产出资源、更新储量、触发 resource:gathered 事件 | src/systems/ResourceSystem.ts | 1.4.2 | 2h |
| 1.4.4 | 实现自动采集逻辑：update(dt) 中按自动采集速率（手动的50%）持续产出资源，离线时按离线系数计算 | src/systems/ResourceSystem.ts | 1.4.2 | 2h |
| 1.4.5 | 实现离线收益计算函数 calculateOfflineEarnings(offlineSeconds)，根据境界离线上限和离线采集系数结算 | src/systems/ResourceSystem.ts | 1.4.2, 1.3.1 | 2h |
| 1.4.6 | 实现资源储量管理：基础资源1%/小时再生，枯竭后产出降至10%，稀有资源枯竭后为0 | src/systems/ResourceSystem.ts | 1.4.2 | 1h |
| 1.4.7 | 实现星球 UI 面板：显示当前星球资源列表、储量百分比、采集按钮、自动采集状态、切换星球入口 | src/ui/PlanetPanel.vue | 1.4.1, 1.4.2 | 3h |
| 1.4.8 | 实现星舟运输基础逻辑：手动搬运，每次携带20单位，跨星球运输时间5秒 | src/systems/TransportSystem.ts | 1.4.1 | 2h |

### 1.5 装备与打造系统

| 序号 | 任务 | 涉及文件 | 依赖 | 工时 |
|------|------|---------|------|------|
| 1.5.1 | 实现 Equipment 数据模型：定义 Equipment 接口（id、templateId、quality、enhanceLevel、affixes[]、slot），实现装备属性计算公式 equipAttr = qualityCoeff x partCoeff x realmBase x enhanceCoeff | src/core/models/Equipment.ts | 1.2.1, 1.2.2 | 3h |
| 1.5.2 | 实现 InventorySystem：管理背包（材料、装备、消耗品），支持 addItem/removeItem/getCount，背包上限200格 | src/systems/InventorySystem.ts | 1.1.2 | 3h |
| 1.5.3 | 实现 CraftingSystem：基础打造逻辑，消耗材料 + 星币 → 按品质概率表（白40%/绿30%/蓝18%/紫9%/橙2.5%/红0.5%）产出装备 | src/systems/CraftingSystem.ts | 1.5.1, 1.5.2, 1.2.2 | 3h |
| 1.5.4 | 实现装备穿戴/卸下逻辑：equip(item, slot) / unequip(slot)，穿戴后重算角色总属性，触发 equip:changed 事件 | src/systems/EquipmentSystem.ts | 1.5.1, 1.5.2 | 2h |
| 1.5.5 | 实现装备分解函数 dismantle(equipment)：返还30%打造材料，强化过的装备额外返还50%强化石 | src/systems/EquipmentSystem.ts | 1.5.1, 1.5.2 | 1h |
| 1.5.6 | 实现装备出售函数 sell(equipment)：按品质返回星币（白100/绿500/蓝2000/紫8000/橙30000/红100000） | src/systems/EquipmentSystem.ts | 1.5.1, 1.5.2 | 1h |
| 1.5.7 | 实现锻造台 UI：显示可打造列表、材料需求、品质概率、打造按钮；打造结果弹窗显示装备属性 | src/ui/ForgePanel.vue | 1.5.3 | 3h |
| 1.5.8 | 实现装备面板 UI：6个装备槽位（武器/头盔/铠甲/护腕/靴子/法宝），显示穿戴装备属性、背包装备列表、一键穿戴/卸下 | src/ui/EquipmentPanel.vue | 1.5.4 | 3h |

### 1.6 强化系统（基础版）

| 序号 | 任务 | 涉及文件 | 依赖 | 工时 |
|------|------|---------|------|------|
| 1.6.1 | 实现 EnhanceSystem：强化逻辑，消耗强化石 + 星币，按成功率公式（max(5%, 100% - level x 0.5%)）判定成功/失败，一周目上限+15 | src/systems/EnhanceSystem.ts | 1.5.1, 1.2.6 | 3h |
| 1.6.2 | 实现强化系数查询 enhanceCoeff(level)：返回 1.25^level，+15时系数28.42 | src/systems/EnhanceSystem.ts | 1.6.1 | 1h |
| 1.6.3 | 实现强化 UI：选择装备 → 显示当前强化等级/属性/成功率/消耗 → 强化按钮 → 成功/失败动画反馈 | src/ui/EnhancePanel.vue | 1.6.1 | 3h |

### 1.7 基础战斗系统

| 序号 | 任务 | 涉及文件 | 依赖 | 工时 |
|------|------|---------|------|------|
| 1.7.1 | 实现 CombatSystem 核心：伤害公式 actualDmg = attack x skillMultiplier x (1 - reductionRate) x critCoeff，减伤率 = def / (def + 1000 + atkLvl x 50) | src/systems/CombatSystem.ts | 1.3.2, 1.5.1 | 3h |
| 1.7.2 | 实现自动战斗逻辑：普通区域自动战斗，每秒结算一次伤害，玩家先攻，击杀后获得掉落物和星币 | src/systems/CombatSystem.ts | 1.7.1 | 2h |
| 1.7.3 | 实现暴击判定：暴击率受软上限30%/硬上限80%约束，暴击伤害 = 1.5 + 暴击伤害加成 | src/systems/CombatSystem.ts | 1.7.1 | 1h |
| 1.7.4 | 实现怪物生成器：根据当前星球和玩家境界生成对应怪物，怪物属性从 monster-templates.json 读取 | src/systems/CombatSystem.ts | 1.2.4, 1.4.1 | 2h |
| 1.7.5 | 实现战斗掉落系统：击杀怪物后按掉落表概率判定产出（星币、材料、强化石、灵石），加入背包 | src/systems/CombatSystem.ts | 1.5.2, 1.2.4 | 2h |
| 1.7.6 | 实现 Boss 战基础逻辑：Boss 有独立血条和技能，手动操作模式，Boss 技能按冷却自动释放 | src/systems/BossSystem.ts | 1.7.1, 1.2.4 | 3h |
| 1.7.7 | 实现战斗 UI：显示玩家/怪物血条、伤害数字飘字、战斗日志、自动战斗开关、Boss 战技能栏 | src/ui/CombatPanel.vue | 1.7.1 | 3h |

### 1.8 基础商店系统

| 序号 | 任务 | 涉及文件 | 依赖 | 工时 |
|------|------|---------|------|------|
| 1.8.1 | 实现 ShopSystem：商店商品列表管理，按境界解锁过滤商品，支持 buy(itemId, count) 购买和 sell(item) 出售 | src/systems/ShopSystem.ts | 1.5.2, 1.2.5 | 3h |
| 1.8.2 | 实现货币管理：星币、灵石三种货币的 add/spend/getBalance 接口，扣费前校验余额 | src/systems/CurrencySystem.ts | 1.1.2 | 2h |
| 1.8.3 | 实现功法购买：商店购买功法后加入功法列表，功法数据（倍率、冷却、特效）从配置读取 | src/systems/SkillSystem.ts | 1.8.1, 1.8.2 | 2h |
| 1.8.4 | 实现基础功法配置：基础剑诀（120%/3s）、聚灵术（被动星元+10%）、铁壁功（被动防御+15%） | src/config/skill-templates.json | 无 | 1h |
| 1.8.5 | 实现商店 UI：分页显示商品（资源区/功法区/图纸区），显示价格、解锁条件、购买数量选择、余额显示 | src/ui/ShopPanel.vue | 1.8.1 | 3h |

### 1.9 存档系统

| 序号 | 任务 | 涉及文件 | 依赖 | 工时 |
|------|------|---------|------|------|
| 1.9.1 | 定义 PlayerState 完整 Schema（TypeScript interface），包含 player（level、exp、currencies、equipment）、planets（resources、buildings）、inventory（items[]）、quests、settings | src/core/models/PlayerState.ts | 1.1.2 | 2h |
| 1.9.2 | 实现 save(state) 函数：将 PlayerState 序列化为 JSON，写入 localStorage，包含 version 字段用于迁移 | src/core/SaveManager.ts | 1.9.1 | 2h |
| 1.9.3 | 实现 load() 函数：从 localStorage 读取 JSON，反序列化为 PlayerState，校验 version 并执行数据迁移 | src/core/SaveManager.ts | 1.9.2 | 2h |
| 1.9.4 | 实现自动存档：每60秒自动保存一次，页面关闭前触发 beforeunload 保存 | src/core/SaveManager.ts | 1.9.2 | 1h |
| 1.9.5 | 实现离线收益结算：load() 时计算离线时长，调用 ResourceSystem.calculateOfflineEarnings()，弹窗显示离线收益汇总 | src/core/SaveManager.ts | 1.9.3, 1.4.5 | 2h |
| 1.9.6 | 实现存档导入/导出：导出为 base64 字符串供玩家备份，导入时校验格式合法性 | src/core/SaveManager.ts | 1.9.2, 1.9.3 | 1h |

### 1.10 游戏主循环与 UI 框架

| 序号 | 任务 | 涉及文件 | 依赖 | 工时 |
|------|------|---------|------|------|
| 1.10.1 | 实现主界面布局：顶部状态栏（境界/星元/货币）、左侧导航栏（星球/锻造/装备/商店/战斗）、中央内容区、底部快捷栏 | src/ui/MainLayout.vue | 1.10.2 | 3h |
| 1.10.2 | 实现 UI 框架：响应式布局（PC 1200px+ / 平板 768-1199px / 手机 <768px），使用 CSS Grid + 媒体查询 | src/ui/MainLayout.vue | 无 | 3h |
| 1.10.3 | 实现数值格式化工具：大数显示（K/M/B/T）、百分比显示、时间格式化（秒→时:分:秒） | src/utils/formatters.ts | 1.1.5 | 1h |
| 1.10.4 | 实现新手引导流程：第零章任务链（0.1-0.7），逐步解锁采集/打造/战斗/商店功能，每步高亮对应 UI 元素 | src/ui/TutorialSystem.vue | 1.10.1 | 3h |
| 1.10.5 | 实现通知/Toast 系统：强化成功/失败、获得物品、境界突破等事件的浮动提示 | src/ui/NotificationSystem.vue | 1.1.3 | 1h |
| 1.10.6 | 集成所有系统到 GameLoop，完成系统注册和 update 调度顺序：Realm → Resource → Combat → Production → Quest | src/main.ts | 全部 | 2h |

## 本阶段产出

完成 Phase 1 后，游戏具备以下可玩内容：

1. **境界修炼**：练气1-10阶完整修炼体验，星元累积→突破→属性提升
2. **双星球探索**：起源星（5种基础资源）和玄铁星（铁矿/铜矿/精铁），手动+自动采集
3. **基础装备**：玄铁套装6件打造，品质随机（白→橙），装备穿戴/分解/出售
4. **强化系统**：装备强化+1~+15，成功率递减，属性指数增长
5. **自动战斗**：起源星/玄铁星怪物自动击杀，Boss手动挑战（矿脉巨兽）
6. **商店系统**：星币购买资源/功法/图纸，灵石基础获取
7. **存档系统**：自动存档、离线收益结算、导入导出
8. **新手引导**：第零章7步引导，教会所有基础操作

**预估代码量**：约2500行（不含配置JSON和样式）
**预估开发周期**：3-4周（单人）

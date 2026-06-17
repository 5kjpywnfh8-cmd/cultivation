/**
 * 星渊仙途 - 管理员系统
 *
 * 仅用于开发测试，生产环境应禁用。
 * 提供快捷操作：添加资源、跳过境界、重置状态、解锁全部等。
 */

import type { PlayerState, RealmName, PlanetId } from '../core/GameState';
import { getItemName } from '../utils/names';

/** 星球解锁等级映射 */
function getPlanetUnlockLevel(planetId: PlanetId): number {
  const map: Record<string, number> = {
    origin: 0, xuantie: 3, lingzhi: 1, youming: 21,
    tianjing: 31, huoshan: 21, bingfeng: 31,
    hundun: 41, fukong: 41, shenyuan: 41,
  };
  return map[planetId] ?? 999;
}

/** 管理员命令 */
export interface AdminCommand {
  id: string;
  name: string;
  description: string;
  category: 'resource' | 'realm' | 'unlock' | 'combat' | 'reset' | 'debug';
  execute: (state: PlayerState) => string;
}

export class AdminSystem {
  private state: PlayerState;

  constructor(state: PlayerState) {
    this.state = state;
  }

  /**
   * 获取所有管理员命令
   */
  getCommands(): AdminCommand[] {
    return [
      // 资源类
      {
        id: 'add_starcoins',
        name: '添加星币',
        description: '添加100万星币',
        category: 'resource',
        execute: (state) => {
          state.currency.starCoins += 1000000;
          return '已添加 1,000,000 星币';
        },
      },
      {
        id: 'add_spiritstones',
        name: '添加灵石',
        description: '添加1000灵石',
        category: 'resource',
        execute: (state) => {
          state.currency.spiritStones += 1000;
          return '已添加 1,000 灵石';
        },
      },
      {
        id: 'add_daoyun',
        name: '添加道韵',
        description: '添加100道韵',
        category: 'resource',
        execute: (state) => {
          state.currency.daoYun += 100;
          return '已添加 100 道韵';
        },
      },
      {
        id: 'add_materials',
        name: '添加全部材料',
        description: '每种材料×999',
        category: 'resource',
        execute: (state) => {
          const materials = [
            'iron_ore', 'copper_ore', 'star_dust', 'wood_crystal', 'spirit_liquid',
            'refined_iron', 'herb', 'enhancementStone', 'spore', 'life_dew',
            'soul_stone', 'dark_moss', 'ghost_fire', 'sky_crystal', 'thunder_marrow',
            'arc_stone', 'fire_crystal', 'lava_essence', 'earth_fire',
            'ice_stone', 'ice_soul', 'frost_essence',
            'chaos_stone', 'void_vine', 'dao_fragment',
            'wind_stone', 'cloud_crystal', 'sky_water',
            'abyss_stone', 'chaos_origin', 'void_essence',
          ];
          for (const id of materials) {
            if (state.inventory.items[id]) {
              state.inventory.items[id].quantity += 999;
            } else {
              state.inventory.items[id] = {
                id, name: id, type: 'resource', quantity: 999, maxStack: 0,
              };
            }
          }
          return '已添加全部材料×999';
        },
      },
      {
        id: 'add_enhancement_stones',
        name: '添加强化石',
        description: '添加999强化石',
        category: 'resource',
        execute: (state) => {
          if (state.inventory.items['enhancementStone']) {
            state.inventory.items['enhancementStone'].quantity += 999;
          } else {
            state.inventory.items['enhancementStone'] = {
              id: 'enhancementStone', name: getItemName('enhancementStone'), type: 'enhancementStone', quantity: 999, maxStack: 0,
            };
          }
          return '已添加 999 强化石';
        },
      },

      // 境界类
      {
        id: 'max_starYuan',
        name: '星元满值',
        description: '当前境界星元满值，可立即突破',
        category: 'realm',
        execute: (state) => {
          state.realm.starYuan = state.realm.starYuanToNext;
          return '星元已满，可突破';
        },
      },
      {
        id: 'jump_to_jindan',
        name: '跳到金丹期',
        description: '直接提升到金丹1阶（21级），解锁对应星球',
        category: 'realm',
        execute: (state) => {
          state.realm.level = 21;
          state.realm.realm = '金丹' as RealmName;
          state.realm.tier = 1;
          state.realm.starYuan = 0;
          state.realm.starYuanToNext = 120000;
          state.stats.attack = 800;
          state.stats.defense = 400;
          state.stats.hp = 3000;
          state.stats.currentHp = 3000;
          // 解锁对应星球
          for (const planet of Object.values(state.planets)) {
            const cond = getPlanetUnlockLevel(planet.id);
            if (cond <= 21) planet.unlocked = true;
          }
          // 解锁设备
          state.devices.distiller.unlocked = true;
          state.devices.extractor.unlocked = true;
          return '已跳到金丹1阶，解锁幽冥星/火山星/蒸馏器/萃取机';
        },
      },
      {
        id: 'jump_to_yuanying',
        name: '跳到元婴期',
        description: '直接提升到元婴1阶（31级），解锁对应星球',
        category: 'realm',
        execute: (state) => {
          state.realm.level = 31;
          state.realm.realm = '元婴' as RealmName;
          state.realm.tier = 1;
          state.realm.starYuan = 0;
          state.realm.starYuanToNext = 2000000;
          state.stats.attack = 5000;
          state.stats.defense = 2500;
          state.stats.hp = 20000;
          state.stats.currentHp = 20000;
          for (const planet of Object.values(state.planets)) {
            const cond = getPlanetUnlockLevel(planet.id);
            if (cond <= 31) planet.unlocked = true;
          }
          state.devices.distiller.unlocked = true;
          state.devices.extractor.unlocked = true;
          state.devices.alchemyFurnace.unlocked = true;
          state.devices.refiner.unlocked = true;
          return '已跳到元婴1阶，解锁天晶星/冰封星/炼丹炉/精炼台';
        },
      },
      {
        id: 'jump_to_huashen',
        name: '跳到化神期',
        description: '直接提升到化神1阶（41级），解锁全部星球',
        category: 'realm',
        execute: (state) => {
          state.realm.level = 41;
          state.realm.realm = '化神' as RealmName;
          state.realm.tier = 1;
          state.realm.starYuan = 0;
          state.realm.starYuanToNext = 40000000;
          state.stats.attack = 35000;
          state.stats.defense = 18000;
          state.stats.hp = 150000;
          state.stats.currentHp = 150000;
          for (const planet of Object.values(state.planets)) {
            planet.unlocked = true;
          }
          for (const device of Object.values(state.devices)) {
            device.unlocked = true;
          }
          return '已跳到化神1阶，解锁全部星球和设备';
        },
      },

      // 解锁类
      {
        id: 'unlock_all_planets',
        name: '解锁全部星球',
        description: '解锁所有10个星球',
        category: 'unlock',
        execute: (state) => {
          for (const planet of Object.values(state.planets)) {
            planet.unlocked = true;
          }
          return '已解锁全部星球';
        },
      },
      {
        id: 'unlock_all_devices',
        name: '解锁全部设备',
        description: '解锁所有生产设备',
        category: 'unlock',
        execute: (state) => {
          for (const device of Object.values(state.devices)) {
            device.unlocked = true;
          }
          return '已解锁全部设备';
        },
      },
      {
        id: 'complete_tutorial',
        name: '完成新手引导',
        description: '标记新手引导为已完成',
        category: 'unlock',
        execute: (state) => {
          state.tutorialCompleted = true;
          return '新手引导已标记完成';
        },
      },

      // 重置类
      {
        id: 'reset_game',
        name: '重置游戏',
        description: '清除存档，重新开始',
        category: 'reset',
        execute: (state) => {
          localStorage.removeItem('xingyan_xiantu_save');
          // 重置关键字段
          state.realm = { realm: '练气', tier: 1, level: 1, starYuan: 0, starYuanToNext: 100 };
          state.stats = { attack: 15, defense: 8, hp: 50, critRate: 0, critDamage: 0, penetration: 0, dodgeRate: 0, hpRegen: 1, currentHp: 50 };
          state.baseStats = { attack: 15, defense: 8, hp: 50 };
          state.currency = { starCoins: 0, spiritStones: 0, daoYun: 0 };
          state.inventory = { items: {}, capacity: 0 };
          state.tutorialCompleted = false;
          return '游戏已重置，请刷新页面';
        },
      },

      // 战斗类
      {
        id: 'simulate_kill',
        name: '模拟击杀',
        description: '模拟击杀10只怪物，获得掉落物',
        category: 'combat',
        execute: (state) => {
          state.combat.totalKills += 10;
          state.currency.starCoins += 5000;
          // 添加随机材料
          const materials = ['iron_ore', 'copper_ore', 'star_dust', 'herb'];
          for (const mat of materials) {
            if (state.inventory.items[mat]) {
              state.inventory.items[mat].quantity += 20;
            } else {
              state.inventory.items[mat] = {
                id: mat, name: mat, type: 'resource', quantity: 20, maxStack: 0,
              };
            }
          }
          return '已击杀10只怪物，获得5000星币+20个材料';
        },
      },
      {
        id: 'reset_boss_cooldown',
        name: '重置Boss冷却',
        description: '清除所有Boss冷却，确保可挑战',
        category: 'combat',
        execute: (state) => {
          state.combat.bossTimers = {};
          // 确保当前星球是玄铁星（有Boss）
          state.combat.currentPlanet = 'xuantie';
          // 确保等级足够
          if (state.realm.level < 5) {
            state.realm.level = 5;
            state.realm.tier = 5;
          }
          return '已重置Boss冷却，当前星球：玄铁星';
        },
      },
      {
        id: 'add_challenge_tickets',
        name: '添加挑战券',
        description: '添加10张Boss挑战券',
        category: 'combat',
        execute: (state) => {
          state.bossChallengeTickets += 10;
          return '已添加 10 张Boss挑战券';
        },
      },
      {
        id: 'max_stats',
        name: '属性最大化',
        description: '攻击/防御/生命设为当前境界上限',
        category: 'combat',
        execute: (state) => {
          const level = state.realm.level;
          state.stats.attack = Math.floor(15 * Math.pow(1.213, level - 1));
          state.stats.defense = Math.floor(8 * Math.pow(1.213, level - 1));
          state.stats.hp = Math.floor(50 * Math.pow(1.213, level - 1));
          state.stats.currentHp = state.stats.hp;
          state.stats.critRate = 0.5;
          state.stats.critDamage = 1.0;
          state.stats.penetration = 0.3;
          state.stats.dodgeRate = 0.2;
          return '属性已最大化';
        },
      },

      // 调试类
      {
        id: 'show_state',
        name: '查看状态',
        description: '在控制台输出当前状态',
        category: 'debug',
        execute: (state) => {
          console.log('[Admin] 当前状态:', JSON.parse(JSON.stringify(state)));
          return '已输出到控制台（F12）';
        },
      },
      {
        id: 'export_save',
        name: '导出存档',
        description: '将存档输出到控制台',
        category: 'debug',
        execute: (state) => {
          console.log('[Admin] 存档数据:', JSON.stringify(state, null, 2));
          return '已导出到控制台（F12）';
        },
      },
    ];
  }

  /**
   * 执行管理员命令
   */
  executeCommand(commandId: string): string {
    const commands = this.getCommands();
    const command = commands.find(c => c.id === commandId);
    if (!command) return '命令不存在';
    return command.execute(this.state);
  }

  /**
   * 按分类获取命令
   */
  getCommandsByCategory(): Record<string, AdminCommand[]> {
    const commands = this.getCommands();
    const grouped: Record<string, AdminCommand[]> = {};
    for (const cmd of commands) {
      if (!grouped[cmd.category]) grouped[cmd.category] = [];
      grouped[cmd.category]!.push(cmd);
    }
    return grouped;
  }
}

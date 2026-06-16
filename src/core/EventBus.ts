/**
 * 星渊仙途 - 事件总线
 *
 * 轻量级发布/订阅事件系统，用于模块间解耦通信。
 * 事件名采用 "模块:动作" 命名规范，如 "realm:levelUp"。
 *
 * 设计参考：设计方案/制作计划/05-技术架构.md 第四章
 */

export interface EventOptions {
  /** 优先级（数值越大越先执行） */
  priority?: number;
  /** 是否只触发一次 */
  once?: boolean;
}

interface ListenerEntry {
  handler: (data: unknown) => void;
  priority: number;
  once: boolean;
}

export class EventBus {
  private _listeners = new Map<string, Set<ListenerEntry>>();

  /**
   * 订阅事件
   * @param event 事件名
   * @param handler 回调函数
   * @param options 优先级和一次性设置
   */
  on(event: string, handler: (data: unknown) => void, options: EventOptions = {}): void {
    const entry: ListenerEntry = {
      handler,
      priority: options.priority ?? 0,
      once: options.once ?? false,
    };

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(entry);
  }

  /**
   * 一次性订阅
   */
  once(event: string, handler: (data: unknown) => void): void {
    this.on(event, handler, { once: true });
  }

  /**
   * 取消订阅
   */
  off(event: string, handler: (data: unknown) => void): void {
    const listeners = this._listeners.get(event);
    if (!listeners) return;

    for (const entry of listeners) {
      if (entry.handler === handler) {
        listeners.delete(entry);
        break;
      }
    }
  }

  /**
   * 触发事件
   *
   * 同步执行所有订阅者，按 priority 降序排列。
   * once 标记的订阅者执行后自动移除。
   */
  emit(event: string, data?: unknown): void {
    const listeners = this._listeners.get(event);
    if (!listeners || listeners.size === 0) return;

    // 按优先级降序排序
    const sorted = [...listeners].sort((a, b) => b.priority - a.priority);

    // 收集需要移除的 once 监听器
    const toRemove: ListenerEntry[] = [];

    for (const entry of sorted) {
      try {
        entry.handler(data);
      } catch (err) {
        console.error(`[EventBus] 事件 "${event}" 处理器异常:`, err);
      }

      if (entry.once) {
        toRemove.push(entry);
      }
    }

    // 移除 once 监听器
    for (const entry of toRemove) {
      listeners.delete(entry);
    }
  }

  /**
   * 清除所有监听器（用于重置/测试）
   */
  clear(): void {
    this._listeners.clear();
  }

  /**
   * 清除指定事件的所有监听器
   */
  clearEvent(event: string): void {
    this._listeners.delete(event);
  }
}

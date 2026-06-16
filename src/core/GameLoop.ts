/**
 * 星渊仙途 - 游戏主循环
 *
 * requestAnimationFrame 驱动，每帧调用各 system.update(dt)。
 * 支持暂停/恢复，自动保存定时器。
 *
 * 设计参考：设计方案/制作计划/05-技术架构.md 第五章
 */

export interface GameSystem {
  /** 系统名称（用于日志） */
  readonly name: string;
  /** 每帧更新 */
  update(dt: number): void;
  /** 存档前回调 */
  beforeSave?(): void;
  /** 读档后回调 */
  afterLoad?(): void;
  /** 重置（新游戏） */
  reset?(): void;
}

export class GameLoop {
  /** 已注册的系统（按注册顺序执行） */
  private _systems: GameSystem[] = [];
  /** rAF 句柄 */
  private _rafId = 0;
  /** 上一帧时间戳 */
  private _lastTime = 0;
  /** 是否运行中 */
  private _running = false;
  /** 自动保存定时器 */
  private _autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  /** 自动保存间隔（毫秒） */
  autoSaveInterval = 30_000;
  /** 自动保存回调 */
  onAutoSave: (() => void) | null = null;

  get running(): boolean {
    return this._running;
  }

  /**
   * 注册一个系统
   */
  register(system: GameSystem): void {
    this._systems.push(system);
  }

  /**
   * 启动主循环
   */
  start(): void {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._tick.bind(this));

    // 启动自动保存
    if (this.onAutoSave) {
      this._autoSaveTimer = setInterval(() => {
        this.onAutoSave?.();
      }, this.autoSaveInterval);
    }
  }

  /**
   * 暂停主循环
   */
  pause(): void {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
  }

  /**
   * 恢复主循环
   */
  resume(): void {
    if (this._running) return;
    this.start();
  }

  /**
   * 停止并清理
   */
  stop(): void {
    this.pause();
    this._systems = [];
  }

  /**
   * 通知所有系统：存档前
   */
  notifyBeforeSave(): void {
    for (const sys of this._systems) {
      sys.beforeSave?.();
    }
  }

  /**
   * 通知所有系统：读档后
   */
  notifyAfterLoad(): void {
    for (const sys of this._systems) {
      sys.afterLoad?.();
    }
  }

  /**
   * 通知所有系统：重置
   */
  notifyReset(): void {
    for (const sys of this._systems) {
      sys.reset?.();
    }
  }

  /**
   * 主循环 tick
   */
  private _tick(now: number): void {
    if (!this._running) return;

    const dt = (now - this._lastTime) / 1000; // 转为秒
    this._lastTime = now;

    // 限制 dt 防止切后台回来时跳帧（最大 5 秒）
    const clampedDt = Math.min(dt, 5);

    // 按注册顺序更新各系统
    for (const sys of this._systems) {
      try {
        sys.update(clampedDt);
      } catch (err) {
        console.error(`[GameLoop] 系统 "${sys.name}" 更新异常:`, err);
      }
    }

    this._rafId = requestAnimationFrame(this._tick.bind(this));
  }
}

export class TimerManager {
  private permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private idleTimers = new Map<number, ReturnType<typeof setTimeout>>();

  startPermissionTimer(agentId: number, onTimeout: () => void, ms: number): void {
    this.cancelPermissionTimer(agentId);
    const timer = setTimeout(() => {
      this.permissionTimers.delete(agentId);
      onTimeout();
    }, ms);
    this.permissionTimers.set(agentId, timer);
  }

  startIdleTimer(agentId: number, onIdle: () => void, ms: number = 30000): void {
    const existingTimer = this.idleTimers.get(agentId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => {
      this.idleTimers.delete(agentId);
      onIdle();
    }, ms);
    this.idleTimers.set(agentId, timer);
  }

  cancelPermissionTimer(agentId: number): void {
    const timer = this.permissionTimers.get(agentId);
    if (timer) {
      clearTimeout(timer);
      this.permissionTimers.delete(agentId);
    }
  }

  cancelIdleTimer(agentId: number): void {
    const idleTimer = this.idleTimers.get(agentId);
    if (idleTimer) {
      clearTimeout(idleTimer);
      this.idleTimers.delete(agentId);
    }
  }

  cancelTimer(agentId: number): void {
    this.cancelPermissionTimer(agentId);
    this.cancelIdleTimer(agentId);
  }

  disposeAll(): void {
    for (const timer of this.permissionTimers.values()) {
      clearTimeout(timer);
    }
    this.permissionTimers.clear();
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();
  }
}
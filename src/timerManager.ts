export class TimerManager {
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  startPermissionTimer(agentId: number, onTimeout: () => void, ms: number): void {
    this.cancelTimer(agentId);
    const timer = setTimeout(() => {
      this.timers.delete(agentId);
      onTimeout();
    }, ms);
    this.timers.set(agentId, timer);
  }

  cancelTimer(agentId: number): void {
    const timer = this.timers.get(agentId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(agentId);
    }
  }

  disposeAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

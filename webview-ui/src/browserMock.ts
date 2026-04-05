type MessageHandler = (message: unknown) => void;

let messageHandler: MessageHandler | null = null;

export function postMessage(message: unknown): void {
  console.log('[browserMock] postMessage:', message);
}

export function getState<T = unknown>(): T {
  return {} as T;
}

export function onMessage(handler: MessageHandler): void {
  messageHandler = handler;
}

export function simulateMessage(message: unknown): void {
  messageHandler?.(message);
}

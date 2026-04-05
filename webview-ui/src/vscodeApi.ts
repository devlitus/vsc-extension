declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage(message: unknown): void;
      getState(): unknown;
      setState(state: unknown): void;
    } | undefined;
  }
}

let vscodeApi: Window['acquireVsCodeApi'] extends () => infer R ? R : never | undefined;

export function initVscodeApi(): void {
  vscodeApi = window.acquireVsCodeApi?.();
}

export function postMessage(message: unknown): void {
  vscodeApi?.postMessage(message);
}

export function getState<T = unknown>(): T {
  return (vscodeApi?.getState() as T) ?? ({} as T);
}

import { postMessage as vsPostMessage, getState as vsGetState, initVscodeApi } from './vscodeApi';
import { postMessage as browserPostMessage, getState as browserGetState, onMessage as browserOnMessage } from './browserMock';

let initialized = false;
let currentEnvironment: 'vscode' | 'browser' | null = null;

function detectEnvironment(): 'vscode' | 'browser' {
  if (typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
    return 'vscode';
  }
  return 'browser';
}

export function init(): void {
  if (initialized) return;
  
  currentEnvironment = detectEnvironment();
  
  if (currentEnvironment === 'vscode') {
    initVscodeApi();
  }
  
  initialized = true;
}

export function postMessage(message: unknown): void {
  if (currentEnvironment === 'vscode') {
    vsPostMessage(message);
  } else {
    browserPostMessage(message);
  }
}

export function getState<T = unknown>(): T {
  if (currentEnvironment === 'vscode') {
    return vsGetState<T>();
  }
  return browserGetState<T>();
}

export function onMessage(handler: (message: unknown) => void): () => void {
  if (currentEnvironment === 'vscode') {
    const wrapped = (ev: MessageEvent) => handler(ev.data);
    window.addEventListener('message', wrapped);
    return () => window.removeEventListener('message', wrapped);
  } else {
    return browserOnMessage(handler);
  }
}

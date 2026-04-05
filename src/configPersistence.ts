import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { PersistedAgent } from './types';

const CONFIG_KEY = 'pixel-agents.agents';

const PROTECTED_KEYS = ['__proto__', 'constructor', 'prototype'];

function deepCloneWithValidation<T>(obj: unknown): T | null {
  if (obj === null || typeof obj !== 'object') {
    return null;
  }

  if (Array.isArray(obj)) {
    const cloned: unknown[] = [];
    for (const item of obj) {
      const c = deepCloneWithValidation(item);
      if (c === null) {
        return null;
      }
      cloned.push(c);
    }
    return cloned as unknown as T;
  }

  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (PROTECTED_KEYS.includes(key)) {
      continue;
    }
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'object' && value !== null) {
      const c = deepCloneWithValidation(value);
      if (c === null) {
        return null;
      }
      clone[key] = c;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      clone[key] = value;
    }
  }
  return clone as unknown as T;
}

function validatePersistedAgent(obj: unknown): obj is PersistedAgent {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const record = obj as Record<string, unknown>;

  if (typeof record.id !== 'number') {
    return false;
  }

  if (typeof record.sessionId !== 'string') {
    return false;
  }

  if (typeof record.jsonlFile !== 'string') {
    return false;
  }

  if (typeof record.projectDir !== 'string') {
    return false;
  }

  if (typeof record.terminalName !== 'string') {
    return false;
  }

  if (record.folderName !== undefined && typeof record.folderName !== 'string') {
    return false;
  }

  if (typeof record.isExternal !== 'boolean') {
    return false;
  }

  return true;
}

export function loadPersistedAgents(context: vscode.ExtensionContext): PersistedAgent[] {
  try {
    const stored = context.globalState.get<unknown[]>(CONFIG_KEY);

    if (!Array.isArray(stored)) {
      return [];
    }

    const agents: PersistedAgent[] = [];

    for (const item of stored) {
      const cloned = deepCloneWithValidation(item);
      if (cloned !== null && validatePersistedAgent(cloned)) {
        agents.push(cloned);
      }
    }

    return agents;
  } catch {
    return [];
  }
}

export function savePersistedAgents(
  context: vscode.ExtensionContext,
  agents: PersistedAgent[]
): void {
  const validated: PersistedAgent[] = [];

  for (const agent of agents) {
    const cloned = deepCloneWithValidation(agent);
    if (cloned !== null && validatePersistedAgent(cloned)) {
      validated.push(cloned);
    }
  }

  context.globalState.update(CONFIG_KEY, validated);
}

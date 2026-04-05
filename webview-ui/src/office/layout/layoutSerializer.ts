import { OfficeLayout } from '../types';

const POLLUTANT_KEYS = ['__proto__', 'constructor', 'prototype'];

function sanitizeObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }
  
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (POLLUTANT_KEYS.includes(key)) {
      continue;
    }
    result[key] = sanitizeObject((obj as Record<string, unknown>)[key]);
  }
  
  return result as T;
}

export function serialize(layout: OfficeLayout): string {
  return JSON.stringify(layout, null, 2);
}

export function deserialize(json: string): OfficeLayout | null {
  try {
    const parsed = JSON.parse(json);
    return sanitizeObject(parsed) as OfficeLayout;
  } catch {
    return null;
  }
}

export function migrate(raw: unknown): OfficeLayout {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid layout');
  }
  
  const obj = raw as Record<string, unknown>;
  
  // Handle v1 layouts without version field
  if (!obj.version) {
    return {
      version: 1,
      width: (obj.width as number) ?? 20,
      height: (obj.height as number) ?? 15,
      tiles: (obj.tiles as OfficeLayout['tiles']) ?? [],
      furniture: (obj.furniture as OfficeLayout['furniture']) ?? [],
      seats: (obj.seats as OfficeLayout['seats']) ?? [],
    };
  }
  
  return sanitizeObject(obj as unknown) as OfficeLayout;
}

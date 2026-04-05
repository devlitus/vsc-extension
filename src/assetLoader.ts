import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AssetManifest } from './types';

const DEFAULT_FURNITURE_PACKS: AssetManifest['furniturePacks'] = [
  {
    id: 'pixel-office',
    name: 'Pixel Office',
    uris: {},
  },
];

/**
 * External furniture item loaded from a user-specified asset directory.
 */
export interface ExternalFurnitureItem {
  id: string;
  name: string;
  sprites: Record<string, string>; // state -> data URI
  rotations: string[];
  states: string[];
  frames: number;
  size: { w: number; h: number };
}

/**
 * Container for loaded external assets.
 */
export interface LoadedAssets {
  furniture: ExternalFurnitureItem[];
}

const PROTECTED_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Deep clones an object with validation to prevent prototype pollution.
 */
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

/**
 * Manifest format required for external furniture packs.
 */
interface ExternalManifest {
  id: string;
  name: string;
  sprites: string[];  // relative paths to sprite files
  rotations: string[];
  states: string[];
  frames: number;
  size: { w: number; h: number };
}

function validateExternalManifest(obj: unknown): obj is ExternalManifest {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const record = obj as Record<string, unknown>;

  if (typeof record.id !== 'string' || !record.id) {
    return false;
  }
  if (typeof record.name !== 'string' || !record.name) {
    return false;
  }
  if (!Array.isArray(record.sprites)) {
    return false;
  }
  if (!Array.isArray(record.rotations)) {
    return false;
  }
  if (!Array.isArray(record.states)) {
    return false;
  }
  if (typeof record.frames !== 'number') {
    return false;
  }
  if (typeof record.size !== 'object' || record.size === null) {
    return false;
  }
  const size = record.size as Record<string, unknown>;
  if (typeof size.w !== 'number' || typeof size.h !== 'number') {
    return false;
  }

  return true;
}

export function getAssetUris(
  context: vscode.ExtensionContext,
  webview: vscode.Webview
): AssetManifest {
  const manifest: AssetManifest = {
    furniturePacks: DEFAULT_FURNITURE_PACKS.map(pack => ({
      ...pack,
      uris: {},
    })),
  };

  const baseUri = vscode.Uri.joinPath(context.extensionUri, 'assets');

  for (const pack of manifest.furniturePacks) {
    const packDir = vscode.Uri.joinPath(baseUri, pack.id);

    try {
      const files = ['furniture.json', 'sprites.png', 'data.json'];
      for (const file of files) {
        const fileUri = vscode.Uri.joinPath(packDir, file);
        const webviewUri = webview.asWebviewUri(fileUri);
        pack.uris[file] = webviewUri.toString();
      }
    } catch {
      // Ignore asset loading errors
    }
  }

  return manifest;
}

/**
 * Converts a file to a data URI for embedding in webview.
 */
function fileToDataUri(filePath: string): string | null {
  try {
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'application/octet-stream';
    switch (ext) {
      case '.png': mimeType = 'image/png'; break;
      case '.jpg': case '.jpeg': mimeType = 'image/jpeg'; break;
      case '.gif': mimeType = 'image/gif'; break;
      case '.svg': mimeType = 'image/svg+xml'; break;
      case '.webp': mimeType = 'image/webp'; break;
    }
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Scans an external directory for furniture asset packs.
 *
 * Each subdirectory is checked for a `manifest.json` file. If valid,
 * sprite files are loaded and converted to data URIs.
 *
 * @param dirPath - Path to the external asset directory
 * @param webview - VS Code webview for resolving asset URIs
 * @param extensionUri - Extension URI for absolute path resolution
 * @returns Loaded assets from the directory
 */
export function scanExternalDirectory(
  dirPath: string,
  _webview: vscode.Webview,
  _extensionUri: vscode.Uri
): LoadedAssets {
  const furniture: ExternalFurnitureItem[] = [];

  if (!fs.existsSync(dirPath)) {
    return { furniture };
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const subdirPath = path.join(dirPath, entry.name);
      const manifestPath = path.join(subdirPath, 'manifest.json');

      if (!fs.existsSync(manifestPath)) {
        continue;
      }

      let manifestContent: string;
      try {
        manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      } catch {
        continue;
      }

      let manifestObj: unknown;
      try {
        manifestObj = JSON.parse(manifestContent);
      } catch {
        continue;
      }

      const cloned = deepCloneWithValidation<ExternalManifest>(manifestObj);
      if (cloned === null || !validateExternalManifest(cloned)) {
        continue;
      }

      const manifest = cloned;
      const sprites: Record<string, string> = {};

      for (const spriteFile of manifest.sprites) {
        const spritePath = path.join(subdirPath, spriteFile);
        if (!fs.existsSync(spritePath)) {
          continue;
        }
        const dataUri = fileToDataUri(spritePath);
        if (dataUri) {
          // Use filename without extension as state key
          const stateName = path.basename(spriteFile, path.extname(spriteFile));
          sprites[stateName] = dataUri;
        }
      }

      if (Object.keys(sprites).length === 0) {
        continue;
      }

      furniture.push({
        id: manifest.id,
        name: manifest.name,
        sprites,
        rotations: manifest.rotations,
        states: manifest.states,
        frames: manifest.frames,
        size: manifest.size,
      });
    }
  } catch {
    // Ignore scanning errors
  }

  return { furniture };
}

/**
 * Merges two LoadedAssets without overwriting existing IDs.
 *
 * Items from `extra` are appended only if their ID does not already
 * exist in `base`.
 */
export function mergeLoadedAssets(base: LoadedAssets, extra: LoadedAssets): LoadedAssets {
  const existingIds = new Set(base.furniture.map(f => f.id));
  const merged = deepCloneWithValidation<ExternalFurnitureItem[]>(base.furniture) ?? [];

  for (const item of extra.furniture) {
    if (!existingIds.has(item.id)) {
      const cloned = deepCloneWithValidation<ExternalFurnitureItem>(item);
      if (cloned !== null) {
        merged.push(cloned);
      }
    }
  }

  return { furniture: merged };
}

/**
 * Loads and returns external assets from all configured directories.
 *
 * @param context - VS Code extension context
 * @param webview - VS Code webview for URI resolution
 * @returns Combined external assets from all directories
 */
export function getExternalAssetUris(
  context: vscode.ExtensionContext,
  webview: vscode.Webview
): LoadedAssets {
  const dirs = context.globalState.get<string[]>('externalAssetDirs', []);
  let combined: LoadedAssets = { furniture: [] };

  for (const dir of dirs) {
    const loaded = scanExternalDirectory(dir, webview, context.extensionUri);
    combined = mergeLoadedAssets(combined, loaded);
  }

  return combined;
}

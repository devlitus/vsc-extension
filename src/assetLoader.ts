import * as vscode from 'vscode';
import { AssetManifest } from './types';

const DEFAULT_FURNITURE_PACKS: AssetManifest['furniturePacks'] = [
  {
    id: 'pixel-office',
    name: 'Pixel Office',
    uris: {},
  },
];

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

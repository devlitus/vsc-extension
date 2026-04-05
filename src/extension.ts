import * as vscode from 'vscode';
import { PixelAgentsViewProvider } from './PixelAgentsViewProvider';

let providerInstance: PixelAgentsViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  providerInstance = new PixelAgentsViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PixelAgentsViewProvider.viewType, providerInstance),
    vscode.commands.registerCommand('pixel-agents.showPanel', () => providerInstance?.focus()),
    vscode.commands.registerCommand('pixel-agents.exportDefaultLayout', () => providerInstance?.exportDefaultLayout()),
  );
}

export function deactivate() {
  providerInstance?.dispose();
}

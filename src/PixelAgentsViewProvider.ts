import * as vscode from 'vscode';
import { AgentManager } from './agentManager';
import { TimerManager } from './timerManager';
import { FileWatcher } from './fileWatcher';
import { getAssetUris } from './assetLoader';
import { loadLayout, saveLayout } from './layoutPersistence';
import { WebviewMessage, AssetManifest } from './types';

const HTML_SANITIZE_PATTERN = /[<>&"']/g;

function sanitizeString(str: unknown): string {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(HTML_SANITIZE_PATTERN, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

function sanitizeMessage(msg: WebviewMessage): WebviewMessage {
  switch (msg.type) {
    case 'agentAdded':
      return {
        type: 'agentAdded',
        agentId: msg.agentId,
        sessionId: sanitizeString(msg.sessionId),
      };
    case 'agentRemoved':
      return {
        type: 'agentRemoved',
        agentId: msg.agentId,
      };
    case 'toolStart':
      return {
        type: 'toolStart',
        agentId: msg.agentId,
        toolName: sanitizeString(msg.toolName),
        status: sanitizeString(msg.status),
      };
    case 'toolEnd':
      return {
        type: 'toolEnd',
        agentId: msg.agentId,
      };
    case 'toolProgress':
      return {
        type: 'toolProgress',
        agentId: msg.agentId,
        status: sanitizeString(msg.status),
      };
    case 'turnEnd':
      return {
        type: 'turnEnd',
        agentId: msg.agentId,
      };
    case 'permissionRequest':
      return {
        type: 'permissionRequest',
        agentId: msg.agentId,
      };
    case 'layoutLoaded':
      return {
        type: 'layoutLoaded',
        layout: msg.layout,
      };
    case 'assetsLoaded':
      return {
        type: 'assetsLoaded',
        manifest: msg.manifest,
      };
    default:
      return msg;
  }
}

export class PixelAgentsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'pixel-agents';

  private webviewView: vscode.WebviewView | undefined;
  private disposables: vscode.Disposable[] = [];
  private agentManager: AgentManager;
  private timerManager: TimerManager;
  private fileWatcher: FileWatcher;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.agentManager = new AgentManager();
    this.timerManager = new TimerManager();
    this.fileWatcher = new FileWatcher(this.agentManager, this.onAgentUpdate.bind(this));
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtmlForWebview();

    this.fileWatcher.start();

    this.sendInitialMessages();
  }

  private onAgentUpdate(message: WebviewMessage): void {
    if (!this.webviewView) {
      return;
    }

    const sanitized = sanitizeMessage(message);
    this.webviewView.webview.postMessage(sanitized);
  }

  private sendInitialMessages(): void {
    if (!this.webviewView) {
      return;
    }

    const layout = loadLayout();
    if (layout) {
      const msg: WebviewMessage = {
        type: 'layoutLoaded',
        layout,
      };
      this.webviewView.webview.postMessage(msg);
    }

    const manifest = getAssetUris(this.context, this.webviewView.webview);
    const msg: WebviewMessage = {
      type: 'assetsLoaded',
      manifest,
    };
    this.webviewView.webview.postMessage(msg);
  }

  private getHtmlForWebview(): string {
    const scriptUri = this.webviewView!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'main.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pixel Agents</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    body { background-color: #1e1e1e; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  focus(): void {
    this.webviewView?.show();
  }

  exportDefaultLayout(): void {
    const layout = {
      version: 1,
      furniturePacks: [],
    };
    saveLayout(layout);
  }

  dispose(): void {
    this.fileWatcher.dispose();
    this.timerManager.disposeAll();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

import * as vscode from 'vscode';
import { AgentManager } from './agentManager';
import { TimerManager } from './timerManager';
import { FileWatcher } from './fileWatcher';
import { getAssetUris, getExternalAssetUris } from './assetLoader';
import { loadLayout, saveLayout } from './layoutPersistence';
import { WebviewMessage, AssetManifest } from './types';
import { PixelAgentsServer } from './server/server';
import { installHooks, uninstallHooks } from './server/providers/file/claudeHookInstaller';
import { handleHookEvent } from './server/hookEventHandler';

const EXTENSION_VERSION = '0.0.1';

const GLOBAL_STATE_KEYS = {
  soundEnabled: 'soundEnabled',
  alwaysShowLabels: 'alwaysShowLabels',
  watchAllSessions: 'watchAllSessions',
  hooksEnabled: 'hooksEnabled',
  externalAssetDirs: 'externalAssetDirs',
  lastSeenVersion: 'lastSeenVersion',
} as const;

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
        source: msg.source,
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
  private server: PixelAgentsServer;
  private openInspectionAgentId: number | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.agentManager = new AgentManager();
    this.timerManager = new TimerManager();
    this.fileWatcher = new FileWatcher(this.agentManager, this.onAgentUpdate.bind(this));
    this.server = new PixelAgentsServer();
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtmlForWebview();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      this.handleWebviewMessage(message);
    });

    this.fileWatcher.start();

    // Check for version upgrade
    this.checkVersionUpgrade();

    // Start server and install hooks
    const hooksEnabled = this.context.globalState.get<boolean>(GLOBAL_STATE_KEYS.hooksEnabled, true);

    this.server.start().then(() => {
      this.server.onEvent('claude', (event) => {
        handleHookEvent(event, this.agentManager.getAllAgents(), (_agentId, msg) => {
          this.onAgentUpdate(msg);
        });
      });

      if (hooksEnabled) {
        return installHooks(this.server.port, this.server.token);
      }
    }).catch((err) => {
      console.error('Failed to start server:', err);
    });

    // Initialize watchAllSessions setting
    const watchAllSessions = this.context.globalState.get<boolean>(GLOBAL_STATE_KEYS.watchAllSessions, false);
    this.fileWatcher.setWatchAllSessions(watchAllSessions);

    this.sendInitialMessages();
  }

  private async handleWebviewMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== 'object') {
      return;
    }

    const msg = message as Record<string, unknown>;

    switch (msg.type) {
      case 'addAssetDirectory': {
        this.addAssetDirectory();
        break;
      }
      case 'watchAllSessions': {
        if (typeof msg.enabled === 'boolean') {
          this.context.globalState.update(GLOBAL_STATE_KEYS.watchAllSessions, msg.enabled);
          this.fileWatcher.setWatchAllSessions(msg.enabled);
        }
        break;
      }
      case 'setSetting': {
        if (typeof msg.key === 'string' && msg.key in GLOBAL_STATE_KEYS) {
          const key = msg.key as keyof typeof GLOBAL_STATE_KEYS;
          this.context.globalState.update(GLOBAL_STATE_KEYS[key], msg.value);
        }
        break;
      }
      case 'setHooksEnabled': {
        if (typeof msg.enabled === 'boolean') {
          this.context.globalState.update(GLOBAL_STATE_KEYS.hooksEnabled, msg.enabled);
          if (msg.enabled) {
            installHooks(this.server.port, this.server.token).catch(() => {});
          } else {
            uninstallHooks().catch(() => {});
          }
        }
        break;
      }
      case 'settingsLoaded': {
        this.sendSettingsToWebview();
        break;
      }
      case 'openInspectionPanel': {
        if (typeof msg.agentId === 'number') {
          const agentId = msg.agentId;
          this.openInspectionAgentId = agentId;
          const agent = this.agentManager.getAgent(agentId);
          if (agent) {
            // Get branch async then send inspectionData
            this.agentManager.getBranch(agentId).then((branch) => {
              if (this.webviewView && this.openInspectionAgentId === agentId) {
                const data = this.agentManager.getInspectionData(agentId);
                if (data) {
                  this.webviewView.webview.postMessage({
                    type: 'inspectionData',
                    ...data,
                    branch,
                  });
                }
              }
            });
          }
        }
        break;
      }
      case 'agentAction': {
        const agentId = msg.agentId as number;
        const action = msg.action as string;
        if (action === 'interrupt') {
          const success = this.agentManager.interruptAgent(agentId);
          if (this.webviewView) {
            this.webviewView.webview.postMessage({
              type: 'agentAction',
              agentId,
              action: 'interrupt',
              payload: { success },
            });
          }
        } else if (action === 'redirect') {
          // If newCwd in payload, use it; otherwise show folder picker
          const payload = msg.payload as { newCwd?: string } | undefined;
          let newCwd = payload?.newCwd as string | undefined;
          if (!newCwd) {
            const selected = await vscode.window.showOpenDialog({
              canSelectFolders: true,
              canSelectMany: false,
              openLabel: 'Select Working Directory',
            });
            if (!selected || selected.length === 0) {
              break;
            }
            newCwd = selected[0].fsPath;
          }
          // Open new terminal in newCwd
          const terminal = vscode.window.createTerminal({
            name: `Claude (Redirected)`,
            cwd: newCwd,
          });
          terminal.sendText('claude', true);
          // Note: Full redirect implementation would reassign character to new terminal
          // For now, just acknowledge
          if (this.webviewView) {
            this.webviewView.webview.postMessage({
              type: 'agentAction',
              agentId,
              action: 'redirect',
              payload: { success: true, newCwd },
            });
          }
        }
        break;
      }
      case 'agentChatMessage': {
        const agentId = msg.agentId as number;
        const text = msg.text as string;
        if (typeof text === 'string') {
          this.agentManager.sendChatMessage(agentId, text);
        }
        break;
      }
    }
  }

  private checkVersionUpgrade(): void {
    const lastSeenVersion = this.context.globalState.get<string>(GLOBAL_STATE_KEYS.lastSeenVersion, '');
    if (lastSeenVersion !== EXTENSION_VERSION) {
      this.context.globalState.update(GLOBAL_STATE_KEYS.lastSeenVersion, EXTENSION_VERSION);
      if (this.webviewView) {
        this.webviewView.webview.postMessage({
          type: 'versionUpgraded',
          oldVersion: lastSeenVersion,
          newVersion: EXTENSION_VERSION,
        });
      }
    }
  }

  private sendSettingsToWebview(): void {
    if (!this.webviewView) {
      return;
    }

    const settings = {
      soundEnabled: this.context.globalState.get<boolean>(GLOBAL_STATE_KEYS.soundEnabled, true),
      alwaysShowLabels: this.context.globalState.get<boolean>(GLOBAL_STATE_KEYS.alwaysShowLabels, false),
      watchAllSessions: this.context.globalState.get<boolean>(GLOBAL_STATE_KEYS.watchAllSessions, false),
      hooksEnabled: this.context.globalState.get<boolean>(GLOBAL_STATE_KEYS.hooksEnabled, true),
    };

    this.webviewView.webview.postMessage({
      type: 'settingsLoaded',
      settings,
    });
  }

  private async addAssetDirectory(): Promise<void> {
    if (!this.webviewView) {
      return;
    }

    const selected = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Asset Directory',
    });

    if (!selected || selected.length === 0) {
      return;
    }

    const dirPath = selected[0].fsPath;
    const dirs = this.context.globalState.get<string[]>(GLOBAL_STATE_KEYS.externalAssetDirs, []);

    if (!dirs.includes(dirPath)) {
      dirs.push(dirPath);
      this.context.globalState.update(GLOBAL_STATE_KEYS.externalAssetDirs, dirs);
    }

    // Rescan and send updated assets to webview
    const externalAssets = getExternalAssetUris(this.context, this.webviewView.webview);
    this.webviewView.webview.postMessage({
      type: 'externalAssetsLoaded',
      assets: externalAssets,
    });
  }

  private onAgentUpdate(message: WebviewMessage): void {
    if (!this.webviewView) {
      return;
    }

    const sanitized = sanitizeMessage(message);
    this.webviewView.webview.postMessage(sanitized);

    // If inspection panel is open for this agent, send updated inspection data on relevant events
    const relevantTypes = ['toolStart', 'toolEnd', 'turnEnd'] as const;
    if (this.openInspectionAgentId !== null && relevantTypes.includes(message.type as any)) {
      const msgAgentId = 'agentId' in message ? (message as { agentId: number }).agentId : null;
      if (msgAgentId === this.openInspectionAgentId && this.webviewView) {
        const data = this.agentManager.getInspectionData(this.openInspectionAgentId);
        if (data) {
          this.webviewView.webview.postMessage({
            type: 'inspectionData',
            ...data,
            branch: this.agentManager.getAgent(this.openInspectionAgentId)?.branch ?? null,
          });
        }
      }
    }

    if (message.type === 'agentRemoved') {
      const removedId = (message as { agentId: number }).agentId;
      if (removedId === this.openInspectionAgentId) {
        this.openInspectionAgentId = null;
        if (this.webviewView) {
          this.webviewView.webview.postMessage({
            type: 'agentDisconnected',
            agentId: removedId,
          });
        }
      }
    }
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

    uninstallHooks().catch(() => {});
    this.server.stop().catch(() => {});
  }
}

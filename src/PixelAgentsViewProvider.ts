import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import { AgentManager } from './agentManager';
import { TimerManager } from './timerManager';
import { FileWatcher } from './fileWatcher';
import { getAssetUris, getExternalAssetUris } from './assetLoader';
import { loadLayout, saveLayout } from './layoutPersistence';
import { loadBoard, saveBoard } from './kanbanPersistence';
import { IDLE_TIMEOUT_MS, TASK_COMPLETION_KEYWORDS, KanbanTask } from './kanbanTypes';
import { WebviewMessage, AssetManifest } from './types';
import { PixelAgentsServer } from './server/server';
import { installHooks, uninstallHooks } from './server/providers/file/claudeHookInstaller';
import { handleHookEvent } from './server/hookEventHandler';
import { sanitizeString, isValidGithubRepo } from './utils/sanitization';
import { GithubSyncService } from './services/githubSyncService';
import { AgentActionHandler } from './services/agentActionHandler';

const EXTENSION_VERSION = '0.0.1';

const GLOBAL_STATE_KEYS = {
  soundEnabled: 'soundEnabled',
  alwaysShowLabels: 'alwaysShowLabels',
  watchAllSessions: 'watchAllSessions',
  hooksEnabled: 'hooksEnabled',
  externalAssetDirs: 'externalAssetDirs',
  lastSeenVersion: 'lastSeenVersion',
  autoAssignEnabled: 'autoAssignEnabled',
  githubRepo: 'githubRepo',
} as const;



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
    case 'layoutLoaded': {
      if (!msg.layout || typeof msg.layout !== 'object') return { type: 'layoutLoaded', layout: null };
      return { type: 'layoutLoaded', layout: msg.layout };
    }
    case 'assetsLoaded': {
      if (!msg.manifest || typeof msg.manifest !== 'object') return { type: 'assetsLoaded', manifest: null };
      return { type: 'assetsLoaded', manifest: msg.manifest };
    }
    case 'kanbanLoaded': {
      // Security: Validate board structure before sending to webview
      if (!msg.board || typeof msg.board !== 'object') return { type: 'kanbanLoaded', board: { columns: [], tasks: [] } };
      return { type: 'kanbanLoaded', board: msg.board };
    }
    case 'kanbanUpdated': {
      // Security: Validate board structure before sending to webview
      if (!msg.board || typeof msg.board !== 'object') return { type: 'kanbanUpdated', board: { columns: [], tasks: [] } };
      return { type: 'kanbanUpdated', board: msg.board };
    }
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
  private githubSyncService: GithubSyncService;
  private agentActionHandler: AgentActionHandler;
  private idleAgents = new Set<number>();
  private openInspectionAgentId: number | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.agentManager = new AgentManager();
    this.timerManager = new TimerManager();
    this.fileWatcher = new FileWatcher(this.agentManager, this.onAgentUpdate.bind(this));
    this.server = new PixelAgentsServer();
    this.githubSyncService = new GithubSyncService();
    this.agentActionHandler = new AgentActionHandler(this.agentManager, context);
  }

  private async launchAgent(bypassPermissions: boolean): Promise<void> {
    // Open directory picker or use current workspace as default
    let cwd: string | undefined;
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const selection = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Working Directory',
        defaultUri: vscode.workspace.workspaceFolders[0].uri,
      });
      if (!selection || selection.length === 0) {
        return;
      }
      cwd = selection[0].fsPath;
    } else {
      const selection = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Working Directory',
      });
      if (!selection || selection.length === 0) {
        return;
      }
      cwd = selection[0].fsPath;
    }

    // Create VS Code terminal with name 'claude'
    const terminal = vscode.window.createTerminal({
      name: 'claude',
      cwd,
    });

    // Execute claude command with absolute path (SECURITY-002)
    try {
      const { execSync } = require('child_process');
      const claudePath = execSync('which claude', { encoding: 'utf-8' }).trim();
      if (!claudePath) {
        throw new Error('Claude CLI not found');
      }
      const command = bypassPermissions
        ? `${claudePath} --dangerously-skip-permissions`
        : claudePath;
      terminal.sendText(command, true);
    } catch (error) {
      // Fall back to 'claude' if absolute path cannot be determined
      const command = bypassPermissions
        ? 'claude --dangerously-skip-permissions'
        : 'claude';
      terminal.sendText(command, true);
    }
    terminal.show();
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
        handleHookEvent(event, this.agentManager, (_agentId, msg) => {
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
    // Fire and forget - we don't want to block initialization
    this.fileWatcher.setWatchAllSessions(watchAllSessions).catch(() => {});

    this.sendInitialMessages();
  }

  private async handleWebviewMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== 'object') {
      return;
    }

    const msg = message as Record<string, unknown>;

    // Type guards for webview messages
    function isAgentActionMessage(msg: Record<string, unknown>): msg is { type: 'agentAction'; agentId: unknown; action: unknown; payload?: unknown } {
      return msg.type === 'agentAction' && typeof msg.agentId === 'number' && typeof msg.action === 'string';
    }
    function isAgentChatMessage(msg: Record<string, unknown>): msg is { type: 'agentChatMessage'; agentId: unknown; text: unknown } {
      return msg.type === 'agentChatMessage' && typeof msg.agentId === 'number' && typeof msg.text === 'string';
    }
    function isOpenInspectionPanelMessage(msg: Record<string, unknown>): msg is { type: 'openInspectionPanel'; agentId: unknown } {
      return msg.type === 'openInspectionPanel' && typeof msg.agentId === 'number';
    }
    function isKanbanUpdate(msg: Record<string, unknown>): msg is { type: 'kanbanUpdate'; board: import('./kanbanTypes').KanbanBoard } {
      return msg.type === 'kanbanUpdate' && typeof msg.board === 'object';
    }

    switch (msg.type) {
      case 'launchAgent': {
        const bypassPermissions = msg.bypassPermissions === true;
        await this.launchAgent(bypassPermissions);
        break;
      }
      case 'addAssetDirectory': {
        this.addAssetDirectory();
        break;
      }
      case 'watchAllSessions': {
        if (typeof msg.enabled === 'boolean') {
          this.context.globalState.update(GLOBAL_STATE_KEYS.watchAllSessions, msg.enabled);
          // Fire and forget - we don't want to block the message handler
          this.fileWatcher.setWatchAllSessions(msg.enabled).catch(() => {});
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
        await this.sendSettingsToWebview();
        break;
      }
      case 'openInspectionPanel': {
        if (!isOpenInspectionPanelMessage(msg)) break;
        const agentId = msg.agentId as number;
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
        break;
      }
      case 'agentAction': {
        if (!isAgentActionMessage(msg)) break;
        const agentId = msg.agentId as number;
        const action = msg.action as string;
        const agent = this.agentManager.getAgent(agentId);
        if (!agent || !agent.terminalRef) {
          if (this.webviewView) {
            this.webviewView.webview.postMessage({
              type: 'agentAction',
              agentId,
              action,
              payload: { success: false, error: 'Agent not found or no terminal' },
            });
          }
          break;
        }
        if (action === 'interrupt') {
          const success = await this.agentActionHandler.interruptAgent(agentId);
          if (this.webviewView) {
            this.webviewView.webview.postMessage({
              type: 'agentAction',
              agentId,
              action: 'interrupt',
              payload: { success },
            });
          }
        } else if (action === 'redirect') {
          const payload = msg.payload as { newCwd?: string } | undefined;
          const result = await this.agentActionHandler.redirectAgent(agentId, payload?.newCwd);
          if (this.webviewView) {
            this.webviewView.webview.postMessage({
              type: 'agentAction',
              agentId,
              action: 'redirect',
              payload: result,
            });
          }
        }
        break;
      }
      case 'agentChatMessage': {
        if (!isAgentChatMessage(msg)) break;
        const agentId = msg.agentId as number;
        const text = msg.text as string;
        const agent = this.agentManager.getAgent(agentId);
        if (!agent || !agent.terminalRef) {
          break;
        }
        await this.agentActionHandler.sendChatMessage(agentId, text);
        break;
      }
      case 'kanbanUpdate': {
        if (!isKanbanUpdate(msg)) break;
        const board = msg.board as import('./kanbanTypes').KanbanBoard;
        saveBoard(board);
        // Broadcast to all webviews
        if (this.webviewView) {
          this.webviewView.webview.postMessage({ type: 'kanbanUpdated', board });
        }
        break;
      }
      case 'kanbanLoaded': {
        const board = loadBoard();
        if (this.webviewView) {
          this.webviewView.webview.postMessage({ type: 'kanbanLoaded', board });
        }
        break;
      }
      case 'setGithubToken': {
        if (typeof msg.value === 'string') {
          if (msg.value) {
            await this.context.secrets.store('pixel-agents.githubToken', msg.value);
          } else {
            await this.context.secrets.delete('pixel-agents.githubToken');
          }
        }
        break;
      }
      case 'githubSync': {
        const githubRepo = this.context.globalState.get<string>(GLOBAL_STATE_KEYS.githubRepo, '');
        const githubToken = await this.context.secrets.get('pixel-agents.githubToken') ?? '';

        // Security: Validate GitHub repo format
        if (!githubRepo || !isValidGithubRepo(githubRepo)) {
          if (this.webviewView) {
            this.webviewView.webview.postMessage({ type: 'githubSync', result: 'error', message: 'Invalid GitHub repo format. Use owner/repo' });
          }
          break;
        }

        const result = await this.githubSyncService.syncIssues(githubRepo, githubToken);

        if (this.webviewView) {
          if (result.success) {
            const board = loadBoard();
            this.webviewView.webview.postMessage({ type: 'kanbanUpdated', board });
          }
          this.webviewView.webview.postMessage({
            type: 'githubSync',
            result: result.success ? 'success' : 'error',
            message: result.message,
          });
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

  private async sendSettingsToWebview(): Promise<void> {
    if (!this.webviewView) {
      return;
    }

    const hasGithubToken = !!(await this.context.secrets.get('pixel-agents.githubToken'));

    const settings = {
      soundEnabled: this.context.globalState.get<boolean>(GLOBAL_STATE_KEYS.soundEnabled, true),
      alwaysShowLabels: this.context.globalState.get<boolean>(GLOBAL_STATE_KEYS.alwaysShowLabels, false),
      watchAllSessions: this.context.globalState.get<boolean>(GLOBAL_STATE_KEYS.watchAllSessions, false),
      hooksEnabled: this.context.globalState.get<boolean>(GLOBAL_STATE_KEYS.hooksEnabled, true),
      autoAssignEnabled: this.context.globalState.get<boolean>(GLOBAL_STATE_KEYS.autoAssignEnabled, false),
      githubRepo: this.context.globalState.get<string>(GLOBAL_STATE_KEYS.githubRepo, ''),
      hasGithubToken,
    };

    this.webviewView.webview.postMessage({
      type: 'settingsLoaded',
      settings,
    });
  }

  private async validateAssetDirectory(dirPath: string): Promise<boolean> {
    try {
      const realPath = await fs.promises.realpath(dirPath);
      const stat = await fs.promises.stat(realPath);

      if (!stat.isDirectory()) {
        console.warn(`[Security] Asset path is not a directory: ${realPath}`);
        return false;
      }

      // Optional: Restrict to user home or specific allowed directories
      const homeDir = os.homedir();
      if (!realPath.startsWith(homeDir)) {
        console.warn(`[Security] Asset path outside home directory: ${realPath}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error(`[Security] Failed to validate asset directory: ${err}`);
      return false;
    }
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
    if (await this.validateAssetDirectory(dirPath)) {
      const dirs = this.context.globalState.get<string[]>(GLOBAL_STATE_KEYS.externalAssetDirs, []);
      if (!dirs.includes(dirPath)) {
        dirs.push(dirPath);
        await this.context.globalState.update(GLOBAL_STATE_KEYS.externalAssetDirs, dirs);
      }
    }

    // Rescan and send updated assets to webview
    const externalAssets = getExternalAssetUris(this.context, this.webviewView.webview);
    this.webviewView.webview.postMessage({
      type: 'externalAssetsLoaded',
      assets: externalAssets,
    });
  }

  private onAgentUpdate(message: WebviewMessage): void {
    const msgAgentId = 'agentId' in message ? (message as { agentId: number }).agentId : null;

    // Handle turnEnd - start idle timer (do NOT cancel idle timer here)
    if (message.type === 'turnEnd' && msgAgentId !== null) {
      const agentId = msgAgentId;
      this.timerManager.startIdleTimer(agentId, () => {
        if (this.webviewView) {
          this.webviewView.webview.postMessage({ type: 'agentIdle', agentId });
        }
      }, IDLE_TIMEOUT_MS);
    }

    // For non-turnEnd messages with an agentId: cancel permission timer AND cancel idle timer
    if (msgAgentId !== null && message.type !== 'turnEnd') {
      this.timerManager.cancelPermissionTimer(msgAgentId);
      this.timerManager.cancelIdleTimer(msgAgentId);
    }

    if (!this.webviewView) {
      return;
    }

    // Task completion detection - check for assistant records with completion keywords
    if (message.type === 'turnEnd') {
      const agentId = (message as { agentId: number }).agentId;
      const board = loadBoard();
      const assignedTask = board.tasks.find(t => t.assignedAgentId === agentId && t.status !== 'done');
      if (assignedTask) {
        // Check if the assistant's final message in this turn contains a completion keyword
        const agent = this.agentManager.getAgent(agentId);
        const assistantContent = agent?.currentTurnAssistantContent ?? '';
        const endsWithCompletionKeyword = TASK_COMPLETION_KEYWORDS.some(keyword => {
          const pattern = new RegExp(`\\b${keyword}\\b[.!?,]?\\s*$`, 'i');
          return pattern.test(assistantContent);
        });
        if (endsWithCompletionKeyword) {
          this.webviewView?.webview.postMessage({ type: 'taskMaybeComplete', agentId, taskId: assignedTask.id });
        }
      }
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

    const board = loadBoard();
    this.webviewView.webview.postMessage({ type: 'kanbanLoaded', board });
  }

  private getHtmlForWebview(): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const cspNonce = crypto.randomBytes(16).toString('base64');
    const scriptUri = this.webviewView!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'main.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.webviewView!.webview.cspSource} https: data:; style-src ${this.webviewView!.webview.cspSource} 'nonce-${cspNonce}'; script-src 'nonce-${nonce}';">
  <title>Pixel Agents</title>
  <style nonce="${cspNonce}">
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    body { background-color: #1e1e1e; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
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

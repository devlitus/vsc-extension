import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
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

const HTML_SANITIZE_PATTERN = /[<>&"']/g;
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]*$/;

// Security: Validate GitHub repository format (owner/repo)
function isValidGithubRepo(repo: string): boolean {
  if (typeof repo !== 'string' || repo.length === 0) return false;
  const valid = GITHUB_REPO_REGEX.test(repo);
  if (!valid) {
    console.error('[Security] Invalid GitHub repo format:', repo);
  }
  return valid;
}

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
  private idleAgents = new Set<number>();
  private openInspectionAgentId: number | null = null;
  private lastGithubSyncTime = 0;
  private readonly githubSyncCooldownMs = 60000; // 60 seconds

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
          const payload = msg.payload as { newCwd?: string } | undefined;
          let newCwd = payload?.newCwd as string | undefined;
          const newCwdFromPayload = !!payload?.newCwd;
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

          // Validate newCwd if from payload (not from native folder picker)
          if (newCwdFromPayload) {
            let validCwd: string | null = null;
            try {
              const real = fs.realpathSync(path.resolve(newCwd));
              if (fs.statSync(real).isDirectory()) {
                validCwd = real;
              }
            } catch { /* invalid */ }
            if (!validCwd) {
              if (this.webviewView) {
                this.webviewView.webview.postMessage({
                  type: 'agentAction',
                  agentId,
                  action: 'redirect',
                  payload: { success: false, error: 'Invalid working directory' },
                });
              }
              break;
            }
            newCwd = validCwd;
          }

          // Interrupt the current agent first
          this.agentManager.interruptAgent(agentId);

          // Open new terminal in newCwd
          const terminal = vscode.window.createTerminal({
            name: `Claude (Redirected)`,
            cwd: newCwd,
          });

          // Start claude in the new terminal
          terminal.sendText('claude', true);
          terminal.show();

          // Reassign the agent to the new terminal
          this.agentManager.reassignTerminal(agentId, terminal, newCwd);

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
        if (!isAgentChatMessage(msg)) break;
        const agentId = msg.agentId as number;
        const text = msg.text as string;
        const agent = this.agentManager.getAgent(agentId);
        if (!agent || !agent.terminalRef) {
          break;
        }
        this.agentManager.sendChatMessage(agentId, text);
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

        // Security: Rate limiting - prevent too frequent syncs
        const now = Date.now();
        if (now - this.lastGithubSyncTime < this.githubSyncCooldownMs) {
          const remainingSeconds = Math.ceil((this.githubSyncCooldownMs - (now - this.lastGithubSyncTime)) / 1000);
          if (this.webviewView) {
            this.webviewView.webview.postMessage({ type: 'githubSync', result: 'error', message: `Please wait ${remainingSeconds}s before syncing again` });
          }
          break;
        }

        try {
          const board = loadBoard();
          const headers: Record<string, string> = {
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
          };
          if (githubToken) {
            headers['Authorization'] = `Bearer ${githubToken}`;
          }
          const response = await fetch(`https://api.github.com/repos/${githubRepo}/issues`, { headers });
          if (!response.ok) {
            // Security: Don't expose internal error details
            if (response.status === 401 || response.status === 403) {
              throw new Error('Authentication failed. Please check your GitHub token.');
            } else if (response.status === 404) {
              throw new Error('Repository not found. Please check the repo format.');
            } else {
              throw new Error('Failed to fetch issues from GitHub.');
            }
          }
          // Security: Validate content-type
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Invalid response from GitHub API.');
          }
          const issues = await response.json() as Array<{ number: number; title: string; body?: string; labels?: Array<{ name: string }>; html_url: string }>;
          if (!Array.isArray(issues)) {
            throw new Error('Invalid response from GitHub API.');
          }

          // Security: Sanitize imported task descriptions to prevent XSS
          const { sanitizeMarkdown } = await import('./kanbanPersistence');

          for (const issue of issues) {
            // Skip if already imported
            if (board.tasks.some(t => t.sourceUrl === issue.html_url)) continue;
            const priority = issue.labels?.some(l => l.name === 'priority:high')
              ? 'high' as const
              : issue.labels?.some(l => l.name === 'priority:medium')
              ? 'medium' as const
              : 'low' as const;
            const task: KanbanTask = {
              id: `gh-${issue.number}-${Date.now()}`,
              title: sanitizeString(issue.title),
              description: sanitizeMarkdown(issue.body || ''),
              priority,
              status: 'backlog',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              sourceUrl: issue.html_url,
              sourceProvider: 'github',
            };
            board.tasks.push(task);
          }
          saveBoard(board);
          this.lastGithubSyncTime = Date.now();
          if (this.webviewView) {
            this.webviewView.webview.postMessage({ type: 'kanbanUpdated', board });
            this.webviewView.webview.postMessage({ type: 'githubSync', result: 'success', message: `Imported ${issues.length} issues` });
          }
        } catch (err) {
          console.error('[Error] GitHub sync failed:', err);
          if (this.webviewView) {
            // Security: Don't expose internal error details to client
            const errorMessage = err instanceof Error ? err.message : 'Failed to sync with GitHub.';
            this.webviewView.webview.postMessage({ type: 'githubSync', result: 'error', message: errorMessage });
          }
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
    const scriptUri = this.webviewView!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'main.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.webviewView!.webview.cspSource} https: data:; style-src ${this.webviewView!.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Pixel Agents</title>
  <style>
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

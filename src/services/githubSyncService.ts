import * as vscode from 'vscode';
import { KanbanBoard, KanbanTask } from '../kanbanTypes';
import { loadBoard, saveBoard, sanitizeMarkdown } from '../kanbanPersistence';
import { sanitizeString } from '../utils/sanitization';

export interface GithubSyncResult {
  success: boolean;
  imported: number;
  message?: string;
}

export class GithubSyncService {
  private lastSyncTime = 0;
  private readonly syncCooldownMs = 60000; // 60 seconds

  /**
   * Syncs GitHub issues into the Kanban board.
   *
   * Fetches issues from the specified GitHub repository and adds them
   * to the board. Skips issues that have already been imported (based
   * on sourceUrl). Maps GitHub labels to task priorities.
   *
   * @param repo - GitHub repository in "owner/repo" format
   * @param token - GitHub personal access token (optional, for private repos)
   * @returns Promise resolving to sync result with count of imported issues
   */
  async syncIssues(repo: string, token: string): Promise<GithubSyncResult> {
    // Rate limiting - prevent too frequent syncs
    const now = Date.now();
    if (now - this.lastSyncTime < this.syncCooldownMs) {
      const remainingSeconds = Math.ceil((this.syncCooldownMs - (now - this.lastSyncTime)) / 1000);
      return {
        success: false,
        imported: 0,
        message: `Please wait ${remainingSeconds}s before syncing again`,
      };
    }

    try {
      const board = loadBoard();
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`https://api.github.com/repos/${repo}/issues`, { headers });
      if (!response.ok) {
        // Security: Don't expose internal error details
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            imported: 0,
            message: 'Authentication failed. Please check your GitHub token.',
          };
        } else if (response.status === 404) {
          return {
            success: false,
            imported: 0,
            message: 'Repository not found. Please check the repo format.',
          };
        } else {
          return {
            success: false,
            imported: 0,
            message: 'Failed to fetch issues from GitHub.',
          };
        }
      }

      // Security: Validate content-type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {
          success: false,
          imported: 0,
          message: 'Invalid response from GitHub API.',
        };
      }

      const issues = await response.json() as Array<{
        number: number;
        title: string;
        body?: string;
        labels?: Array<{ name: string }>;
        html_url: string;
      }>;

      if (!Array.isArray(issues)) {
        return {
          success: false,
          imported: 0,
          message: 'Invalid response from GitHub API.',
        };
      }

      // Import new issues
      let imported = 0;
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
        imported++;
      }

      saveBoard(board);
      this.lastSyncTime = Date.now();

      return {
        success: true,
        imported,
        message: `Imported ${imported} issues`,
      };
    } catch (err) {
      console.error('[Error] GitHub sync failed:', err);
      // Security: Don't expose internal error details to client
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync with GitHub.';
      return {
        success: false,
        imported: 0,
        message: errorMessage,
      };
    }
  }

  /**
   * Gets the time until the next sync is allowed.
   *
   * @returns Milliseconds remaining until cooldown expires, or 0 if ready
   */
  getCooldownRemaining(): number {
    const now = Date.now();
    const elapsed = now - this.lastSyncTime;
    return Math.max(0, this.syncCooldownMs - elapsed);
  }
}

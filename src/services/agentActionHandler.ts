import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentManager } from '../agentManager';

/**
 * Handles agent action requests from the webview UI.
 *
 * This service encapsulates the logic for interrupting agents, redirecting
 * them to new directories, and sending chat messages. It separates these
 * concerns from the main view provider.
 */
export class AgentActionHandler {
  constructor(
    private agentManager: AgentManager,
    private context: vscode.ExtensionContext
  ) {}

  /**
   * Interrupts a running agent by sending Ctrl+C to its terminal.
   *
   * @param agentId - The ID of the agent to interrupt
   * @returns true if the agent was interrupted, false if agent not found or no terminal
   */
  async interruptAgent(agentId: number): Promise<boolean> {
    const success = this.agentManager.interruptAgent(agentId);
    return success;
  }

  /**
   * Redirects an agent to a new working directory.
   *
   * Creates a new terminal in the specified directory (or prompts the user
   * to select one if not provided), then reassigns the agent to this new terminal.
   *
   * @param agentId - The ID of the agent to redirect
   * @param newCwd - Optional new working directory path. If not provided, shows folder picker.
   * @returns Object with success boolean, newCwd, or error message
   */
  async redirectAgent(
    agentId: number,
    newCwd?: string
  ): Promise<{ success: boolean; newCwd?: string; error?: string }> {
    const agent = this.agentManager.getAgent(agentId);
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    const newCwdFromPayload = !!newCwd;

    // Show folder picker if no newCwd provided
    if (!newCwd) {
      const selected = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Working Directory',
      });
      if (!selected || selected.length === 0) {
        return { success: false, error: 'No directory selected' };
      }
      newCwd = selected[0].fsPath;
    }

    // Validate newCwd if from payload (not from native folder picker)
    if (newCwdFromPayload && newCwd) {
      let validCwd: string | null = null;
      try {
        const real = fs.realpathSync(path.resolve(newCwd));
        if (fs.statSync(real).isDirectory()) {
          validCwd = real;
        }
      } catch { /* invalid */ }
      if (!validCwd) {
        return { success: false, error: 'Invalid working directory' };
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

    // Security: Use absolute path for Claude command to prevent PATH manipulation attacks
    try {
      const { execSync } = require('child_process');
      const claudePath = execSync('which claude', { encoding: 'utf-8' }).trim();
      if (!claudePath) {
        throw new Error('Claude CLI not found');
      }
      terminal.sendText(claudePath, true);
    } catch (error) {
      // Fall back to 'claude' if absolute path cannot be determined
      // This maintains functionality while still trying to use absolute path when possible
      terminal.sendText('claude', true);
    }
    terminal.show();

    // Reassign the agent to the new terminal
    this.agentManager.reassignTerminal(agentId, terminal, newCwd);

    return { success: true, newCwd };
  }

  /**
   * Sends a chat message to an agent's terminal.
   *
   * The message is sanitized to remove control characters and validated
   * before being sent to the terminal.
   *
   * @param agentId - The ID of the agent to send the message to
   * @param text - The chat message text to send
   * @returns true if the message was sent, false if agent not found or no terminal
   */
  async sendChatMessage(agentId: number, text: string): Promise<boolean> {
    const success = this.agentManager.sendChatMessage(agentId, text);
    return success;
  }
}

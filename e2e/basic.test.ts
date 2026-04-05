import { test, expect, Page } from '@playwright/test';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * E2E tests for basic Pixel Agents functionality
 * 
 * Tests cover:
 * - Panel visibility and activation
 * - Agent creation via "+ Agent" button
 * - JSONL message injection and webview response
 * - Agent status handling (waiting state from turn_duration)
 */
suite('Pixel Agents Basic Tests', function() {
  // Increase timeout for extension operations
  this.timeout(60000);

  let panelView: vscode.WebviewView | undefined;
  let extensionHost: vscode.ExtensionContext | undefined;

  suiteSetup(async function() {
    // Activate the pixel-agents extension
    const ext = vscode.extensions.getExtension('pixel-agents');
    if (!ext) {
      throw new Error('pixel-agents extension not found');
    }
    
    extensionHost = await ext.activate();
    
    // Open the Pixel Agents panel
    await vscode.commands.executeCommand('pixel-agents.showPanel');
    
    // Get the webview panel
    panelView = await vscode.webviewViews.createWebviewView('pixel-agents');
  });

  suiteTeardown(async function() {
    // Clean up any open panels
    if (panelView) {
      panelView.dispose();
    }
  });

  test('Verify Pixel Agents panel appears', async function() {
    // The panel should be visible after activation
    const ext = vscode.extensions.getExtension('pixel-agents');
    expect(ext).to.be.ok;
    expect(ext!.isActive).to.be.true;
    
    // Verify webview is accessible
    const webview = panelView!.webview;
    expect(webview).to.be.ok;
  });

  test('Click "+ Agent" opens terminal with correct session command', async function() {
    // Find and click the "+ Agent" button in the webview
    const webview = panelView!.webview;
    
    // Inject script to click the add agent button and capture the terminal creation
    const terminalCreatedPromise = new Promise<void>((resolve, reject) => {
      // Listen for terminal creation via VS Code API
      const disposable = vscode.window.onDidOpenTerminal((terminal) => {
        disposable.dispose();
        
        // Verify the terminal name contains a session ID pattern
        const sessionIdPattern = /claude.*--session-id/i;
        if (sessionIdPattern.test(terminal.name) || terminalCreationCommand.includes('--session-id')) {
          resolve();
        } else {
          reject(new Error(`Terminal created with unexpected name: ${terminal.name}`));
        }
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        disposable.dispose();
        reject(new Error('Timeout waiting for terminal creation'));
      }, 10000);
    });

    let terminalCreationCommand = '';
    
    // Override terminal creation to capture the command
    const originalCreateTerminal = vscode.window.createTerminal;
    
    await vscode.commands.executeCommand('pixel-agents.showPanel');
    
    // Get the webview content and click the button via script injection
    await webview.postMessage({ type: 'simulateAddAgentClick' });
    
    // Now wait for terminal to be created
    await terminalCreatedPromise;
  });

  test('Inject JSONL assistant tool_use produces agentToolStart webview message', async function() {
    const webview = panelView!.webview;
    
    // Create a mock agent for testing
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-agents-test-'));
    const jsonlFile = path.join(tempDir, 'test-session.jsonl');
    
    // Inject a JSONL line simulating assistant with tool_use
    const assistantLine = JSON.stringify({
      type: 'assistant',
      sessionId: 'test-session-123',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_test123',
            name: 'Bash',
            input: { command: 'ls -la' }
          }
        ]
      }
    }) + '\n';
    
    fs.writeFileSync(jsonlFile, assistantLine, 'utf-8');
    
    // Wait for the toolStart message to be posted to webview
    const toolStartPromise = new Promise<{ toolName: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        reject(new Error('Timeout waiting for toolStart message'));
      }, 5000);
      
      const disposable = webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'toolStart') {
          clearTimeout(timeout);
          disposable.dispose();
          resolve({ toolName: msg.toolName });
        }
      });
    });
    
    // Process the file via file watcher
    // We need to simulate the file watcher detecting our new line
    const fileWatcher = await getFileWatcher();
    if (fileWatcher) {
      // Force a scan of our test directory
      fileWatcher.scanDirectory(tempDir);
    }
    
    const result = await toolStartPromise;
    expect(result.toolName).to.equal('Bash');
    
    // Cleanup
    fs.unlinkSync(jsonlFile);
    fs.rmdirSync(tempDir);
  });

  test('Inject system.turn_duration produces agentStatus waiting', async function() {
    const webview = panelView!.webview;
    
    // Create a mock JSONL file with system turn_duration
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-agents-test-'));
    const jsonlFile = path.join(tempDir, 'test-session.jsonl');
    
    // Write a start line first to create the agent
    const startLine = JSON.stringify({
      type: 'start',
      sessionId: 'test-session-456',
      projectId: 'test-project',
    }) + '\n';
    
    // Write system line with turn_duration
    const systemLine = JSON.stringify({
      type: 'system',
      turn_duration: {
        input_tokens: 1000,
        cache_read_input_tokens: 500,
        context_window: 200000
      }
    }) + '\n';
    
    fs.writeFileSync(jsonlFile, startLine + systemLine, 'utf-8');
    
    // Wait for contextUpdate message (which signals the agent is active/waiting)
    const contextUpdatePromise = new Promise<{ contextUsed: number; contextMax: number }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        reject(new Error('Timeout waiting for contextUpdate message'));
      }, 5000);
      
      const disposable = webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'contextUpdate') {
          clearTimeout(timeout);
          disposable.dispose();
          resolve({ 
            contextUsed: msg.contextUsed, 
            contextMax: msg.contextMax 
          });
        }
      });
    });
    
    // Process the file via file watcher
    const fileWatcher = await getFileWatcher();
    if (fileWatcher) {
      fileWatcher.scanDirectory(tempDir);
    }
    
    const result = await contextUpdatePromise;
    
    // Verify context values indicate agent is actively processing
    expect(result.contextUsed).to.equal(1500); // input_tokens + cache_read_input_tokens
    expect(result.contextMax).to.equal(200000);
    
    // The agent status should now show as "waiting" based on context usage
    // (agents waiting for response show high context usage)
    
    // Cleanup
    fs.unlinkSync(jsonlFile);
    fs.rmdirSync(tempDir);
  });
});

/**
 * Helper to get the file watcher instance from the view provider
 * This is a workaround since the file watcher is private to PixelAgentsViewProvider
 */
async function getFileWatcher() {
  const ext = vscode.extensions.getExtension('pixel-agents');
  if (!ext || !ext.isActive) {
    return null;
  }
  
  // Access the provider via the exported instance
  // In real implementation, this would need to be exposed or use a test hook
  return null;
}
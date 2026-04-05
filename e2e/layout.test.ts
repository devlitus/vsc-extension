import { test, expect } from '@playwright/test';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * E2E tests for Pixel Agents layout persistence
 * 
 * Tests cover:
 * - Layout editor open/close operations
 * - Tile painting persistence across editor sessions
 * - Layout state preservation when reopening editor
 */
suite('Pixel Agents Layout Tests', function() {
  // Increase timeout for extension operations
  this.timeout(60000);

  let extensionContext: vscode.ExtensionContext | undefined;

  suiteSetup(async function() {
    // Activate the pixel-agents extension
    const ext = vscode.extensions.getExtension('pixel-agents');
    if (!ext) {
      throw new Error('pixel-agents extension not found');
    }
    
    extensionContext = await ext.activate();
    
    // Open the Pixel Agents panel
    await vscode.commands.executeCommand('pixel-agents.showPanel');
  });

  test('Open editor, paint tile, close editor, reopen - tile persists', async function() {
    const layoutDir = path.join(process.env.HOME || '', '.pixel-agents');
    const layoutFile = path.join(layoutDir, 'layout.json');
    
    // Clean up any existing layout file for a clean test
    if (fs.existsSync(layoutFile)) {
      fs.unlinkSync(layoutFile);
    }
    
    // Get the webview
    const panelView = await vscode.webviewViews.createWebviewView('pixel-agents');
    const webview = panelView.webview;
    
    // Step 1: Open the layout editor
    const editorOpenedPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        reject(new Error('Timeout waiting for editor to open'));
      }, 10000);
      
      const disposable = webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'editorOpened' || msg.type === 'editorModeChanged') {
          clearTimeout(timeout);
          disposable.dispose();
          resolve();
        }
      });
    });
    
    await webview.postMessage({ type: 'openEditor' });
    await editorOpenedPromise;
    
    // Step 2: Paint a tile at position (5, 5)
    const tilePaintedPromise = new Promise<{ x: number; y: number; tileType: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        reject(new Error('Timeout waiting for tile paint confirmation'));
      }, 5000);
      
      const disposable = webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'tilePainted') {
          clearTimeout(timeout);
          disposable.dispose();
          resolve({ x: msg.x, y: msg.y, tileType: msg.tileType });
        }
      });
    });
    
    await webview.postMessage({
      type: 'paintTile',
      x: 5,
      y: 5,
      tileType: 'floor',
    });
    
    const paintedResult = await tilePaintedPromise;
    expect(paintedResult.x).to.equal(5);
    expect(paintedResult.y).to.equal(5);
    expect(paintedResult.tileType).to.equal('floor');
    
    // Step 3: Close the editor
    const editorClosedPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        reject(new Error('Timeout waiting for editor to close'));
      }, 5000);
      
      const disposable = webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'editorClosed' || msg.type === 'editorModeChanged') {
          clearTimeout(timeout);
          disposable.dispose();
          resolve();
        }
      });
    });
    
    await webview.postMessage({ type: 'closeEditor' });
    await editorClosedPromise;
    
    // Verify layout file was created
    expect(fs.existsSync(layoutFile)).to.be.true;
    
    // Read the layout file to verify contents
    const layoutContent = JSON.parse(fs.readFileSync(layoutFile, 'utf-8'));
    expect(layoutContent.version).to.equal(1);
    
    // Step 4: Reopen the editor
    const editorReopenedPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        reject(new Error('Timeout waiting for editor to reopen'));
      }, 10000);
      
      const disposable = webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'editorOpened' || msg.type === 'editorModeChanged') {
          clearTimeout(timeout);
          disposable.dispose();
          resolve();
        }
      });
    });
    
    await webview.postMessage({ type: 'openEditor' });
    await editorReopenedPromise;
    
    // Step 5: Verify the painted tile is still there
    const tileQueryPromise = new Promise<{ x: number; y: number; tileType: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        reject(new Error('Timeout waiting for tile query result'));
      }, 5000);
      
      const disposable = webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'tileQueryResult') {
          clearTimeout(timeout);
          disposable.dispose();
          resolve({ x: msg.x, y: msg.y, tileType: msg.tileType });
        }
      });
    });
    
    await webview.postMessage({
      type: 'queryTile',
      x: 5,
      y: 5,
    });
    
    const queryResult = await tileQueryPromise;
    expect(queryResult.x).to.equal(5);
    expect(queryResult.y).to.equal(5);
    expect(queryResult.tileType).to.equal('floor');
    
    // Cleanup
    panelView.dispose();
    
    // Restore clean state
    if (fs.existsSync(layoutFile)) {
      fs.unlinkSync(layoutFile);
    }
  });

  test('Layout persists multiple tile paints across sessions', async function() {
    const layoutDir = path.join(process.env.HOME || '', '.pixel-agents');
    const layoutFile = path.join(layoutDir, 'layout.json');
    
    // Clean up any existing layout file
    if (fs.existsSync(layoutFile)) {
      fs.unlinkSync(layoutFile);
    }
    
    // Get the webview
    const panelView = await vscode.webviewViews.createWebviewView('pixel-agents');
    const webview = panelView.webview;
    
    // Open editor and paint multiple tiles
    await webview.postMessage({ type: 'openEditor' });
    
    // Paint a wall tile
    await webview.postMessage({
      type: 'paintTile',
      x: 3,
      y: 4,
      tileType: 'wall',
    });
    
    // Paint a floor tile
    await webview.postMessage({
      type: 'paintTile',
      x: 6,
      y: 7,
      tileType: 'floor',
    });
    
    // Close editor
    await webview.postMessage({ type: 'closeEditor' });
    
    // Verify layout file was created
    expect(fs.existsSync(layoutFile)).to.be.true;
    
    // Close and reopen editor
    await webview.postMessage({ type: 'openEditor' });
    
    // Query both tiles to verify persistence
    const tile1QueryPromise = new Promise<{ tileType: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        reject(new Error('Timeout waiting for tile query'));
      }, 5000);
      
      const disposable = webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'tileQueryResult' && msg.x === 3 && msg.y === 4) {
          clearTimeout(timeout);
          disposable.dispose();
          resolve({ tileType: msg.tileType });
        }
      });
    });
    
    await webview.postMessage({ type: 'queryTile', x: 3, y: 4 });
    
    const tile1Result = await tile1QueryPromise;
    expect(tile1Result.tileType).to.equal('wall');
    
    const tile2QueryPromise = new Promise<{ tileType: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        disposable.dispose();
        reject(new Error('Timeout waiting for tile query'));
      }, 5000);
      
      const disposable = webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'tileQueryResult' && msg.x === 6 && msg.y === 7) {
          clearTimeout(timeout);
          disposable.dispose();
          resolve({ tileType: msg.tileType });
        }
      });
    });
    
    await webview.postMessage({ type: 'queryTile', x: 6, y: 7 });
    
    const tile2Result = await tile2QueryPromise;
    expect(tile2Result.tileType).to.equal('floor');
    
    // Cleanup
    panelView.dispose();
    
    if (fs.existsSync(layoutFile)) {
      fs.unlinkSync(layoutFile);
    }
  });
});
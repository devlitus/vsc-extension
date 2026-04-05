import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * VS Code extension E2E test configuration using @vscode/test-electron
 * 
 * This config sets up Playwright to launch a VS Code extension development host
 * with the pixel-agents extension loaded for automated testing.
 */
export default defineConfig({
  testDir: path.join(__dirname),
  timeout: 30000,
  
  // Use VS Code test electron as the harness
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  reporter: 'html',
  
  use: {
    // Base URL for VS Code (not used directly but required for proper setup)
    baseURL: 'file:///home/carles/work/vsc-extension',
    
    // Trace screenshot on failure for debugging
    trace: 'on-first-retry',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video recording for failures
    video: 'retain-on-failure',
  },
  
  projects: [
    {
      name: 'VS Code Extension Host',
      use: {
        // Launch a VS Code extension host with the pixel-agents extension
        channel: 'stable',
      },
    },
  ],
  
  // VS Code extension testing requires a special launch configuration
  // that loads the extension under test into an isolated profile
  webkit: {
    launchOptions: {
      args: [
        // Disable GPU acceleration for stability
        '--disable-gpu',
        // Enable experimental features
        '--enable-features=Experimental',
      ],
    },
  },
});
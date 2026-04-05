import * as vscode from 'vscode';

export class PixelAgentsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'pixel-agents';
  
  private webviewView: vscode.WebviewView | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
    };
    
    webviewView.webview.html = this.getHtmlForWebview();
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
    // No-op for now
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

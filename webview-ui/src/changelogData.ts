export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.0',
    date: 'April 5, 2026',
    changes: [
      'Initial release of Pixel Agents',
      'Agent visualization with character animations',
      'Office layout editor with paint, erase, and place tools',
      'Permission request bubbles for tool execution',
      'JSONL transcript parsing from Claude Code sessions',
      'Hook server integration for real-time event delivery',
    ],
  },
  {
    version: '0.1.0',
    date: 'March 15, 2026',
    changes: [
      'Beta preview release',
      'Basic agent state tracking',
      'File watcher for session JSONL files',
      'Webview panel with office visualization',
      'Character pathfinding and movement',
    ],
  },
];

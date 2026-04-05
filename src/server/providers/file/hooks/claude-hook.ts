export function createHookScript(port: number, token: string): string {
  return `#!/bin/bash
set -e
exec curl -s -X POST http://127.0.0.1:${port}/api/hooks/claude \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d @-`;
}
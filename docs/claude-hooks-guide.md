# Claude Code Hooks and Tools Guide

This guide explains how Claude Code hooks work, what tools are available, and how to integrate them into your own extensions and workflows.

## What Are Hooks?

Hooks are event notifications that Claude Code sends when specific actions happen during a conversation. Think of them as triggers that let your code react to what Claude is doing — like when it's about to use a tool, when it finishes using a tool, or when a conversation ends.

Hooks are defined in `~/.claude/settings.json` and execute shell commands when events occur. They receive JSON data about the event via stdin, making them perfect for:

- Monitoring Claude's activity
- Building visualization dashboards (like this extension)
- Logging and analytics
- Custom integrations with other tools

## Available Hooks

### PreToolUse

Fires **before** a tool executes. This is your chance to see what Claude is about to do and prepare accordingly.

**Payload:**
```json
{
  "sessionId": "string",
  "toolName": "Read|Write|Edit|Bash|WebSearch|WebFetch|Task|Agent",
  "toolInput": { ... }
}
```

**Use cases:**
- Log what tools are being used
- Track file access patterns
- Prepare resources before operations
- Validate tool inputs

**Example:**
```bash
# Log that Claude is about to read a file
echo "About to read: $toolInput.filePath" >> claude-activity.log
```

### PostToolUse

Fires **after** a tool completes execution. This gives you the result of the operation.

**Payload:**
```json
{
  "sessionId": "string",
  "toolName": "Read|Write|Edit|Bash|WebSearch|WebFetch|Task|Agent",
  "toolResult": { ... }
}
```

**Use cases:**
- Record tool execution results
- Track success/failure rates
- Capture output for analysis
- Trigger follow-up actions

**Example:**
```bash
# Log successful file writes
if [ "$toolName" = "Write" ]; then
  echo "Wrote file: $toolResult.path" >> claude-activity.log
fi
```

### Stop

Fires when a turn ends (when Claude finishes responding to a user message). This is a natural breakpoint in the conversation.

**Payload:**
```json
{
  "sessionId": "string"
}
```

**Use cases:**
- Mark the end of a logical unit of work
- Calculate turn duration
- Trigger batch processing
- Clean up temporary resources

**Example:**
```bash
# Log turn completion with timestamp
echo "$(date -Iseconds): Turn ended for session $sessionId" >> turns.log
```

### SubagentStop

Fires when a subagent (a specialized agent launched via the Agent tool) completes its task. Subagents are used for specialized work like exploring codebases or creating plans.

**Payload:**
```json
{
  "sessionId": "string"
}
```

**Use cases:**
- Track subagent lifecycle
- Measure subagent performance
- Coordinate complex workflows that use multiple agents
- Update visualizations (like the office view in this extension)

**Example:**
```bash
# Notify that a subagent finished
echo "Subagent completed: $sessionId" >> subagents.log
```

## Built-In Tools

Claude Code has several categories of tools that hooks can monitor:

### File Operations

| Tool | Purpose | Common Inputs |
|------|---------|---------------|
| **Read** | Read file contents | `filePath`, `offset`, `limit`, `pages` (for PDFs) |
| **Write** | Create or completely overwrite a file | `filePath`, `content` |
| **Edit** | Make precise string replacements | `filePath`, `oldString`, `newString`, `replaceAll` |
| **Create** | Create new files (variant of Write) | `filePath`, `content` |

**Example PreToolUse payload for Read:**
```json
{
  "sessionId": "12345",
  "toolName": "Read",
  "toolInput": {
    "filePath": "/home/user/project/src/app.ts",
    "offset": 0,
    "limit": 100
  }
}
```

### Command Execution

| Tool | Purpose | Common Inputs |
|------|---------|---------------|
| **Bash** | Execute shell commands | `command`, `timeout` |

**Example PostToolUse payload for Bash:**
```json
{
  "sessionId": "12345",
  "toolName": "Bash",
  "toolResult": {
    "exitCode": 0,
    "stdout": "Build completed successfully\n",
    "stderr": ""
  }
}
```

### Web Operations

| Tool | Purpose | Common Inputs |
|------|---------|---------------|
| **WebSearch** | Search the web | `query` |
| **WebFetch** | Fetch web page content | `url` |

### Subagent Tools

| Tool | Purpose | Subagent Types |
|------|---------|----------------|
| **Task** | Launch a general-purpose subagent | general-purpose |
| **Agent** | Launch a specialized subagent | general-purpose, Explore, Plan, claude-code-guide |

**Subagent types:**
- **general-purpose**: Handles most coding tasks
- **Explore**: Quickly searches through large codebases
- **Plan**: Designs architectures and implementation strategies
- **claude-code-guide**: Answers questions about Claude Code itself

**Example PreToolUse payload for Agent:**
```json
{
  "sessionId": "12345",
  "toolName": "Agent",
  "toolInput": {
    "agentType": "Explore",
    "task": "Find all files that use the AgentManager class"
  }
}
```

## Hook Configuration

Hooks are configured in `~/.claude/settings.json` using a specific format. Here's how to set them up:

### Configuration Format

```json
{
  "hooks": [
    {
      "type": "command",
      "matcher": "PreToolUse",
      "command": "curl -s -X POST http://127.0.0.1:37291/hook/pre-tool-use -H 'Content-Type: application/json' -H 'Authorization: Bearer YOUR_TOKEN' --data-binary @- --max-time 2 || true"
    },
    {
      "type": "command",
      "matcher": "PostToolUse",
      "command": "curl -s -X POST http://127.0.0.1:37291/hook/post-tool-use -H 'Content-Type: application/json' -H 'Authorization: Bearer YOUR_TOKEN' --data-binary @- --max-time 2 || true"
    },
    {
      "type": "command",
      "matcher": "Stop",
      "command": "curl -s -X POST http://127.0.0.1:37291/hook/stop -H 'Content-Type: application/json' -H 'Authorization: Bearer YOUR_TOKEN' --data-binary @- --max-time 2 || true"
    },
    {
      "type": "command",
      "matcher": "SubagentStop",
      "command": "curl -s -X POST http://127.0.0.1:37291/hook/subagent-stop -H 'Content-Type: application/json' -H 'Authorization: Bearer YOUR_TOKEN' --data-binary @- --max-time 2 || true"
    }
  ]
}
```

### Breaking Down the Configuration

**`type`: Always `"command"`**
This tells Claude Code that the hook should execute a shell command.

**`matcher`: The event to listen for**
Must match one of the hook names: `PreToolUse`, `PostToolUse`, `Stop`, or `SubagentStop`.

**`command`: The shell command to execute**
This command will receive JSON via stdin. The command should:
- Accept JSON on stdin (`--data-binary @-` reads from stdin)
- Handle timeouts gracefully (`--max-time 2`)
- Fail silently if necessary (`|| true`)

## Execution Flow

Here's the sequence of events when Claude uses a tool:

```
1. User sends a message to Claude
   ↓
2. Claude decides to use a tool
   ↓
3. PreToolUse hook fires (with toolName and toolInput)
   ↓
4. Tool executes (Read, Write, Bash, etc.)
   ↓
5. PostToolUse hook fires (with toolName and toolResult)
   ↓
6. Claude continues or finishes its response
   ↓
7. Turn ends → Stop hook fires (with sessionId)
   ↓
(If a subagent was used)
8. SubagentStop hook fires (with sessionId)
```

**Key points:**
- PreToolUse and PostToolUse are paired around every tool execution
- Stop fires once per user turn, after all tools have been used
- SubagentStop fires only when a subagent completes (not every turn)
- Multiple tools can be used in a single turn, generating multiple PreToolUse/PostToolUse pairs

## Practical Examples

### Basic Hook: Logging to a File

```json
{
  "type": "command",
  "matcher": "PreToolUse",
  "command": "cat >> ~/claude-hooks.log && echo '' >> ~/claude-hooks.log"
}
```

This simply appends the JSON payload to a log file.

### HTTP POST Hook: Sending to a Local Server

```json
{
  "type": "command",
  "matcher": "PreToolUse",
  "command": "curl -s -X POST http://127.0.0.1:37291/hook/pre-tool-use -H 'Content-Type: application/json' -H 'Authorization: Bearer YOUR_TOKEN' --data-binary @- --max-time 2 || true"
}
```

This is the pattern used in this extension. Let's break down why:

**`--data-binary @-`**: Reads JSON from stdin and sends it in the request body.

**`--max-time 2`**: Critical! Prevents the hook from blocking Claude if your server is slow or unresponsive. The hook times out after 2 seconds.

**`|| true`**: Ensures the hook never fails, even if the curl command errors. This prevents Claude from being disrupted if your integration is temporarily unavailable.

**Bearer token authentication**: The server validates this token using `timingSafeEqual` to prevent timing attacks.

### Filtering by Tool Type

You can use shell scripting to filter events:

```json
{
  "type": "command",
  "matcher": "PostToolUse",
  "command": "if jq -e '.toolName == \"Write\"' >/dev/null; then curl -s -X POST http://localhost:37291/write -H 'Content-Type: application/json' --data-binary @-; fi || true"
}
```

This only sends PostToolUse events for Write operations.

### Tracking File Access

```json
{
  "type": "command",
  "matcher": "PreToolUse",
  "command": "jq -r '.toolInput.filePath // empty' >> ~/claude-file-access.log || true"
}
```

This extracts just the file path from the input and logs it.

## Security Best Practices

### 1. Use Atomic Writes

When modifying `~/.claude/settings.json`, always write atomically to prevent corruption:

```typescript
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function updateSettings(newSettings: any) {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const tempPath = `${settingsPath}.tmp`;

  // Write to temporary file first
  fs.writeFileSync(tempPath, JSON.stringify(newSettings, null, 2), 'utf8');

  // Atomic rename (works on Unix and Windows)
  fs.renameSync(tempPath, settingsPath);
}
```

### 2. Protect Your Token

Store tokens securely and validate them carefully:

```typescript
import * as crypto from 'crypto';

// Generate a secure random token
const token = crypto.randomBytes(32).toString('hex');

// Validate tokens using timing-safe comparison to prevent timing attacks
function isValidToken(received: string, expected: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(received, 'utf8'),
    Buffer.from(expected, 'utf8')
  );
}
```

### 3. Set Proper File Permissions

Ensure your hook files and settings have restrictive permissions:

```bash
# Settings should be readable only by you
chmod 600 ~/.claude/settings.json

# Log files can be world-readable if they don't contain secrets
chmod 644 ~/claude-hooks.log
```

### 4. Always Use Timeouts

Never omit `--max-time` from curl commands in hooks. A slow or hanging hook can block Claude's entire workflow:

```bash
# Good: Times out after 2 seconds
curl -s -X POST http://localhost:37291/hook --data-binary @- --max-time 2 || true

# Bad: Could hang indefinitely
curl -s -X POST http://localhost:37291/hook --data-binary @-
```

### 5. Handle Silent Failures

Use `|| true` to ensure hook failures don't disrupt Claude:

```bash
# This won't stop Claude if your server is down
curl -s -X POST http://localhost:37291/hook --data-binary @- --max-time 2 || true
```

### 6. Validate Input

Always validate JSON before processing:

```typescript
import Ajv from 'ajv';

const schema = {
  type: 'object',
  properties: {
    sessionId: { type: 'string' },
    toolName: { type: 'string' },
    toolInput: { type: 'object' }
  },
  required: ['sessionId', 'toolName']
};

const ajv = new Ajv();
const validate = ajv.compile(schema);

function handleHookEvent(data: unknown) {
  if (!validate(data)) {
    console.error('Invalid hook payload:', validate.errors);
    return;
  }
  // Process valid data...
}
```

## Preventing Duplicate Events

In this extension, hooks can fire multiple times for the same event (e.g., when watching multiple sessions). To handle duplicates:

### 1. Use a `hookDelivered` Flag

```typescript
interface AgentState {
  id: number;
  sessionId: string;
  hookDelivered: boolean;
}

function handleHookEvent(sessionId: string) {
  const agent = findAgentBySessionId(sessionId);
  if (agent && agent.hookDelivered) {
    return; // Already processed this event
  }
  // Process event...
  if (agent) {
    agent.hookDelivered = true;
  }
}
```

### 2. Reset the Flag Appropriately

Reset `hookDelivered` when starting a new turn (on Stop events) or when you know a new event cycle begins:

```typescript
function handleStopEvent(sessionId: string) {
  const agent = findAgentBySessionId(sessionId);
  if (agent) {
    agent.hookDelivered = false; // Ready for next cycle
  }
}
```

### 3. Dedupe by Event Type and Timestamp

If you need more sophisticated deduplication:

```typescript
interface EventCache {
  [key: string]: number; // Maps eventKey to timestamp
}

const eventCache: EventCache = {};

function isDuplicate(sessionId: string, eventType: string): boolean {
  const key = `${sessionId}:${eventType}`;
  const now = Date.now();

  if (eventCache[key] && (now - eventCache[key] < 1000)) {
    return true; // Same event within 1 second
  }

  eventCache[key] = now;
  return false;
}
```

## Building a Hook Integration Server

Here's a minimal example of an HTTP server that receives hook events:

```typescript
import * as http from 'http';
import * as crypto from 'crypto';

const PORT = 37291;
const AUTH_TOKEN = crypto.randomBytes(32).toString('hex');

const server = http.createServer((req, res) => {
  // Validate authorization
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401);
    res.end('Unauthorized');
    return;
  }

  const receivedToken = authHeader.slice(7); // Remove 'Bearer ' prefix
  if (!crypto.timingSafeEqual(
    Buffer.from(receivedToken, 'utf8'),
    Buffer.from(AUTH_TOKEN, 'utf8')
  )) {
    res.writeHead(401);
    res.end('Unauthorized');
    return;
  }

  // Read request body
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const event = JSON.parse(body);
      console.log('Received hook:', event);

      // Process event based on URL path
      if (req.url === '/hook/pre-tool-use') {
        handlePreToolUse(event);
      } else if (req.url === '/hook/post-tool-use') {
        handlePostToolUse(event);
      } else if (req.url === '/hook/stop') {
        handleStop(event);
      } else if (req.url === '/hook/subagent-stop') {
        handleSubagentStop(event);
      }

      res.writeHead(200);
      res.end('OK');
    } catch (error) {
      console.error('Error processing hook:', error);
      res.writeHead(400);
      res.end('Bad Request');
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Hook server listening on http://127.0.0.1:${PORT}`);
  console.log(`Auth token: ${AUTH_TOKEN}`);
});

function handlePreToolUse(event: any) {
  console.log(`Tool ${event.toolName} about to execute`);
}

function handlePostToolUse(event: any) {
  console.log(`Tool ${event.toolName} completed`);
}

function handleStop(event: any) {
  console.log(`Turn ended for session ${event.sessionId}`);
}

function handleSubagentStop(event: any) {
  console.log(`Subagent completed: ${event.sessionId}`);
}
```

## Testing Your Hooks

### Test Hook Configuration

Verify your hooks are configured correctly:

```bash
# Read current settings
cat ~/.claude/settings.json | jq '.hooks'

# Test that JSON is valid
cat ~/.claude/settings.json | jq empty && echo "Valid JSON" || echo "Invalid JSON"
```

### Test Hook Delivery

Manually trigger a hook to ensure it works:

```bash
# Simulate a PreToolUse event
echo '{"sessionId":"test","toolName":"Read","toolInput":{"filePath":"/tmp/test.txt"}}' | \
  curl -s -X POST http://127.0.0.1:37291/hook/pre-tool-use \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer YOUR_TOKEN' \
    --data-binary @-
```

### Monitor Hook Activity

Watch your log files or server output in real-time:

```bash
# Tail the log file
tail -f ~/claude-hooks.log

# Watch server output
journalctl -u your-hook-service -f
```

## Common Issues and Solutions

### Issue: Hooks Not Firing

**Possible causes:**
- Hooks not configured in `~/.claude/settings.json`
- JSON syntax error in settings file
- Matcher name misspelled

**Solution:**
```bash
# Validate settings JSON
jq empty ~/.claude/settings.json

# Check hooks are present
jq '.hooks | length' ~/.claude/settings.json
```

### Issue: Hooks Blocking Claude

**Symptom:** Claude appears to hang or respond slowly.

**Cause:** Hook command not timing out properly.

**Solution:**
```bash
# Always include --max-time and || true
curl -s -X POST http://localhost:37291/hook \
  --data-binary @- --max-time 2 || true
```

### Issue: Duplicate Events

**Cause:** Multiple hooks matching the same event, or hook firing multiple times.

**Solution:**
- Check for duplicate hook entries in settings
- Implement deduplication logic in your server (see "Preventing Duplicate Events" above)
- Ensure `hookDelivered` flag is managed correctly

### Issue: Permission Denied

**Cause:** File permissions are too restrictive.

**Solution:**
```bash
# Ensure Claude can read settings
chmod 644 ~/.claude/settings.json

# Ensure your hook script is executable (if using a script)
chmod +x ~/my-hook-script.sh
```

## Integration with This Extension

The Work Agents extension uses hooks to maintain a real-time view of Claude's activity:

1. **Hook Installation**: The extension writes hook commands to `~/.claude/settings.json`
2. **Server Startup**: Starts a local HTTP server (`127.0.0.1:0`) that receives hook POSTs
3. **Event Processing**: Each hook event updates the agent state
4. **Visualization**: The office view reflects current agent activity

Key files in this extension:
- `src/claudeHookInstaller.ts`: Manages hook configuration
- `src/PixelAgentsServer.ts`: HTTP server that receives hooks
- `src/AgentManager.ts`: Maintains agent state from hook events
- `webview-ui/src/office/officeState.ts`: State that drives the visualization

## Summary

Claude Code hooks provide a powerful way to monitor and integrate with Claude's activity in real-time. Key takeaways:

- **Four hook types**: PreToolUse, PostToolUse, Stop, SubagentStop
- **Configuration**: Hooks defined in `~/.claude/settings.json`
- **Security**: Use timeouts, silent failures, atomic writes, and token validation
- **Reliability**: Implement deduplication and error handling
- **Integration**: Build HTTP servers to receive and process hook events

With hooks, you can build sophisticated tools that understand and visualize Claude's workflow — just like this extension's office view of running agents.

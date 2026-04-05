# Phase 2 — Agents: Architecture

This document describes the architecture of the Phase 2 agents system.

## Component Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VS Code Extension                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   FileWatcher   │───▶│  AgentManager   │───▶│    Webview      │  │
│  └────────┬────────┘    └─────────────────┘    └─────────────────┘  │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                          │
│  │TranscriptParser │    │  TimerManager   │                          │
│  └────────┬────────┘    └─────────────────┘                          │
│           │                                                             │
└───────────┼───────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      File System                                      │
│  ~/.claude/projects/<project>/sessions.jsonl                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### FileWatcher

Monitors Claude Code session files and terminal lifecycle.

**Key responsibilities:**
- Poll `~/.claude/projects/` every 500ms for new/changed session files
- Track file offsets to only read new lines (supports partial line buffering)
- Listen for terminal open/close events to associate/disassociate agents
- Detect terminals named "claude" for automatic agent binding

**Public API:**
```typescript
class FileWatcher {
  constructor(agentManager: AgentManager, onAgentUpdate: AgentUpdateCallback)
  start(): void
  stop(): void
  dispose(): void
}
```

### AgentManager

Manages the lifecycle of all agent instances.

**Key responsibilities:**
- Create agents with unique IDs (positive for terminal agents, negative for external)
- Track all active agents in a Map
- Provide lookup methods for individual and bulk agent retrieval
- Handle agent removal

**Public API:**
```typescript
class AgentManager {
  createAgent(sessionId: string, projectDir: string, jsonlFile: string, terminal?: Terminal): AgentState
  removeAgent(id: number): void
  getAgent(id: number): AgentState | undefined
  getAllAgents(): AgentState[]
}
```

### TimerManager

Manages permission timeout timers for agents.

**Key responsibilities:**
- Start/cancel per-agent permission timers
- Automatically cancel timers when agents are removed
- Dispose all timers on extension shutdown

**Public API:**
```typescript
class TimerManager {
  startPermissionTimer(agentId: number, onTimeout: () => void, ms: number): void
  cancelTimer(agentId: number): void
  disposeAll(): void
}
```

### TranscriptParser

Parses JSONL transcript lines and converts them to webview messages.

**Key responsibilities:**
- Parse JSON lines from session files
- Handle different message types (start, tool, progress, turn, permission)
- Apply prototype pollution protection during cloning
- Format tool status for display (truncation, path extraction)

**Public API:**
```typescript
function processTranscriptLine(line: string, agentState: AgentState, onUpdate: (message: WebviewMessage) => void): void
function deepCloneWithProtection<T>(obj: T): T
function formatToolStatus(toolName: string, status: string): string
```

## Data Flow

### JSONL to Webview Message Pipeline

```
sessions.jsonl
     │
     ▼
┌────────────────┐
│  FileWatcher   │  1. Read bytes from fileOffset
│  readNewLines  │  2. Buffer partial lines
└───────┬────────┘  3. Split by newline
        │
        ▼
┌────────────────┐
│  FileWatcher   │  For each complete line:
│  poll() loop   │  processTranscriptLine(line, agent, callback)
└───────┬────────┘
        │
        ▼
┌────────────────┐
│TranscriptParser│  1. JSON.parse(line)
│processTranscript│ 2. deepCloneWithProtection (security)
│    Line()      │  3. Validate with isWebviewMessage
└───────┬────────┘  4. Switch on record.type
        │
        ▼
┌────────────────┐
│  WebviewMessage│  Types:
│     types      │  - agentAdded, agentRemoved
│                │  - toolStart, toolEnd, toolProgress
│                │  - turnEnd, permissionRequest
└───────┬────────┘
        │
        ▼
┌────────────────┐
│    Webview     │  Messages posted via
│    (React)     │  vscode.postMessage
└────────────────┘
```

### Transcript Record Types

| Record Type | Action | Webview Message |
|------------|--------|-----------------|
| `start` | (session start) | `agentAdded` |
| `tool` | `start` | `toolStart` |
| `tool` | `result` / `end` | `toolEnd` |
| `progress` | (tool progress) | `toolProgress` |
| `turn` | `end` | `turnEnd` |
| `permission` | (tool requires permission) | `permissionRequest` |

## Agent Lifecycle

### Creation

Agents are created in two scenarios:

**1. Terminal Agent (positive ID)**
```
User opens terminal named "claude"
    │
    ▼
FileWatcher.onDidOpenTerminal()
    │
    ▼
findProjectDirsForTerminal() → sessions.jsonl path
    │
    ▼
AgentManager.createAgent(..., terminal)
    │  ID = nextPositiveId++ (1, 2, 3...)
    ▼
Agent added to agents Map
```

**2. External Agent (negative ID)**
```
FileWatcher.poll() detects new sessions.jsonl
    │
    ▼
processProjectDir() finds no existing agent
    │
    ▼
AgentManager.createAgent(projectDir, sessionsFile)
    │  ID = nextNegativeId-- (-1, -2, -3...)
    ▼
Agent marked as isExternal = true
```

### Tracking

Agents are tracked by:
- `id`: Unique identifier (positive for terminal, negative for external)
- `projectDir`: Project folder path
- `sessionId`: Claude session identifier
- `fileOffset`: Last read position in JSONL file
- `lineBuffer`: Partial line being accumulated
- `activeToolIds`, `activeToolStatuses`, `activeToolNames`: Current tool state

### Removal

Agents are removed when:
- Terminal agent's terminal is closed → `disassociateTerminal()`
- Explicit removal via `removeAgent(id)`

## Terminal Association Logic

### Association Rules

1. **Terminal Name Match**: Only terminals named exactly `"claude"` are associated
2. **Single Agent Per Terminal**: A terminal can only have one agent
3. **Single Terminal Per Project**: A project session can only have one terminal agent
4. **External Fallback**: If no terminal exists for a session, an external agent is created

### Association Flow

```
Terminal "claude" opened
    │
    ▼
FileWatcher.onDidOpenTerminal(terminal)
    │
    ▼
Check if terminal already associated
    │  Yes → return (already has agent)
    │  No → continue
    ▼
findProjectDirsForTerminal()
    │
    ▼
For each project dir:
    │  sessions.jsonl exists → create agent with terminal
    │  sessions.jsonl not found → continue
    ▼
Agent created with terminalRef = terminal
```

### Disassociation Flow

```
Terminal "claude" closed
    │
    ▼
FileWatcher.onDidCloseTerminal(terminal)
    │
    ▼
find agent with terminalRef === terminal
    │
    ▼
AgentManager.removeAgent(agent.id)
```

## File Watching Strategy

### Polling Interval

- Default: 500ms (`POLL_INTERVAL_MS`)
- Reads up to 65536 bytes per poll (`READ_CHUNK_BYTES`)
- External scan occurs every 2 ticks to reduce overhead

### File Offset Tracking

The FileWatcher maintains `fileOffset` per agent to track read position:

1. Open file at current offset
2. Read up to `READ_CHUNK_BYTES`
3. Accumulate bytes in `lineBuffer` until newline
4. Split buffer by newlines, keep last partial line
5. Update `fileOffset` to file size (will skip when file grows)

### Symlink and Path Safety

1. Resolve paths with `path.resolve()` and `fs.realpathSync()`
2. Verify resolved path starts with expected parent directory
3. Reject any path that doesn't pass validation
4. Applied to both project directories and session files

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `POLL_INTERVAL_MS` | 500 | File polling interval |
| `READ_CHUNK_BYTES` | 65536 | Max bytes per read operation |
| `IDLE_THRESHOLD_MS` | 5000 | Idle detection threshold |
| `PERMISSION_TIMEOUT_MS` | 5000 | Permission request timeout |
| `CLEAR_COOLDOWN_MS` | 3000 | Cooldown after /clear command |
| `EXTERNAL_SCAN_DELAY_TICKS` | 2 | Ticks between external scans |

## Extension Entry Point

`PixelAgentsViewProvider` instantiates and wires together all components:

```typescript
// In PixelAgentsViewProvider constructor:
this.agentManager = new AgentManager();
this.timerManager = new TimerManager();
this.fileWatcher = new FileWatcher(
  this.agentManager,
  (msg) => this.postMessage(msg)
);
this.fileWatcher.start();

// In dispose():
this.fileWatcher.dispose();
this.timerManager.disposeAll();
```

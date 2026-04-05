# Phase 7 — Kanban: Tasks

Covers Milestone M5: "The team works together". Users can coordinate tasks between agents using a board integrated into the office.

**Prerequisite**: Phase 6 complete (inspection panel and agent actions).

## Tasks

- [ ] 1. Define Kanban data model
  1. Define type `KanbanTask { id, title, description, priority: 'low'|'medium'|'high', status: 'backlog'|'in-progress'|'review'|'done', assignedAgentId?: number, createdAt, updatedAt, sourceUrl?, sourceProvider? }`
  2. Define type `KanbanBoard { columns: KanbanColumn[], tasks: KanbanTask[] }`
  3. Define type `KanbanColumn { id, label, status }`
  4. Local persistence in `~/.pixel-agents/kanban.json` (same pattern as layouts)
  5. New webview ↔ extension messages: `kanbanLoaded`, `kanbanUpdated`, `kanbanTaskAssigned`

- [ ] 2. Implement Kanban persistence in the extension host
  1. Create `src/kanbanPersistence.ts`
  2. `saveBoard(board: KanbanBoard): Promise<void>` — atomic write with .tmp + rename
  3. `loadBoard(): Promise<KanbanBoard>` — if not found, return empty board with default columns
  4. Default columns: Backlog, In Progress, In Review, Done
  5. Send `kanbanLoaded` to webview on provider startup

- [ ] 3. Create KanbanBoard webview component
  1. Toggleable panel from BottomToolbar ("Board" button next to "Layout")
  2. Occupies the right half of the viewport when open (canvas shrinks)
  3. Four fixed columns with independent vertical scroll per column
  4. Each card shows: title, priority (color), assigned agent (miniature avatar if any)
  5. "+" button in Backlog column to create a new task (inline form)
  6. New task form: title (required), description (optional), priority (selector)

- [ ] 4. Implement drag & drop of cards between columns
  1. Use native HTML5 Drag and Drop API (no external libraries)
  2. Drag card between columns → update `task.status`
  3. Highlight target column during drag
  4. Send `kanbanUpdated` to extension host on drop
  5. Local undo (Ctrl+Z) of the last card move

- [ ] 5. Implement task assignment to agent by drag
  1. Drag card from Kanban and drop it onto a character in the canvas
  2. On drop: confirm assignment with dialog "Send this task to [Agent #N]?"
  3. If confirmed: send `agentChatMessage` with task title + description as prompt
  4. Update `task.assignedAgentId` and `task.status` to 'in-progress'
  5. Character shows speech bubble with task title (truncated to 30 chars) for 3s

- [ ] 6. Implement auto-assignment when an agent goes idle
  1. In `timerManager.ts`: add `startIdleTimer(agentId, onIdle, ms = 30000)` that starts after each `turnEnd` and is cancelled if new activity arrives from the same agent
  2. In `PixelAgentsViewProvider.ts`: start idle timer on each `turnEnd`; when it fires, send `agentIdle { agentId }` to webview
  3. In webview: on receiving `agentIdle`, find the first unassigned task in Backlog
  4. If a task is available: show notification "Agent #N is free. Assign [task]?" with [Yes] [No] buttons
  5. If user accepts: execute assignment flow (same as manual drag)
  6. Setting in SettingsModal: toggle "Auto-assign" (disabled by default)

- [ ] 7. Basic GitHub Issues integration (task source)
  1. In SettingsModal: "Task source" section with "GitHub repo (owner/repo)" field and optional "GitHub token (Personal Access Token)" field
  2. On save: fetch open issues via `https://api.github.com/repos/{owner}/{repo}/issues`; if token is provided, add `Authorization: Bearer <token>` header (enables private repos and avoids 60 req/h rate limit)
  3. Import issues as tasks in Backlog column (do not overwrite existing local tasks)
  4. Map GitHub labels to priority: `priority:high` → high, `priority:medium` → medium, rest → low
  5. Save `sourceUrl` (issue URL) and `sourceProvider: 'github'` on the task
  6. "Sync" button in the Kanban panel to re-import manually
  7. Note: read-only — do not write back to GitHub in this phase

- [ ] 8. Mark task as complete from the agent
  1. In the extension host: detect in the transcript when an agent explicitly mentions completing something (heuristic: `assistant` record with text "done", "complete", or "finished" at the end of a turn)
  2. Emit suggestion `taskMaybeComplete { agentId, taskId }` to webview
  3. In webview: show banner "Did Agent #N complete [task]?" with [Move to Done] [Ignore] buttons
  4. If user accepts: move card to "Done" column, free the agent

- [ ] 9. Verify M5 exit criterion
  1. Create 3 tasks in Backlog in < 1 minute
  2. Assign task to agent by dragging → agent receives the prompt
  3. Move card to "In Progress" by dragging between columns
  4. With GitHub repo configured: sync imports issues as cards
  5. With auto-assign enabled: idle agent receives task proposal in < 35 seconds

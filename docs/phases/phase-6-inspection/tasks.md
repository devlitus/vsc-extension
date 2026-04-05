# Phase 6 — Agent Inspection: Tasks

Covers Milestone M4: "Agent under control". The user can inspect and direct any agent from the UI without opening a terminal.

**Prerequisite**: Phase 5 complete (characters on screen, settings, sub-agents).

## Tasks

- [ ] 1. Define message protocol for the inspection panel
  1. New message `openInspectionPanel { agentId }` from webview → extension
  2. New message `inspectionData { agentId, model, cwd, branch, systemPrompt, contextUsed, contextMax, rateLimit, currentTurnDuration, toolsThisTurn, turnHistory }` from extension → webview
  3. New message `agentAction { agentId, action: 'interrupt' | 'redirect', payload? }` from webview → extension
  4. New message `agentChatMessage { agentId, text }` from webview → extension

- [ ] 2. Collect agent metadata in the extension host
  1. In `transcriptParser.ts`: extract model from the first `system` record in the JSONL
  2. In `transcriptParser.ts`: accumulate `toolsThisTurn: { name, count }[]` and reset on each `turnEnd`
  3. In `transcriptParser.ts`: extract `systemPrompt` from the `system.init` record if present
  4. In `agentManager.ts`: add `model`, `systemPrompt`, `toolsThisTurn`, `turnHistory: TurnSummary[]` fields to `AgentState`
  5. `TurnSummary`: `{ startedAt, endedAt, toolsUsed: { name, count }[], tokensUsed }`
  6. Keep the last 20 turns in `turnHistory` (circular buffer)
  7. In `agentManager.ts`: extract `branch` from `cwd` by running `git -C <cwd> rev-parse --abbrev-ref HEAD` lazily (only when the panel is opened); if it fails or is not a git repo, use `null`

- [ ] 3. Implement "Interrupt" action in the extension host
  1. In `PixelAgentsViewProvider.ts`: handle message `agentAction { action: 'interrupt' }`
  2. Locate the terminal associated with the agent via `agentManager`
  3. Send `\x03` (Ctrl+C) to terminal: `terminal.sendText('\x03', false)`
  4. Update agent state to `interrupted`
  5. Send confirmation to webview

- [ ] 4. Implement "Redirect" action in the extension host
  1. Handle message `agentAction { action: 'redirect', payload: { newCwd } }`
  2. Show native folder picker if `newCwd` is not in the payload
  3. Open new Claude Code terminal in the selected directory
  4. Associate the new terminal with the same agentId (reassign character to new terminal)

- [ ] 5. Implement "Chat" action — send message to active agent
  1. Handle message `agentChatMessage { agentId, text }`
  2. Locate the agent's terminal
  3. Send text with `terminal.sendText(text, true)` (true = appends Enter)
  4. Record the sent message in the agent's internal transcript

- [ ] 6. Create InspectionPanel webview component
  1. Sliding side panel (right sidebar), fixed width 280px
  2. Opens on character click (replace seat-assignment behavior)
  3. Header: agent name, role, AI model
  4. Section "Current state": animated state indicator, current turn duration
  5. Section "Context": visual token bar used/total, numeric percentage
  6. Section "Rate limit": energy bar with current status
  7. Section "Tools this turn": list `Read ×5 Edit ×3 Bash ×2` with icons
  8. Section "Directory": current `cwd` with copy button
  9. Section "System prompt": collapsible text (first 100 chars visible, expandable)
  10. Section "Turn history": list of last 5 turns with duration and tools used
  11. Action buttons: [Interrupt] [Chat] [Redirect] — with confirmation dialog on Interrupt
  12. Inline chat panel: text input + send button, visible when [Chat] is pressed
  13. Close panel: click outside or X button

- [ ] 7. Modify character click behavior
  1. Single click on character → open InspectionPanel (replacing selection mode)
  2. Seat selection mode: activate only in editor mode OR with modifier key (Shift+click)
  3. Update character tooltip to reflect the new behavior

- [ ] 8. Sub-agent tree in the inspection panel
  1. If the agent has active sub-agents, show "Active sub-agents" section
  2. List sub-agents with their visual state (miniature animation or status icon)
  3. Each sub-agent is clickable → switches the panel to show that sub-agent's info
  4. Navigation breadcrumb: "Agent #1 → Sub-agent #1.2"

- [ ] 9. Real-time panel updates
  1. Panel updates on every `inspectionData` message received from the extension host
  2. Extension host sends updated `inspectionData` on each `toolStart`, `toolEnd`, `turnEnd`
  3. If agent disconnects while panel is open: show "Agent disconnected" banner

- [ ] 10. Verify M4 exit criterion
  1. Click on character → panel opens in < 200ms
  2. Panel shows model, cwd, tokens used
  3. Click Interrupt → agent receives Ctrl+C in < 1 second
  4. Chat → sent text appears in the agent's terminal
  5. Redirect → new terminal opens in the selected directory
  6. Sub-agents are navigable from the parent's panel

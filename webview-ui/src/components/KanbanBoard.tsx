import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Character } from '../office/types';
import type { KanbanBoard as KanbanBoardType, KanbanColumn, KanbanTask, TaskPriority, TaskStatus } from '../../../src/kanbanTypes';
import { DEFAULT_COLUMNS } from '../../../src/kanbanTypes';

export interface KanbanBoardProps {
  board: KanbanBoardType;
  characters: Map<number, Character>;
  isOpen: boolean;
  onClose: () => void;
  onBoardChange: (board: KanbanBoardType) => void;
  onTaskAssign: (taskId: string, agentId: number) => void;
  onGithubSync: () => void;
  autoAssignEnabled: boolean;
}

interface NewTaskForm {
  title: string;
  description: string;
  priority: TaskPriority;
}

// Module-level variable to track dragged task for cross-component communication
export let draggedKanbanTaskId: string | null = null;

const PANEL_WIDTH = 480;
const COLUMN_MIN_WIDTH = 200;
const MAX_VISIBLE_HEIGHT = 'calc(100vh - 180px)';

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: '#ff6b6b',
  medium: '#ffd93d',
  low: '#6bcb77',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function KanbanBoard({
  board,
  characters,
  isOpen,
  onClose,
  onBoardChange,
  onTaskAssign,
  onGithubSync,
  autoAssignEnabled,
}: KanbanBoardProps) {
  const [newTaskForm, setNewTaskForm] = useState<NewTaskForm>({
    title: '',
    description: '',
    priority: 'medium',
  });
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<KanbanBoardType[]>([]);
  const [contextMenu, setContextMenu] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const [assignmentMenu, setAssignmentMenu] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const assignmentMenuRef = useRef<HTMLDivElement>(null);
  const MAX_UNDO_STACK = 5;

  // Close context menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (assignmentMenuRef.current && !assignmentMenuRef.current.contains(e.target as Node)) {
        setAssignmentMenu(null);
      }
    };

    if (contextMenu || assignmentMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu, assignmentMenu]);

  // Keyboard shortcut for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, undoStack]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previousBoard = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    onBoardChange(previousBoard);
  }, [undoStack, onBoardChange]);

  const saveToUndoStack = useCallback(() => {
    setUndoStack((prev) => {
      const newStack = [...prev, {
        ...board,
        tasks: board.tasks.map(t => ({ ...t })),
        columns: board.columns.map(c => ({ ...c }))
      }];
      // Limit stack size to MAX_UNDO_STACK
      if (newStack.length > MAX_UNDO_STACK) {
        return newStack.slice(-MAX_UNDO_STACK);
      }
      return newStack;
    });
  }, [board]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    draggedKanbanTaskId = taskId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumnId(null);
    draggedKanbanTaskId = null;
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumnId(columnId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverColumnId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    const task = board.tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) {
      handleDragEnd();
      return;
    }

    saveToUndoStack();

    const updatedTasks = board.tasks.map((t: KanbanTask) =>
      t.id === taskId
        ? { ...t, status: targetStatus, updatedAt: Date.now() }
        : t
    );

    onBoardChange({ ...board, tasks: updatedTasks });
    handleDragEnd();
  };

  const handleCreateTask = () => {
    if (!newTaskForm.title.trim()) return;

    const newTask: KanbanTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: newTaskForm.title.trim(),
      description: newTaskForm.description.trim(),
      priority: newTaskForm.priority,
      status: 'backlog',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveToUndoStack();
    onBoardChange({ ...board, tasks: [...board.tasks, newTask] });

    setNewTaskForm({ title: '', description: '', priority: 'medium' });
    setShowNewTaskForm(false);
  };

  const handleCancelNewTask = () => {
    setNewTaskForm({ title: '', description: '', priority: 'medium' });
    setShowNewTaskForm(false);
  };

  const handleTaskContextMenu = (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    setContextMenu({ taskId, x: e.clientX, y: e.clientY });
  };

  const handleAssignClick = (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setAssignmentMenu({ taskId, x: e.clientX, y: e.clientY });
  };

  const handleAgentSelect = (taskId: string, agentId: number) => {
    onTaskAssign(taskId, agentId);
    setAssignmentMenu(null);

    // Also update the board locally if needed
    const task = board.tasks.find((t) => t.id === taskId);
    if (task) {
      saveToUndoStack();
      const updatedTasks = board.tasks.map((t: KanbanTask) =>
        t.id === taskId
          ? { ...t, assignedAgentId: agentId, updatedAt: Date.now() }
          : t
      );
      onBoardChange({ ...board, tasks: updatedTasks });
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setContextMenu(null);
    saveToUndoStack();
    onBoardChange({ ...board, tasks: board.tasks.filter((t: KanbanTask) => t.id !== taskId) });
  };

  const getTasksByStatus = (status: TaskStatus): KanbanTask[] => {
    return board.tasks.filter((t: KanbanTask) => t.status === status);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '50%',
        height: '100%',
        background: '#1e1e1e',
        borderLeft: '1px solid #3a3a3a',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        boxShadow: '4px 0 16px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid #3a3a3a',
          minHeight: 44,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', fontFamily: 'sans-serif' }}>
            Tasks
          </span>
          {autoAssignEnabled && (
            <span
              style={{
                fontSize: 10,
                color: '#4ade80',
                fontFamily: 'sans-serif',
                background: '#2a4a2a',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              AUTO
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={onGithubSync}
            style={{
              width: 28,
              height: 28,
              padding: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#888',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#3a3a3a';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#888';
            }}
            title="Sync with GitHub"
          >
            🔄
          </button>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              padding: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#888',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#3a3a3a';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#888';
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Undo hint */}
      {undoStack.length > 0 && (
        <div
          style={{
            padding: '4px 12px',
            background: '#2a3a5a',
            borderBottom: '1px solid #3a5a8a',
            fontSize: 11,
            color: '#6a9fff',
            fontFamily: 'sans-serif',
          }}
        >
          Press Ctrl+Z to undo last move ({undoStack.length} in stack)
        </div>
      )}

      {/* Columns */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 8,
          padding: 12,
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        {DEFAULT_COLUMNS.map((column: KanbanColumn) => {
          const tasks = getTasksByStatus(column.status);
          const isDragOver = dragOverColumnId === column.id;
          const isBacklog = column.status === 'backlog';

          return (
            <div
              key={column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.status)}
              style={{
                flex: 1,
                minWidth: COLUMN_MIN_WIDTH,
                maxWidth: COLUMN_MIN_WIDTH,
                display: 'flex',
                flexDirection: 'column',
                background: isDragOver ? '#2a3a4a' : '#252525',
                borderRadius: 6,
                border: isDragOver ? '2px solid #4a9eff' : '2px solid transparent',
                transition: 'all 0.15s ease',
                boxShadow: isDragOver ? '0 0 12px rgba(74, 158, 255, 0.3)' : 'none',
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderBottom: '1px solid #3a3a3a',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#ccc',
                      fontFamily: 'sans-serif',
                    }}
                  >
                    {column.label}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: '#888',
                      fontFamily: 'sans-serif',
                      background: '#3a3a3a',
                      padding: '1px 6px',
                      borderRadius: 10,
                    }}
                  >
                    {tasks.length}
                  </span>
                </div>
                {isBacklog && (
                  <button
                    onClick={() => setShowNewTaskForm(true)}
                    style={{
                      width: 22,
                      height: 22,
                      padding: 0,
                      background: '#2a4a2a',
                      border: '1px solid #3a6a3a',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: '#8f8',
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#3a5a3a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#2a4a2a';
                    }}
                    title="Add task"
                  >
                    +
                  </button>
                )}
              </div>

              {/* New Task Form */}
              {isBacklog && showNewTaskForm && (
                <div
                  style={{
                    padding: 10,
                    borderBottom: '1px solid #3a3a3a',
                    background: '#1e1e1e',
                    flexShrink: 0,
                  }}
                >
                  <input
                    type="text"
                    value={newTaskForm.title}
                    onChange={(e) => {
                      // Security: Remove control characters from input
                      const sanitized = e.target.value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                      setNewTaskForm((f) => ({ ...f, title: sanitized }));
                    }}
                    placeholder="Task title..."
                    maxLength={500}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: '#2a2a2a',
                      border: '1px solid #3a3a3a',
                      borderRadius: 4,
                      color: '#fff',
                      fontSize: 13,
                      fontFamily: 'sans-serif',
                      marginBottom: 8,
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#4a9eff';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#3a3a3a';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateTask();
                      }
                      if (e.key === 'Escape') {
                        handleCancelNewTask();
                      }
                    }}
                    autoFocus
                  />
                  <textarea
                    value={newTaskForm.description}
                    onChange={(e) => {
                      // Security: Remove control characters from input
                      const sanitized = e.target.value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                      setNewTaskForm((f) => ({ ...f, description: sanitized }));
                    }}
                    placeholder="Description (optional)..."
                    rows={2}
                    maxLength={10000}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: '#2a2a2a',
                      border: '1px solid #3a3a3a',
                      borderRadius: 4,
                      color: '#fff',
                      fontSize: 12,
                      fontFamily: 'sans-serif',
                      marginBottom: 8,
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#4a9eff';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#3a3a3a';
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#888', fontFamily: 'sans-serif' }}>Priority:</span>
                    {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setNewTaskForm((f) => ({ ...f, priority: p }))}
                        style={{
                          padding: '3px 8px',
                          background: newTaskForm.priority === p ? PRIORITY_COLORS[p] + '33' : '#2a2a2a',
                          border: `1px solid ${newTaskForm.priority === p ? PRIORITY_COLORS[p] : '#3a3a3a'}`,
                          borderRadius: 4,
                          cursor: 'pointer',
                          color: newTaskForm.priority === p ? PRIORITY_COLORS[p] : '#888',
                          fontSize: 11,
                          fontFamily: 'sans-serif',
                        }}
                      >
                        {PRIORITY_LABELS[p]}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={handleCreateTask}
                      disabled={!newTaskForm.title.trim()}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        background: newTaskForm.title.trim() ? '#2a4a2a' : '#252525',
                        border: `1px solid ${newTaskForm.title.trim() ? '#3a6a3a' : '#3a3a3a'}`,
                        borderRadius: 4,
                        cursor: newTaskForm.title.trim() ? 'pointer' : 'not-allowed',
                        color: newTaskForm.title.trim() ? '#8f8' : '#555',
                        fontSize: 12,
                        fontFamily: 'sans-serif',
                        fontWeight: 500,
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelNewTask}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        background: '#3a2a2a',
                        border: '1px solid #5a3a3a',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: '#ff8a8a',
                        fontSize: 12,
                        fontFamily: 'sans-serif',
                        fontWeight: 500,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Task List */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  maxHeight: MAX_VISIBLE_HEIGHT,
                  padding: 8,
                }}
              >
                {tasks.length === 0 && !showNewTaskForm && (
                  <div
                    style={{
                      padding: '20px 10px',
                      textAlign: 'center',
                      fontSize: 12,
                      color: '#555',
                      fontFamily: 'sans-serif',
                    }}
                  >
                    {isDragOver ? 'Drop here' : 'No tasks'}
                  </div>
                )}
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    character={task.assignedAgentId ? characters.get(task.assignedAgentId) : undefined}
                    isDragging={draggedTaskId === task.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onContextMenu={handleTaskContextMenu}
                    onAssignClick={handleAssignClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#2a2a2a',
            border: '1px solid #4a4a4a',
            borderRadius: 6,
            padding: 4,
            zIndex: 1000,
            minWidth: 140,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          }}
        >
          <ContextMenuItem
            label="Assign to Agent..."
            onClick={() => {
              setContextMenu(null);
              setAssignmentMenu({ taskId: contextMenu.taskId, x: contextMenu.x + 140, y: contextMenu.y });
            }}
          />
          <ContextMenuItem
            label="Delete"
            onClick={() => handleDeleteTask(contextMenu.taskId)}
            danger
          />
        </div>
      )}

      {/* Assignment Menu */}
      {assignmentMenu && (
        <div
          ref={assignmentMenuRef}
          style={{
            position: 'fixed',
            left: assignmentMenu.x,
            top: assignmentMenu.y,
            background: '#2a2a2a',
            border: '1px solid #4a4a4a',
            borderRadius: 6,
            padding: 4,
            zIndex: 1001,
            minWidth: 160,
            maxHeight: 300,
            overflowY: 'auto',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              fontSize: 11,
              color: '#888',
              fontFamily: 'sans-serif',
              borderBottom: '1px solid #3a3a3a',
              marginBottom: 4,
            }}
          >
            Assign to Agent
          </div>
          {characters.size === 0 && (
            <div
              style={{
                padding: '8px 10px',
                fontSize: 12,
                color: '#666',
                fontFamily: 'sans-serif',
              }}
            >
              No agents available
            </div>
          )}
          {Array.from(characters.values()).map((char) => (
            <ContextMenuItem
              key={char.id}
              label={`Agent #${char.id}`}
              onClick={() => handleAgentSelect(assignmentMenu.taskId, char.id)}
            />
          ))}
        </div>
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
}

interface TaskCardProps {
  task: KanbanTask;
  character?: Character;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onContextMenu: (e: React.MouseEvent, taskId: string) => void;
  onAssignClick: (e: React.MouseEvent, taskId: string) => void;
}

function TaskCard({
  task,
  character,
  isDragging,
  onDragStart,
  onDragEnd,
  onContextMenu,
  onAssignClick,
}: TaskCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onContextMenu={(e) => onContextMenu(e, task.id)}
      style={{
        background: '#2a2a2a',
        borderRadius: 6,
        marginBottom: 8,
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`,
        transition: 'opacity 0.15s ease, transform 0.15s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.background = '#333';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#2a2a2a';
      }}
    >
      <div style={{ padding: '10px 10px 6px 10px' }}>
        {/* Title Row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              fontFamily: 'sans-serif',
              lineHeight: 1.3,
              flex: 1,
            }}
          >
            {task.title}
          </span>
          {task.sourceProvider === 'github' && (
            <span
              style={{
                fontSize: 11,
                color: '#888',
                flexShrink: 0,
              }}
              title="From GitHub"
            >
              🐙
            </span>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div
            style={{
              fontSize: 11,
              color: '#888',
              fontFamily: 'sans-serif',
              marginTop: 4,
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {task.description}
          </div>
        )}

        {/* Footer Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          {/* Agent Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {character ? (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: character.palette || '#4a9eff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#fff',
                  fontFamily: 'sans-serif',
                }}
                title={`Assigned to Agent #${character.id}`}
              >
                {character.id}
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAssignClick(e, task.id);
                }}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#3a3a3a',
                  border: '1px dashed #555',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#666',
                  cursor: 'pointer',
                  padding: 0,
                }}
                title="Assign to agent"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#4a4a4a';
                  e.currentTarget.style.borderColor = '#4a9eff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#3a3a3a';
                  e.currentTarget.style.borderColor = '#555';
                }}
              >
                +
              </button>
            )}
          </div>

          {/* Priority Badge */}
          <span
            style={{
              fontSize: 9,
              color: PRIORITY_COLORS[task.priority],
              fontFamily: 'sans-serif',
              textTransform: 'uppercase',
              fontWeight: 600,
              letterSpacing: '0.3px',
            }}
          >
            {task.priority}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ContextMenuItemProps {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function ContextMenuItem({ label, onClick, danger }: ContextMenuItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '6px 10px',
        fontSize: 12,
        color: danger ? (isHovered ? '#ff8a8a' : '#ff6b6b') : '#ccc',
        fontFamily: 'sans-serif',
        cursor: 'pointer',
        borderRadius: 4,
        background: isHovered ? (danger ? '#4a2a2a' : '#3a3a3a') : 'transparent',
      }}
    >
      {label}
    </div>
  );
}

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import type {
  ClaudeCodeSession,
  ClaudeCodeMessage,
  TodoItem,
  ToolCall,
  ClaudeCodeSourceConfig,
} from '../types/index.js';

interface RawMessage {
  type: string;
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  sessionId: string;
  cwd: string;
  message?: {
    role: string;
    content: string | ContentBlock[];
  };
  todos?: Array<{ content: string; status: string }>;
}

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface SessionInfo {
  sessionId: string;
  projectPath: string;
  projectName: string;
  filePath: string;
  modifiedTime: Date;
}

function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

function decodeProjectPath(encoded: string): string {
  // Project directories are encoded by replacing "/" with "-", but this encoding
  // is ambiguous for paths containing hyphens (e.g., "my-project" vs "my/project").
  // We return the encoded name as-is; parseSession() extracts the actual path
  // from the session's cwd field which is authoritative.
  return encoded;
}

function getProjectName(projectPath: string): string {
  // Handle both actual paths (/Users/.../project) and encoded names (-Users-...-project)
  const separator = projectPath.includes('/') ? '/' : '-';
  const parts = projectPath.split(separator).filter(Boolean);
  return parts[parts.length - 1] || 'unknown';
}

export function listSessions(config: ClaudeCodeSourceConfig, since?: Date): SessionInfo[] {
  const claudePath = expandPath(config.log_path);
  const projectsDir = join(claudePath, 'projects');

  if (!existsSync(projectsDir)) {
    return [];
  }

  const sessions: SessionInfo[] = [];
  const projectDirs = readdirSync(projectsDir);

  for (const projectDir of projectDirs) {
    const projectPath = join(projectsDir, projectDir);
    const stat = statSync(projectPath);

    if (!stat.isDirectory()) continue;

    const files = readdirSync(projectPath);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const filePath = join(projectPath, file);
      const fileStat = statSync(filePath);

      // Filter by modification time if since is provided
      if (since && fileStat.mtime < since) continue;

      const sessionId = basename(file, '.jsonl');
      const decodedProjectPath = decodeProjectPath(projectDir);

      sessions.push({
        sessionId,
        projectPath: decodedProjectPath,
        projectName: getProjectName(decodedProjectPath),
        filePath,
        modifiedTime: fileStat.mtime,
      });
    }
  }

  // Sort by modification time, most recent first
  sessions.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());

  return sessions;
}

export function parseSession(filePath: string): ClaudeCodeSession | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  const messages: ClaudeCodeMessage[] = [];
  const filesModified: Set<string> = new Set();
  const commandsRun: string[] = [];
  const errors: string[] = [];
  let todoItems: TodoItem[] = [];
  let projectPath = '';
  let sessionId = '';
  let startTime: Date | undefined;
  let endTime: Date | undefined;

  for (const line of lines) {
    try {
      const raw: RawMessage = JSON.parse(line);

      // Track session metadata
      if (!sessionId && raw.sessionId) {
        sessionId = raw.sessionId;
      }
      if (!projectPath && raw.cwd) {
        projectPath = raw.cwd;
      }

      // Track timestamps
      const timestamp = new Date(raw.timestamp);
      if (!startTime || timestamp < startTime) {
        startTime = timestamp;
      }
      if (!endTime || timestamp > endTime) {
        endTime = timestamp;
      }

      // Track todos
      if (raw.todos && raw.todos.length > 0) {
        todoItems = raw.todos.map((t) => ({
          content: t.content,
          status: t.status as TodoItem['status'],
        }));
      }

      // Process messages
      if (raw.type === 'user' && raw.message) {
        const content =
          typeof raw.message.content === 'string'
            ? raw.message.content
            : raw.message.content
                .filter((b) => b.type === 'text')
                .map((b) => b.text)
                .join('\n');

        messages.push({
          role: 'user',
          content,
          timestamp,
        });
      } else if (raw.type === 'assistant' && raw.message) {
        const contentBlocks = raw.message.content;
        if (!Array.isArray(contentBlocks)) continue;

        const textContent = contentBlocks
          .filter((b) => b.type === 'text')
          .map((b) => b.text || '')
          .join('\n');

        const toolCalls: ToolCall[] = contentBlocks
          .filter((b) => b.type === 'tool_use')
          .map((b) => ({
            tool: b.name || 'unknown',
            input: b.input || {},
          }));

        // Extract file modifications from tool calls
        for (const tc of toolCalls) {
          if (
            tc.tool === 'Write' ||
            tc.tool === 'Edit' ||
            tc.tool === 'NotebookEdit'
          ) {
            const filePath = tc.input.file_path || tc.input.notebook_path;
            if (typeof filePath === 'string') {
              filesModified.add(filePath);
            }
          }
          if (tc.tool === 'Bash') {
            const cmd = tc.input.command;
            if (typeof cmd === 'string') {
              commandsRun.push(cmd);
            }
          }
        }

        // Look for error patterns in text
        if (textContent.toLowerCase().includes('error')) {
          const errorLines = textContent
            .split('\n')
            .filter(
              (l) =>
                l.toLowerCase().includes('error') &&
                !l.toLowerCase().includes('no error')
            );
          errors.push(...errorLines.slice(0, 3));
        }

        if (textContent || toolCalls.length > 0) {
          messages.push({
            role: 'assistant',
            content: textContent,
            timestamp,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          });
        }
      }
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  if (!startTime) {
    return null;
  }

  return {
    id: sessionId,
    project: getProjectName(projectPath),
    projectPath,
    startTime,
    endTime,
    messages,
    todoItems,
    filesModified: Array.from(filesModified),
    commandsRun,
    errors: [...new Set(errors)].slice(0, 10),
  };
}

export function getRecentSessions(
  config: ClaudeCodeSourceConfig,
  hoursBack: number = 168
): ClaudeCodeSession[] {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const sessionInfos = listSessions(config, since);

  const sessions: ClaudeCodeSession[] = [];
  for (const info of sessionInfos) {
    const session = parseSession(info.filePath);
    if (session) {
      sessions.push(session);
    }
  }

  return sessions;
}

export function extractOpenTodos(sessions: ClaudeCodeSession[]): TodoItem[] {
  const allTodos: TodoItem[] = [];

  for (const session of sessions) {
    for (const todo of session.todoItems) {
      if (todo.status !== 'completed') {
        allTodos.push(todo);
      }
    }
  }

  // Deduplicate by content
  const seen = new Set<string>();
  return allTodos.filter((t) => {
    if (seen.has(t.content)) return false;
    seen.add(t.content);
    return true;
  });
}

export function extractActiveProjects(sessions: ClaudeCodeSession[]): string[] {
  const projects = new Set<string>();
  for (const session of sessions) {
    if (session.project) {
      projects.add(session.project);
    }
  }
  return Array.from(projects);
}

export function extractUnresolvedErrors(sessions: ClaudeCodeSession[]): string[] {
  const allErrors: string[] = [];
  for (const session of sessions) {
    allErrors.push(...session.errors);
  }
  return [...new Set(allErrors)].slice(0, 20);
}

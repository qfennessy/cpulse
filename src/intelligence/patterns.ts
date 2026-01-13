import type { ClaudeCodeSession, GitHubCommit } from '../types/index.js';
import { getParentProject } from '../sources/worktree.js';

export interface FilePattern {
  path: string;
  editCount: number;
  lastEdited: Date;
  projects: string[];
}

export interface ProjectPattern {
  name: string;
  path: string;
  sessionCount: number;
  totalTime: number; // minutes
  lastActive: Date;
  filesModified: string[];
  worktrees?: string[]; // List of worktrees if this is a parent project
}

export interface TopicPattern {
  topic: string;
  frequency: number;
  lastMentioned: Date;
  contexts: string[]; // snippets of where it appeared
}

export interface ToolUsagePattern {
  tool: string;
  count: number;
  successRate: number;
}

export interface PatternAnalysis {
  frequentFiles: FilePattern[];
  activeProjects: ProjectPattern[];
  recurringTopics: TopicPattern[];
  toolUsage: ToolUsagePattern[];
  workingHours: { hour: number; count: number }[];
}

// Common programming topics to look for in conversations
const TOPIC_KEYWORDS: Record<string, string[]> = {
  'testing': ['test', 'spec', 'jest', 'vitest', 'pytest', 'unittest', 'coverage', 'mock'],
  'debugging': ['debug', 'error', 'bug', 'fix', 'issue', 'crash', 'exception', 'stack trace'],
  'refactoring': ['refactor', 'cleanup', 'reorganize', 'restructure', 'optimize'],
  'documentation': ['docs', 'readme', 'comment', 'document', 'jsdoc', 'docstring'],
  'deployment': ['deploy', 'release', 'build', 'ci', 'cd', 'pipeline', 'docker', 'kubernetes'],
  'database': ['database', 'sql', 'query', 'migration', 'schema', 'postgres', 'mysql', 'mongo'],
  'api': ['api', 'endpoint', 'rest', 'graphql', 'request', 'response', 'fetch'],
  'authentication': ['auth', 'login', 'token', 'jwt', 'session', 'password', 'oauth'],
  'performance': ['performance', 'optimize', 'slow', 'fast', 'cache', 'memory', 'cpu'],
  'security': ['security', 'vulnerability', 'xss', 'csrf', 'injection', 'sanitize'],
  'typescript': ['typescript', 'types', 'interface', 'generic', 'type error'],
  'react': ['react', 'component', 'hook', 'useState', 'useEffect', 'jsx'],
  'styling': ['css', 'style', 'tailwind', 'scss', 'sass', 'theme', 'design'],
};

export function analyzeFilePatterns(sessions: ClaudeCodeSession[]): FilePattern[] {
  const fileMap = new Map<string, FilePattern>();

  for (const session of sessions) {
    for (const file of session.filesModified) {
      const existing = fileMap.get(file);
      if (existing) {
        existing.editCount++;
        if (session.endTime && session.endTime > existing.lastEdited) {
          existing.lastEdited = session.endTime;
        }
        if (!existing.projects.includes(session.project)) {
          existing.projects.push(session.project);
        }
      } else {
        fileMap.set(file, {
          path: file,
          editCount: 1,
          lastEdited: session.endTime || session.startTime,
          projects: [session.project],
        });
      }
    }
  }

  // Sort by edit count, return top 20
  return Array.from(fileMap.values())
    .sort((a, b) => b.editCount - a.editCount)
    .slice(0, 20);
}

export function analyzeProjectPatterns(sessions: ClaudeCodeSession[]): ProjectPattern[] {
  const projectMap = new Map<string, ProjectPattern & { worktreeSet: Set<string> }>();

  for (const session of sessions) {
    // Group by parent project (handles worktrees)
    const parentProject = getParentProject(session.projectPath, session.project);
    const key = parentProject;

    const sessionDuration = session.endTime
      ? (session.endTime.getTime() - session.startTime.getTime()) / 60000
      : 0;

    const existing = projectMap.get(key);

    if (existing) {
      existing.sessionCount++;
      existing.totalTime += sessionDuration;
      if (session.endTime && session.endTime > existing.lastActive) {
        existing.lastActive = session.endTime;
      }
      for (const file of session.filesModified) {
        if (!existing.filesModified.includes(file)) {
          existing.filesModified.push(file);
        }
      }
      // Track worktrees
      existing.worktreeSet.add(session.project);
    } else {
      projectMap.set(key, {
        name: parentProject,
        path: session.projectPath || session.project,
        sessionCount: 1,
        totalTime: sessionDuration,
        lastActive: session.endTime || session.startTime,
        filesModified: [...session.filesModified],
        worktreeSet: new Set([session.project]),
      });
    }
  }

  // Convert to ProjectPattern array and sort by session count
  return Array.from(projectMap.values())
    .map(({ worktreeSet, ...pattern }) => ({
      ...pattern,
      worktrees: worktreeSet.size > 1 ? Array.from(worktreeSet) : undefined,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)
    .slice(0, 10);
}

export function analyzeTopicPatterns(sessions: ClaudeCodeSession[]): TopicPattern[] {
  const topicMap = new Map<string, TopicPattern>();

  for (const session of sessions) {
    // Analyze user messages for topics
    for (const message of session.messages) {
      if (message.role !== 'user') continue;

      const contentLower = message.content.toLowerCase();

      for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
        const found = keywords.some((kw) => contentLower.includes(kw));
        if (found) {
          const existing = topicMap.get(topic);
          // Extract context snippet (first 100 chars around keyword match)
          const contextSnippet = message.content.substring(0, 100);

          if (existing) {
            existing.frequency++;
            if (message.timestamp > existing.lastMentioned) {
              existing.lastMentioned = message.timestamp;
            }
            if (existing.contexts.length < 5) {
              existing.contexts.push(contextSnippet);
            }
          } else {
            topicMap.set(topic, {
              topic,
              frequency: 1,
              lastMentioned: message.timestamp,
              contexts: [contextSnippet],
            });
          }
        }
      }
    }
  }

  // Sort by frequency
  return Array.from(topicMap.values())
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 15);
}

export function analyzeToolUsage(sessions: ClaudeCodeSession[]): ToolUsagePattern[] {
  const toolMap = new Map<string, { count: number; successes: number }>();

  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role !== 'assistant' || !message.toolCalls) continue;

      for (const tc of message.toolCalls) {
        const existing = toolMap.get(tc.tool);
        // Assume success if there's output or no explicit error
        const success = tc.output ? !tc.output.toLowerCase().includes('error') : true;

        if (existing) {
          existing.count++;
          if (success) existing.successes++;
        } else {
          toolMap.set(tc.tool, { count: 1, successes: success ? 1 : 0 });
        }
      }
    }
  }

  return Array.from(toolMap.entries())
    .map(([tool, data]) => ({
      tool,
      count: data.count,
      successRate: data.count > 0 ? data.successes / data.count : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function analyzeWorkingHours(sessions: ClaudeCodeSession[]): { hour: number; count: number }[] {
  const hourCounts = new Array(24).fill(0);

  for (const session of sessions) {
    const hour = session.startTime.getHours();
    hourCounts[hour]++;
  }

  return hourCounts.map((count, hour) => ({ hour, count }));
}

export function analyzePatterns(
  sessions: ClaudeCodeSession[],
  _commits?: GitHubCommit[]
): PatternAnalysis {
  return {
    frequentFiles: analyzeFilePatterns(sessions),
    activeProjects: analyzeProjectPatterns(sessions),
    recurringTopics: analyzeTopicPatterns(sessions),
    toolUsage: analyzeToolUsage(sessions),
    workingHours: analyzeWorkingHours(sessions),
  };
}

export function formatPatternSummary(analysis: PatternAnalysis): string {
  const lines: string[] = [];

  if (analysis.activeProjects.length > 0) {
    lines.push('**Most Active Projects:**');
    for (const proj of analysis.activeProjects.slice(0, 5)) {
      const hours = Math.round(proj.totalTime / 60);
      const timeStr = isNaN(hours) || hours <= 0 ? '' : `, ~${hours}h total`;
      const worktreeInfo = proj.worktrees && proj.worktrees.length > 1
        ? ` (${proj.worktrees.length} worktrees)`
        : '';
      lines.push(`- ${proj.name}: ${proj.sessionCount} sessions${timeStr}${worktreeInfo}`);
    }
    lines.push('');
  }

  if (analysis.frequentFiles.length > 0) {
    lines.push('**Frequently Modified Files:**');
    for (const file of analysis.frequentFiles.slice(0, 5)) {
      const shortPath = file.path.split('/').slice(-2).join('/');
      lines.push(`- ${shortPath}: ${file.editCount} edits`);
    }
    lines.push('');
  }

  if (analysis.recurringTopics.length > 0) {
    lines.push('**Recurring Topics:**');
    const topTopics = analysis.recurringTopics.slice(0, 5).map((t) => t.topic);
    lines.push(topTopics.join(', '));
    lines.push('');
  }

  return lines.join('\n');
}

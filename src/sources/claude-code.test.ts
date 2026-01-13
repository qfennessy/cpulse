import { describe, it, expect } from 'vitest';
import { extractOpenTodos } from './claude-code.js';
import type { ClaudeCodeSession, TodoItem } from '../types/index.js';

// Helper to create mock sessions
function createMockSession(overrides: Partial<ClaudeCodeSession> = {}): ClaudeCodeSession {
  return {
    id: 'session-1',
    project: 'test-project',
    projectPath: '/Users/test/src/test-project',
    startTime: new Date('2026-01-10T10:00:00'),
    endTime: new Date('2026-01-10T12:00:00'),
    messages: [],
    todoItems: [],
    filesModified: [],
    commandsRun: [],
    errors: [],
    ...overrides,
  };
}

describe('extractOpenTodos', () => {
  it('should return empty array when no sessions', () => {
    const result = extractOpenTodos([]);
    expect(result).toEqual([]);
  });

  it('should extract open todos and exclude completed ones', () => {
    const session = createMockSession({
      todoItems: [
        { content: 'Fix the bug', status: 'pending' },
        { content: 'Write tests', status: 'in_progress' },
        { content: 'Deploy app', status: 'completed' },
      ],
    });

    const result = extractOpenTodos([session]);

    expect(result).toHaveLength(2);
    expect(result.map(t => t.content)).toContain('Fix the bug');
    expect(result.map(t => t.content)).toContain('Write tests');
    expect(result.map(t => t.content)).not.toContain('Deploy app');
  });

  it('should preserve session context in todos', () => {
    const session = createMockSession({
      id: 'abc123',
      project: 'my-project',
      projectPath: '/Users/test/my-project',
      filesModified: ['src/index.ts', 'src/utils.ts'],
      todoItems: [{ content: 'Add validation', status: 'pending' }],
    });

    const result = extractOpenTodos([session]);

    expect(result[0].sessionId).toBe('abc123');
    expect(result[0].project).toBe('my-project');
    expect(result[0].projectPath).toBe('/Users/test/my-project');
    expect(result[0].relatedFiles).toEqual(['src/index.ts', 'src/utils.ts']);
  });

  it('should track recurring todos across sessions', () => {
    const session1 = createMockSession({
      id: 'session-1',
      startTime: new Date('2026-01-10T10:00:00'),
      endTime: new Date('2026-01-10T12:00:00'),
      todoItems: [{ content: 'Fix the bug', status: 'pending' }],
    });

    const session2 = createMockSession({
      id: 'session-2',
      startTime: new Date('2026-01-11T10:00:00'),
      endTime: new Date('2026-01-11T12:00:00'),
      todoItems: [{ content: 'Fix the bug', status: 'pending' }],
    });

    const session3 = createMockSession({
      id: 'session-3',
      startTime: new Date('2026-01-12T10:00:00'),
      endTime: new Date('2026-01-12T12:00:00'),
      todoItems: [{ content: 'Fix the bug', status: 'in_progress' }],
    });

    const result = extractOpenTodos([session1, session2, session3]);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Fix the bug');
    expect(result[0].occurrenceCount).toBe(3);
  });

  it('should sort by recurrence count (most recurring first)', () => {
    const session1 = createMockSession({
      todoItems: [
        { content: 'Rare todo', status: 'pending' },
        { content: 'Common todo', status: 'pending' },
      ],
    });

    const session2 = createMockSession({
      todoItems: [{ content: 'Common todo', status: 'pending' }],
    });

    const session3 = createMockSession({
      todoItems: [{ content: 'Common todo', status: 'pending' }],
    });

    const result = extractOpenTodos([session1, session2, session3]);

    expect(result[0].content).toBe('Common todo');
    expect(result[0].occurrenceCount).toBe(3);
    expect(result[1].content).toBe('Rare todo');
    expect(result[1].occurrenceCount).toBe(1);
  });

  it('should merge related files across sessions', () => {
    const session1 = createMockSession({
      filesModified: ['src/a.ts', 'src/b.ts'],
      todoItems: [{ content: 'Refactor', status: 'pending' }],
    });

    const session2 = createMockSession({
      filesModified: ['src/b.ts', 'src/c.ts'],
      todoItems: [{ content: 'Refactor', status: 'pending' }],
    });

    const result = extractOpenTodos([session1, session2]);

    expect(result[0].relatedFiles).toContain('src/a.ts');
    expect(result[0].relatedFiles).toContain('src/b.ts');
    expect(result[0].relatedFiles).toContain('src/c.ts');
  });
});

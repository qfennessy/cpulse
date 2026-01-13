import { describe, it, expect } from 'vitest';
import { extractBlockers } from './blockers.js';
function createMockSession(messages) {
    return {
        id: 'session-1',
        project: 'test-project',
        projectPath: '/Users/test/src/test-project',
        startTime: new Date('2026-01-10T10:00:00'),
        endTime: new Date('2026-01-10T12:00:00'),
        messages: messages.map((m, i) => ({
            ...m,
            timestamp: new Date(`2026-01-10T10:${i.toString().padStart(2, '0')}:00`),
        })),
        todoItems: [],
        filesModified: [],
        commandsRun: [],
        errors: [],
    };
}
describe('extractBlockers', () => {
    it('should return empty array when no sessions', () => {
        const result = extractBlockers([]);
        expect(result).toEqual([]);
    });
    it('should return empty array when no blockers in messages', () => {
        const session = createMockSession([
            { role: 'user', content: 'Help me write a function' },
            { role: 'assistant', content: 'Sure, here is the function...' },
        ]);
        const result = extractBlockers([session]);
        expect(result).toEqual([]);
    });
    it('should detect "blocked by" pattern', () => {
        const session = createMockSession([
            { role: 'user', content: 'I am blocked by the API team not providing the endpoint spec.' },
        ]);
        const result = extractBlockers([session]);
        expect(result).toHaveLength(1);
        expect(result[0].blockedBy).toBe('the API team not providing the endpoint spec');
        expect(result[0].project).toBe('test-project');
    });
    it('should detect "waiting on" pattern', () => {
        const session = createMockSession([
            { role: 'user', content: 'I am waiting on the design review to finish.' },
        ]);
        const result = extractBlockers([session]);
        expect(result).toHaveLength(1);
        expect(result[0].waitingOn).toBe('the design review to finish');
    });
    it('should detect "waiting for" pattern', () => {
        const session = createMockSession([
            { role: 'user', content: 'We are waiting for API team approval before proceeding.' },
        ]);
        const result = extractBlockers([session]);
        expect(result).toHaveLength(1);
        expect(result[0].waitingOn).toBe('API team approval before proceeding');
    });
    it('should detect "depends on" pattern', () => {
        const session = createMockSession([
            { role: 'user', content: 'This feature depends on the auth module being complete.' },
        ]);
        const result = extractBlockers([session]);
        expect(result).toHaveLength(1);
        expect(result[0].waitingOn).toBe('the auth module being complete');
    });
    it('should detect "stuck on" pattern', () => {
        const session = createMockSession([
            { role: 'user', content: 'I am stuck on figuring out the caching strategy.' },
        ]);
        const result = extractBlockers([session]);
        expect(result).toHaveLength(1);
        expect(result[0].blockedBy).toBe('figuring out the caching strategy');
    });
    it('should detect "can\'t proceed until" pattern', () => {
        const session = createMockSession([
            { role: 'user', content: "I can't proceed until the database migration is done." },
        ]);
        const result = extractBlockers([session]);
        expect(result).toHaveLength(1);
        expect(result[0].blockedBy).toBe('the database migration is done');
    });
    it('should only extract blockers from user messages', () => {
        const session = createMockSession([
            { role: 'assistant', content: 'You seem to be blocked by the API.' },
            { role: 'user', content: 'Yes, I am blocked by the API team.' },
        ]);
        const result = extractBlockers([session]);
        // Should only find one blocker from the user message
        expect(result).toHaveLength(1);
        expect(result[0].blockedBy).toBe('the API team');
    });
    it('should deduplicate similar blockers', () => {
        const session1 = createMockSession([
            { role: 'user', content: 'I am blocked by the API team not responding.' },
        ]);
        const session2 = createMockSession([
            { role: 'user', content: 'I am blocked by the API team not responding.' },
        ]);
        const result = extractBlockers([session1, session2]);
        expect(result).toHaveLength(1);
    });
    it('should skip very short messages', () => {
        const session = createMockSession([
            { role: 'user', content: 'blocked' }, // Too short
        ]);
        const result = extractBlockers([session]);
        expect(result).toEqual([]);
    });
});
//# sourceMappingURL=blockers.test.js.map
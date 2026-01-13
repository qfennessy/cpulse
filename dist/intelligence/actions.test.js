import { describe, it, expect } from 'vitest';
import { extractActionItems, extractQuickWins } from './actions.js';
function createMockSignals(overrides = {}) {
    return {
        claudeCode: {
            recentSessions: [],
            openTodos: [],
            unresolvedErrors: [],
            activeProjects: [],
            blockers: [],
            ...overrides.claudeCode,
        },
        github: {
            commits: [],
            pullRequests: [],
            staleBranches: [],
            postMergeComments: [],
            ...overrides.github,
        },
        ...overrides,
    };
}
function createMockTodo(content, overrides = {}) {
    return {
        content,
        status: 'pending',
        ...overrides,
    };
}
function createMockPR(overrides = {}) {
    return {
        number: 1,
        title: 'Test PR',
        state: 'open',
        repo: 'owner/repo',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        reviewComments: 0,
        isDraft: false,
        ...overrides,
    };
}
function createMockComment(overrides = {}) {
    return {
        id: 1,
        prNumber: 1,
        prTitle: 'Test PR',
        repo: 'owner/repo',
        author: 'reviewer',
        body: 'Test comment',
        createdAt: new Date('2026-01-02'),
        mergedAt: new Date('2026-01-01'),
        url: 'https://github.com/owner/repo/pull/1#comment-1',
        isReviewComment: false,
        ...overrides,
    };
}
describe('extractActionItems', () => {
    it('should return empty array when no signals', () => {
        const signals = createMockSignals();
        const result = extractActionItems(signals);
        expect(result).toEqual([]);
    });
    it('should mark first item as isStartHere', () => {
        const signals = createMockSignals({
            claudeCode: {
                recentSessions: [],
                openTodos: [createMockTodo('Fix bug', { occurrenceCount: 2 })],
                unresolvedErrors: [],
                activeProjects: [],
                blockers: [],
            },
        });
        const result = extractActionItems(signals);
        expect(result).toHaveLength(1);
        expect(result[0].isStartHere).toBe(true);
    });
    it('should prioritize critical post-merge comments first', () => {
        const signals = createMockSignals({
            claudeCode: {
                recentSessions: [],
                openTodos: [createMockTodo('Fix bug', { occurrenceCount: 2 })],
                unresolvedErrors: [],
                activeProjects: [],
                blockers: [],
            },
            github: {
                commits: [],
                pullRequests: [],
                staleBranches: [],
                postMergeComments: [
                    createMockComment({
                        body: 'This is a security vulnerability',
                        severity: 'critical',
                        severityReason: 'Contains security indicator',
                    }),
                ],
            },
        });
        const result = extractActionItems(signals);
        expect(result[0].category).toBe('post_merge');
        expect(result[0].isStartHere).toBe(true);
    });
    it('should include blockers with high priority', () => {
        const blocker = {
            description: 'I am blocked by the API team',
            project: 'test-project',
            sessionId: 'session-1',
            blockedBy: 'the API team',
            detectedAt: new Date('2026-01-10'),
        };
        const signals = createMockSignals({
            claudeCode: {
                recentSessions: [],
                openTodos: [],
                unresolvedErrors: [],
                activeProjects: [],
                blockers: [blocker],
            },
        });
        const result = extractActionItems(signals);
        expect(result).toHaveLength(1);
        expect(result[0].category).toBe('blocker');
        expect(result[0].content).toContain('Unblock');
    });
    it('should include review requests', () => {
        const signals = createMockSignals({
            github: {
                commits: [],
                pullRequests: [
                    createMockPR({
                        isReviewRequested: true,
                        reviewAgeInDays: 5,
                        title: 'Add new feature',
                    }),
                ],
                staleBranches: [],
                postMergeComments: [],
            },
        });
        const result = extractActionItems(signals);
        expect(result).toHaveLength(1);
        expect(result[0].category).toBe('pr_review');
        expect(result[0].context).toContain('5 days');
    });
    it('should include recurring todos', () => {
        const signals = createMockSignals({
            claudeCode: {
                recentSessions: [],
                openTodos: [
                    createMockTodo('One-time todo', { occurrenceCount: 1 }),
                    createMockTodo('Recurring todo', { occurrenceCount: 3 }),
                ],
                unresolvedErrors: [],
                activeProjects: [],
                blockers: [],
            },
        });
        const result = extractActionItems(signals);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Recurring todo');
        expect(result[0].context).toContain('3 times');
    });
    it('should sort by priority', () => {
        const signals = createMockSignals({
            claudeCode: {
                recentSessions: [],
                openTodos: [createMockTodo('Recurring', { occurrenceCount: 2 })],
                unresolvedErrors: [],
                activeProjects: [],
                blockers: [
                    {
                        description: 'Blocked',
                        project: 'test',
                        sessionId: 's1',
                        blockedBy: 'something',
                        detectedAt: new Date(),
                    },
                ],
            },
            github: {
                commits: [],
                pullRequests: [createMockPR({ isReviewRequested: true })],
                staleBranches: [],
                postMergeComments: [
                    createMockComment({ severity: 'critical', body: 'Bug found' }),
                ],
            },
        });
        const result = extractActionItems(signals);
        // Critical post-merge (priority 1) should be first
        expect(result[0].category).toBe('post_merge');
        // Blocker (priority 2) should be second
        expect(result[1].category).toBe('blocker');
    });
});
describe('extractQuickWins', () => {
    it('should return empty array when no signals', () => {
        const signals = createMockSignals();
        const result = extractQuickWins(signals);
        expect(result).toEqual([]);
    });
    it('should identify small todos as quick wins', () => {
        const signals = createMockSignals({
            claudeCode: {
                recentSessions: [],
                openTodos: [
                    createMockTodo('Fix typo in README'),
                    createMockTodo('Refactor the entire auth system'), // Should be excluded
                ],
                unresolvedErrors: [],
                activeProjects: [],
                blockers: [],
            },
        });
        const result = extractQuickWins(signals);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Fix typo in README');
        expect(result[0].estimatedEffort).toBe('trivial');
    });
    it('should exclude complex todos', () => {
        const signals = createMockSignals({
            claudeCode: {
                recentSessions: [],
                openTodos: [
                    createMockTodo('Refactor the database layer'),
                    createMockTodo('Rewrite the authentication module'),
                    createMockTodo('Implement new payment system'),
                    createMockTodo('Create user dashboard'),
                ],
                unresolvedErrors: [],
                activeProjects: [],
                blockers: [],
            },
        });
        const result = extractQuickWins(signals);
        expect(result).toHaveLength(0);
    });
    it('should include post-merge suggestions', () => {
        const signals = createMockSignals({
            github: {
                commits: [],
                pullRequests: [],
                staleBranches: [],
                postMergeComments: [
                    createMockComment({
                        severity: 'suggestion',
                        body: 'Consider using const here',
                    }),
                ],
            },
        });
        const result = extractQuickWins(signals);
        expect(result).toHaveLength(1);
        expect(result[0].category).toBe('quick_win');
    });
    it('should include PRs with few comments', () => {
        const signals = createMockSignals({
            github: {
                commits: [],
                pullRequests: [
                    createMockPR({
                        isReviewRequested: false,
                        reviewComments: 2,
                    }),
                ],
                staleBranches: [],
                postMergeComments: [],
            },
        });
        const result = extractQuickWins(signals);
        expect(result).toHaveLength(1);
        expect(result[0].content).toContain('2 comments');
    });
    it('should not include PRs with many comments', () => {
        const signals = createMockSignals({
            github: {
                commits: [],
                pullRequests: [
                    createMockPR({
                        isReviewRequested: false,
                        reviewComments: 10, // Too many for a quick win
                    }),
                ],
                staleBranches: [],
                postMergeComments: [],
            },
        });
        const result = extractQuickWins(signals);
        // Should not include as quick win due to many comments
        const prQuickWins = result.filter(r => r.content.includes('comment'));
        expect(prQuickWins).toHaveLength(0);
    });
});
//# sourceMappingURL=actions.test.js.map
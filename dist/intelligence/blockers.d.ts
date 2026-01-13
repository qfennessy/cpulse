/**
 * Blocker detection from Claude Code sessions.
 * Identifies when work is blocked or waiting on external dependencies.
 */
import type { ClaudeCodeSession, BlockerInfo } from '../types/index.js';
/**
 * Extract all blockers from multiple sessions.
 * Deduplicates similar blockers across sessions.
 */
export declare function extractBlockers(sessions: ClaudeCodeSession[]): BlockerInfo[];
/**
 * Group blockers by what's blocking them.
 */
export declare function groupBlockersBySource(blockers: BlockerInfo[]): Map<string, BlockerInfo[]>;
/**
 * Format blockers for inclusion in briefings.
 */
export declare function formatBlockersForBriefing(blockers: BlockerInfo[]): string;
//# sourceMappingURL=blockers.d.ts.map
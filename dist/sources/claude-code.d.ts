import type { ClaudeCodeSession, TodoItem, ClaudeCodeSourceConfig } from '../types/index.js';
interface SessionInfo {
    sessionId: string;
    projectPath: string;
    projectName: string;
    filePath: string;
    modifiedTime: Date;
}
export declare function listSessions(config: ClaudeCodeSourceConfig, since?: Date): SessionInfo[];
export declare function parseSession(filePath: string): ClaudeCodeSession | null;
export declare function getRecentSessions(config: ClaudeCodeSourceConfig, hoursBack?: number): ClaudeCodeSession[];
export declare function extractOpenTodos(sessions: ClaudeCodeSession[]): TodoItem[];
export declare function extractActiveProjects(sessions: ClaudeCodeSession[]): string[];
export declare function extractUnresolvedErrors(sessions: ClaudeCodeSession[]): string[];
export {};
//# sourceMappingURL=claude-code.d.ts.map
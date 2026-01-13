import type { ClaudeCodeSession, GitHubCommit } from '../types/index.js';
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
    totalTime: number;
    lastActive: Date;
    filesModified: string[];
    worktrees?: string[];
}
export interface TopicPattern {
    topic: string;
    frequency: number;
    lastMentioned: Date;
    contexts: string[];
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
    workingHours: {
        hour: number;
        count: number;
    }[];
}
export declare function analyzeFilePatterns(sessions: ClaudeCodeSession[]): FilePattern[];
export declare function analyzeProjectPatterns(sessions: ClaudeCodeSession[]): ProjectPattern[];
export declare function analyzeTopicPatterns(sessions: ClaudeCodeSession[]): TopicPattern[];
export declare function analyzeToolUsage(sessions: ClaudeCodeSession[]): ToolUsagePattern[];
export declare function analyzeWorkingHours(sessions: ClaudeCodeSession[]): {
    hour: number;
    count: number;
}[];
export declare function analyzePatterns(sessions: ClaudeCodeSession[], _commits?: GitHubCommit[]): PatternAnalysis;
export declare function formatPatternSummary(analysis: PatternAnalysis): string;
//# sourceMappingURL=patterns.d.ts.map
import type { ClaudeCodeSession } from '../types/index.js';
export interface OpenQuestion {
    id: string;
    question: string;
    context: string;
    project: string;
    sessionId: string;
    timestamp: Date;
    status: 'open' | 'resolved' | 'deferred';
    resolvedAt?: Date;
    resolution?: string;
}
export declare function extractQuestions(session: ClaudeCodeSession): OpenQuestion[];
export declare function extractAllQuestions(sessions: ClaudeCodeSession[]): OpenQuestion[];
export declare function groupQuestionsByProject(questions: OpenQuestion[]): Map<string, OpenQuestion[]>;
export declare function formatQuestionsForBriefing(questions: OpenQuestion[]): string;
//# sourceMappingURL=questions.d.ts.map
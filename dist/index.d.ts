import type { Config, ExtractedSignals, Briefing } from './types/index.js';
export declare function collectSignals(config: Config, hoursBack?: number): Promise<ExtractedSignals>;
export interface GenerateBriefingResult {
    briefing: Briefing;
    signals: ExtractedSignals;
}
export declare function generateAndSendBriefing(config: Config, options?: {
    send?: boolean;
    save?: boolean;
    hoursBack?: number;
    allCards?: boolean;
}): Promise<GenerateBriefingResult>;
export { loadConfig, createDefaultConfig, configExists, getConfigPath, } from './config.js';
export { formatBriefingAsMarkdown, formatBriefingWithNarratives, formatBriefingForTerminal, formatBriefingAsTerminal, } from './delivery/email.js';
export { getLatestBriefing, loadBriefings, getBriefingStats } from './storage/briefings.js';
export { prLink, commitLink, fileLink, fileLinkWithLine, branchCompareLink, formatPRList, formatCommitList, wrapWithNarratives, formatBriefingWithNarratives as formatWithNarratives, renderBriefingHtml, } from './presentation/index.js';
export { isWorktree, getMainRepoPath, getParentProject, groupByParentProject, formatProjectWithWorktrees, } from './sources/worktree.js';
export { analyzePatterns, formatPatternSummary, extractAllQuestions, formatQuestionsForBriefing, saveFeedback, loadFeedback, computeFeedbackStats, recordBriefingFeedback, loadTopicPriorities, updateTopicPriority, type PatternAnalysis, type OpenQuestion, type FeedbackEntry, type FeedbackStats, type TopicPriority, } from './intelligence/index.js';
export { createWebServer, getAnalytics, type WebServerOptions, type Analytics, } from './web/index.js';
export { loadGlobalMemory, loadProjectMemory, loadMemoryContext, loadMemoryFile, findProjectMemory, formatMemoryForPrompt, extractRelevantSections, getMemorySummary, getGitRoot, extractProjectName, type ProjectMemory, type MemorySection, type MemoryContext, } from './memory/index.js';
//# sourceMappingURL=index.d.ts.map
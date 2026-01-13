import { getRecentSessions, extractOpenTodos, extractActiveProjects, extractUnresolvedErrors, } from './sources/claude-code.js';
import { getGitHubActivity } from './sources/github.js';
import { generateBriefing } from './generation/articles.js';
import { sendBriefingEmail, } from './delivery/email.js';
import { saveBriefing } from './storage/briefings.js';
export async function collectSignals(config, hoursBack = 168) {
    const signals = {
        claudeCode: {
            recentSessions: [],
            openTodos: [],
            unresolvedErrors: [],
            activeProjects: [],
        },
        github: {
            commits: [],
            pullRequests: [],
            staleBranches: [],
            postMergeComments: [],
        },
    };
    // Collect Claude Code signals
    if (config.sources.claude_code.enabled) {
        const sessions = getRecentSessions(config.sources.claude_code, hoursBack);
        signals.claudeCode.recentSessions = sessions;
        signals.claudeCode.openTodos = extractOpenTodos(sessions);
        signals.claudeCode.activeProjects = extractActiveProjects(sessions);
        signals.claudeCode.unresolvedErrors = extractUnresolvedErrors(sessions);
    }
    // Collect GitHub signals
    if (config.sources.github.enabled) {
        signals.github = await getGitHubActivity(config.sources.github, hoursBack);
    }
    return signals;
}
export async function generateAndSendBriefing(config, options = {}) {
    const { send = true, save = true, hoursBack = 168 } = options;
    // Collect signals
    const signals = await collectSignals(config, hoursBack);
    // Generate briefing
    const briefing = await generateBriefing(config, signals);
    // Save briefing
    if (save && config.data_dir) {
        saveBriefing(config.data_dir, briefing);
    }
    // Send email with enhanced presentation (includes narratives)
    if (send) {
        await sendBriefingEmail(config.email, briefing, signals);
    }
    return { briefing, signals };
}
export { loadConfig, createDefaultConfig, configExists, getConfigPath, } from './config.js';
export { formatBriefingAsMarkdown, formatBriefingWithNarratives } from './delivery/email.js';
export { getLatestBriefing, loadBriefings, getBriefingStats } from './storage/briefings.js';
// Presentation module exports
export { prLink, commitLink, fileLink, fileLinkWithLine, branchCompareLink, formatPRList, formatCommitList, wrapWithNarratives, formatBriefingWithNarratives as formatWithNarratives, renderBriefingHtml, } from './presentation/index.js';
// Worktree detection exports
export { isWorktree, getMainRepoPath, getParentProject, groupByParentProject, formatProjectWithWorktrees, } from './sources/worktree.js';
// Intelligence module exports
export { analyzePatterns, formatPatternSummary, extractAllQuestions, formatQuestionsForBriefing, saveFeedback, loadFeedback, computeFeedbackStats, recordBriefingFeedback, loadTopicPriorities, updateTopicPriority, detectTechStack, formatTechStack, analyzePRChallenges, formatChallengeAnalysis, detectCostPatterns, formatCostInsights, getTrends, formatTrendsForPrompt, } from './intelligence/index.js';
// Web module exports
export { createWebServer, getAnalytics, } from './web/index.js';
// Memory module exports
export { loadGlobalMemory, loadProjectMemory, loadMemoryContext, loadMemoryFile, findProjectMemory, formatMemoryForPrompt, extractRelevantSections, getMemorySummary, getGitRoot, extractProjectName, } from './memory/index.js';
//# sourceMappingURL=index.js.map
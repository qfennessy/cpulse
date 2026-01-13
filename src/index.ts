import type { Config, ExtractedSignals, Briefing } from './types/index.js';
import {
  getRecentSessions,
  extractOpenTodos,
  extractActiveProjects,
  extractUnresolvedErrors,
} from './sources/claude-code.js';
import { getGitHubActivity } from './sources/github.js';
import { generateBriefing } from './generation/articles.js';
import {
  sendBriefingEmail,
  formatBriefingAsMarkdown,
  formatBriefingWithNarratives,
} from './delivery/email.js';
import { saveBriefing, getLatestBriefing } from './storage/briefings.js';
import {
  extractBlockers,
  extractActionItems,
  extractQuickWins,
} from './intelligence/index.js';

export async function collectSignals(
  config: Config,
  hoursBack: number = 168
): Promise<ExtractedSignals> {
  const signals: ExtractedSignals = {
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
    signals.claudeCode.blockers = extractBlockers(sessions);
  }

  // Collect GitHub signals
  if (config.sources.github.enabled) {
    signals.github = await getGitHubActivity(config.sources.github, hoursBack);
  }

  return signals;
}

export interface GenerateBriefingResult {
  briefing: Briefing;
  signals: ExtractedSignals;
}

export async function generateAndSendBriefing(
  config: Config,
  options: { send?: boolean; save?: boolean; hoursBack?: number; allCards?: boolean } = {}
): Promise<GenerateBriefingResult> {
  const { send = true, save = true, hoursBack = 168, allCards = false } = options;

  // Collect signals
  const signals = await collectSignals(config, hoursBack);

  // Extract action items and quick wins for actionable closing
  const actionItems = extractActionItems(signals);
  const quickWins = extractQuickWins(signals);

  // Store in signals for downstream use
  signals.actionItems = actionItems;
  signals.quickWins = quickWins;

  // Generate briefing
  const briefing = await generateBriefing(config, signals, { allCards });

  // Save briefing
  if (save && config.data_dir) {
    saveBriefing(config.data_dir, briefing);
  }

  // Send email with enhanced presentation (includes narratives and action items)
  if (send) {
    await sendBriefingEmail(config.email, briefing, signals);
  }

  return { briefing, signals };
}

export {
  loadConfig,
  createDefaultConfig,
  configExists,
  getConfigPath,
} from './config.js';

export {
  formatBriefingAsMarkdown,
  formatBriefingWithNarratives,
  formatBriefingForTerminal,
  formatBriefingAsTerminal,
} from './delivery/email.js';
export { getLatestBriefing, loadBriefings, getBriefingStats } from './storage/briefings.js';

// Presentation module exports
export {
  prLink,
  commitLink,
  fileLink,
  fileLinkWithLine,
  branchCompareLink,
  formatPRList,
  formatCommitList,
  wrapWithNarratives,
  formatBriefingWithNarratives as formatWithNarratives,
  renderBriefingHtml,
} from './presentation/index.js';

// Worktree detection exports
export {
  isWorktree,
  getMainRepoPath,
  getParentProject,
  groupByParentProject,
  formatProjectWithWorktrees,
} from './sources/worktree.js';

// Intelligence module exports
export {
  analyzePatterns,
  formatPatternSummary,
  extractAllQuestions,
  formatQuestionsForBriefing,
  saveFeedback,
  loadFeedback,
  computeFeedbackStats,
  recordBriefingFeedback,
  loadTopicPriorities,
  updateTopicPriority,
  type PatternAnalysis,
  type OpenQuestion,
  type FeedbackEntry,
  type FeedbackStats,
  type TopicPriority,
} from './intelligence/index.js';

// Web module exports
export {
  createWebServer,
  getAnalytics,
  type WebServerOptions,
  type Analytics,
} from './web/index.js';

// Memory module exports
export {
  loadGlobalMemory,
  loadProjectMemory,
  loadMemoryContext,
  loadMemoryFile,
  findProjectMemory,
  formatMemoryForPrompt,
  extractRelevantSections,
  getMemorySummary,
  getGitRoot,
  extractProjectName,
  type ProjectMemory,
  type MemorySection,
  type MemoryContext,
} from './memory/index.js';

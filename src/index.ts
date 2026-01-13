import type { Config, ExtractedSignals, Briefing } from './types/index.js';
import {
  getRecentSessions,
  extractOpenTodos,
  extractActiveProjects,
  extractUnresolvedErrors,
} from './sources/claude-code.js';
import { getGitHubActivity } from './sources/github.js';
import { generateBriefing } from './generation/articles.js';
import { sendBriefingEmail, formatBriefingAsMarkdown } from './delivery/email.js';
import { saveBriefing, getLatestBriefing } from './storage/briefings.js';

export async function collectSignals(
  config: Config,
  hoursBack: number = 24
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

export async function generateAndSendBriefing(
  config: Config,
  options: { send?: boolean; save?: boolean; hoursBack?: number } = {}
): Promise<Briefing> {
  const { send = true, save = true, hoursBack = 24 } = options;

  // Collect signals
  const signals = await collectSignals(config, hoursBack);

  // Generate briefing
  const briefing = await generateBriefing(config, signals);

  // Save briefing
  if (save && config.data_dir) {
    saveBriefing(config.data_dir, briefing);
  }

  // Send email
  if (send) {
    await sendBriefingEmail(config.email, briefing);
  }

  return briefing;
}

export {
  loadConfig,
  createDefaultConfig,
  configExists,
  getConfigPath,
} from './config.js';

export { formatBriefingAsMarkdown } from './delivery/email.js';
export { getLatestBriefing, loadBriefings, getBriefingStats } from './storage/briefings.js';

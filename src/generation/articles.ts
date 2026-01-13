import Anthropic from '@anthropic-ai/sdk';
import type {
  ArticleCard,
  Briefing,
  ExtractedSignals,
  Config,
  ClaudeCodeSession,
  GitHubCommit,
  GitHubPR,
} from '../types/index.js';
import {
  analyzePatterns,
  formatPatternSummary,
  extractAllQuestions,
  formatQuestionsForBriefing,
  shouldIncludeCardType,
  type PatternAnalysis,
  type OpenQuestion,
} from '../intelligence/index.js';

// Re-export intelligence types for external use
export type { PatternAnalysis, OpenQuestion };

const SYSTEM_PROMPT = `You are cpulse, a personal briefing assistant that generates concise, actionable insights from development activity.

Your communication style:
- Direct and technically accurate
- Concise (2-5 sentences per section)
- Use bullet points for actionable items
- Include specific file names, function names, or commit hashes when relevant
- Focus on what matters: unfinished work, blockers, and next steps
- No emojis, no excessive enthusiasm
- Markdown formatting for code snippets and emphasis

Your goal is to help the developer pick up where they left off and stay oriented on their projects.`;

function formatSessionSummary(session: ClaudeCodeSession): string {
  const lines = [
    `Project: ${session.project} (${session.projectPath})`,
    `Time: ${session.startTime.toLocaleString()} - ${session.endTime?.toLocaleString() || 'ongoing'}`,
    `Files modified: ${session.filesModified.slice(0, 5).join(', ')}${session.filesModified.length > 5 ? ` (+${session.filesModified.length - 5} more)` : ''}`,
  ];

  if (session.todoItems.length > 0) {
    lines.push(`Todos: ${session.todoItems.map((t) => `[${t.status}] ${t.content}`).join('; ')}`);
  }

  if (session.errors.length > 0) {
    lines.push(`Errors encountered: ${session.errors.slice(0, 3).join('; ')}`);
  }

  // Include last few user messages for context
  const userMessages = session.messages
    .filter((m) => m.role === 'user')
    .slice(-3);
  if (userMessages.length > 0) {
    lines.push('Recent requests:');
    for (const msg of userMessages) {
      const truncated =
        msg.content.length > 200
          ? msg.content.substring(0, 200) + '...'
          : msg.content;
      lines.push(`  - ${truncated}`);
    }
  }

  return lines.join('\n');
}

function formatCommitsSummary(commits: GitHubCommit[]): string {
  const byRepo: Record<string, GitHubCommit[]> = {};
  for (const commit of commits) {
    if (!byRepo[commit.repo]) byRepo[commit.repo] = [];
    byRepo[commit.repo].push(commit);
  }

  const lines: string[] = [];
  for (const [repo, repoCommits] of Object.entries(byRepo)) {
    lines.push(`\n${repo}:`);
    for (const commit of repoCommits.slice(0, 5)) {
      lines.push(
        `  - ${commit.sha}: ${commit.message} (+${commit.additions}/-${commit.deletions})`
      );
    }
    if (repoCommits.length > 5) {
      lines.push(`  ... and ${repoCommits.length - 5} more commits`);
    }
  }

  return lines.join('\n');
}

function formatPRsSummary(prs: GitHubPR[]): string {
  if (prs.length === 0) return 'No open PRs';

  const lines: string[] = [];
  for (const pr of prs) {
    const draft = pr.isDraft ? ' [DRAFT]' : '';
    const comments = pr.reviewComments > 0 ? ` (${pr.reviewComments} comments)` : '';
    lines.push(`- ${pr.repo}#${pr.number}: ${pr.title}${draft}${comments}`);
  }

  return lines.join('\n');
}

export async function generateProjectContinuityCard(
  client: Anthropic,
  signals: ExtractedSignals,
  config: Config
): Promise<ArticleCard | null> {
  const sessions = signals.claudeCode.recentSessions;
  if (sessions.length === 0) return null;

  const sessionSummaries = sessions
    .slice(0, 5)
    .map(formatSessionSummary)
    .join('\n\n---\n\n');

  const openTodos = signals.claudeCode.openTodos;
  const todosText =
    openTodos.length > 0
      ? `\n\nOpen todos across sessions:\n${openTodos.map((t) => `- [${t.status}] ${t.content}`).join('\n')}`
      : '';

  const prompt = `Based on these recent Claude Code sessions, generate a "Project Continuity" briefing card.

Sessions from the last 7 days:
${sessionSummaries}
${todosText}

Generate a briefing that:
1. Identifies the main project(s) worked on
2. Summarizes what was accomplished
3. Notes any unfinished work or open todos
4. Suggests concrete next steps

Keep it concise (2-4 short paragraphs or bullet lists). Focus on actionable information.
Output only the briefing content in markdown format, no preamble.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') return null;

  // Extract title from first line if it's a heading
  const lines = content.text.split('\n');
  let title = 'Project Continuity';
  let body = content.text;

  if (lines[0].startsWith('#')) {
    title = lines[0].replace(/^#+\s*/, '');
    body = lines.slice(1).join('\n').trim();
  }

  return {
    type: 'project_continuity',
    title,
    content: body,
    priority: 1,
    metadata: {
      sessionCount: sessions.length,
      projects: signals.claudeCode.activeProjects,
    },
  };
}

export async function generateCodeReviewCard(
  client: Anthropic,
  signals: ExtractedSignals,
  config: Config
): Promise<ArticleCard | null> {
  const { commits, pullRequests, staleBranches } = signals.github;

  if (commits.length === 0 && pullRequests.length === 0) return null;

  const commitsSummary = formatCommitsSummary(commits);
  const prsSummary = formatPRsSummary(pullRequests);
  const staleText =
    staleBranches.length > 0
      ? `\n\nStale branches (>14 days):\n${staleBranches.slice(0, 5).join('\n')}`
      : '';

  const prompt = `Based on this GitHub activity, generate a "Code Review" briefing card.

Recent commits (last 7 days):
${commitsSummary}

Open Pull Requests:
${prsSummary}
${staleText}

Generate a briefing that:
1. Groups commits by feature/intent (not just listing them)
2. Highlights PRs that need attention (especially those with comments or waiting on review)
3. Notes any concerning patterns (large changes without tests, etc.)
4. Suggests what to focus on today

Keep it concise. Focus on actionable information.
Output only the briefing content in markdown format, no preamble.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') return null;

  const lines = content.text.split('\n');
  let title = 'Code Review';
  let body = content.text;

  if (lines[0].startsWith('#')) {
    title = lines[0].replace(/^#+\s*/, '');
    body = lines.slice(1).join('\n').trim();
  }

  return {
    type: 'code_review',
    title,
    content: body,
    priority: 2,
    metadata: {
      commitCount: commits.length,
      prCount: pullRequests.length,
      staleBranchCount: staleBranches.length,
    },
  };
}

export async function generateOpenQuestionsCard(
  client: Anthropic,
  questions: OpenQuestion[],
  config: Config
): Promise<ArticleCard | null> {
  if (questions.length === 0) return null;

  const questionsText = formatQuestionsForBriefing(questions);

  const prompt = `Based on these open questions from recent development sessions, generate an "Open Questions" briefing card.

Open questions that weren't fully resolved:
${questionsText}

Generate a briefing that:
1. Groups related questions together
2. Prioritizes the most important unresolved questions
3. Suggests which questions to tackle first
4. Notes any questions that might be blockers

Keep it concise. Focus on helping the developer remember and prioritize these open items.
Output only the briefing content in markdown format, no preamble.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') return null;

  const lines = content.text.split('\n');
  let title = 'Open Questions';
  let body = content.text;

  if (lines[0].startsWith('#')) {
    title = lines[0].replace(/^#+\s*/, '');
    body = lines.slice(1).join('\n').trim();
  }

  return {
    type: 'open_questions',
    title,
    content: body,
    priority: 3,
    metadata: {
      questionCount: questions.length,
    },
  };
}

export async function generatePatternsCard(
  client: Anthropic,
  patterns: PatternAnalysis,
  config: Config
): Promise<ArticleCard | null> {
  // Only generate if we have meaningful patterns
  if (
    patterns.activeProjects.length === 0 &&
    patterns.frequentFiles.length === 0 &&
    patterns.recurringTopics.length === 0
  ) {
    return null;
  }

  const patternsSummary = formatPatternSummary(patterns);

  // Find peak working hours
  const peakHours = patterns.workingHours
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((h) => `${h.hour}:00`);

  const prompt = `Based on this analysis of recent development patterns, generate a "Weekly Patterns" briefing card.

Pattern Analysis:
${patternsSummary}

Peak working hours: ${peakHours.join(', ')}

Top tools used: ${patterns.toolUsage.slice(0, 5).map((t) => t.tool).join(', ')}

Generate a briefing that:
1. Highlights interesting patterns in work habits
2. Notes which projects/files are getting the most attention
3. Identifies any concerning patterns (e.g., lots of debugging, same files edited repeatedly)
4. Provides one actionable insight based on the patterns

Keep it brief and insightful. Focus on patterns that help the developer understand their work habits.
Output only the briefing content in markdown format, no preamble.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') return null;

  const lines = content.text.split('\n');
  let title = 'Weekly Patterns';
  let body = content.text;

  if (lines[0].startsWith('#')) {
    title = lines[0].replace(/^#+\s*/, '');
    body = lines.slice(1).join('\n').trim();
  }

  return {
    type: 'patterns',
    title,
    content: body,
    priority: 4,
    metadata: {
      projectCount: patterns.activeProjects.length,
      topicCount: patterns.recurringTopics.length,
    },
  };
}

export async function generateBriefing(
  config: Config,
  signals: ExtractedSignals
): Promise<Briefing> {
  const apiKey = config.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Anthropic API key not found. Set ANTHROPIC_API_KEY env var or add to config.'
    );
  }

  const client = new Anthropic({ apiKey });
  const dataDir = config.data_dir || `${process.env.HOME}/.cpulse`;

  // Analyze patterns and extract questions from sessions
  const patterns = analyzePatterns(signals.claudeCode.recentSessions);
  const questions = extractAllQuestions(signals.claudeCode.recentSessions);

  // Generate cards in parallel
  const cardPromises: Promise<ArticleCard | null>[] = [];

  // Project Continuity card (from Claude Code sessions)
  if (config.sources.claude_code.enabled && shouldIncludeCardType(dataDir, 'project_continuity')) {
    cardPromises.push(generateProjectContinuityCard(client, signals, config));
  }

  // Code Review card (from GitHub activity)
  if (config.sources.github.enabled && shouldIncludeCardType(dataDir, 'code_review')) {
    cardPromises.push(generateCodeReviewCard(client, signals, config));
  }

  // Open Questions card (from session analysis)
  if (config.sources.claude_code.enabled && shouldIncludeCardType(dataDir, 'open_questions')) {
    cardPromises.push(generateOpenQuestionsCard(client, questions, config));
  }

  // Patterns card (from session analysis)
  if (config.sources.claude_code.enabled && shouldIncludeCardType(dataDir, 'patterns')) {
    cardPromises.push(generatePatternsCard(client, patterns, config));
  }

  const cardResults = await Promise.all(cardPromises);
  const cards = cardResults.filter((c): c is ArticleCard => c !== null);

  // Sort by priority
  cards.sort((a, b) => a.priority - b.priority);

  // Limit to max_cards
  const limitedCards = cards.slice(0, config.preferences.max_cards);

  const briefing: Briefing = {
    id: `briefing-${Date.now()}`,
    date: new Date(),
    cards: limitedCards,
    generatedAt: new Date(),
  };

  return briefing;
}

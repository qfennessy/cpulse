import Anthropic from '@anthropic-ai/sdk';
import type {
  ArticleCard,
  Briefing,
  ExtractedSignals,
  Config,
  ClaudeCodeSession,
  GitHubCommit,
  GitHubPR,
  PostMergeComment,
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
import {
  commitLinkWithMessage,
  prLinkWithTitle,
  branchCompareLink,
} from '../presentation/index.js';
import {
  getParentProject,
  formatProjectWithWorktrees,
  groupByParentProject,
} from '../sources/worktree.js';
import {
  loadMemoryContext,
  formatMemoryForPrompt,
  type MemoryContext,
} from '../memory/index.js';

// Re-export intelligence types for external use
export type { PatternAnalysis, OpenQuestion };

const BASE_SYSTEM_PROMPT = `You are cpulse, a personal briefing assistant that generates concise, actionable insights from development activity.

Your communication style:
- Direct and technically accurate
- Concise (2-5 sentences per section)
- Use bullet points for actionable items
- Include specific file names, function names, or commit hashes when relevant
- Focus on what matters: unfinished work, blockers, and next steps
- No emojis, no excessive enthusiasm
- Markdown formatting for code snippets and emphasis

IMPORTANT: When the input contains markdown links like [text](url), you MUST preserve them exactly in your output. These links make the briefing actionable by letting the user click directly to PRs, commits, and files.

Your goal is to help the developer pick up where they left off and stay oriented on their projects.`;

/**
 * Build system prompt with optional memory context.
 * Memory provides project-specific knowledge for more relevant briefings.
 */
function buildSystemPrompt(memoryContext?: MemoryContext, primaryProject?: string): string {
  const memoryText = memoryContext ? formatMemoryForPrompt(memoryContext, primaryProject) : '';

  if (!memoryText) {
    return BASE_SYSTEM_PROMPT;
  }

  return `${BASE_SYSTEM_PROMPT}

## Project Memory

You have access to persistent project knowledge. Use this context to provide more relevant, project-aware insights:

${memoryText}

When generating briefings, consider:
- Project-specific conventions and patterns mentioned in memory
- Known architectural decisions and their rationale
- Team preferences and established workflows
- Previous context that might inform current work`;
}

function formatSessionSummary(session: ClaudeCodeSession): string {
  // Check if this session is part of a worktree
  const parentProject = getParentProject(session.projectPath, session.project);
  const isWorktree = parentProject !== session.project;

  const projectInfo = isWorktree
    ? `Project: ${session.project} (worktree of **${parentProject}**)`
    : `Project: ${session.project}`;

  const lines = [
    projectInfo,
    `Path: ${session.projectPath}`,
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

/**
 * Format sessions grouped by parent project (including worktrees).
 */
function formatGroupedSessionsSummary(sessions: ClaudeCodeSession[]): string {
  const groups = groupByParentProject(sessions);
  const lines: string[] = [];

  for (const [parentProject, { items, worktrees }] of groups) {
    const projectLabel = formatProjectWithWorktrees(parentProject, worktrees);
    lines.push(`\n**${projectLabel}:**`);

    // Show worktree breakdown if multiple
    if (worktrees.size > 1) {
      const worktreeList = Array.from(worktrees).slice(0, 5);
      lines.push(`  Worktrees: ${worktreeList.join(', ')}${worktrees.size > 5 ? ` (+${worktrees.size - 5} more)` : ''}`);
    }

    // Summarize sessions for this project group
    const sessionCount = items.length;
    const filesModified = new Set<string>();
    const todos: string[] = [];

    for (const session of items) {
      for (const file of session.filesModified) {
        filesModified.add(file);
      }
      for (const todo of session.todoItems) {
        if (todo.status !== 'completed') {
          todos.push(todo.content);
        }
      }
    }

    lines.push(`  Sessions: ${sessionCount}`);
    lines.push(`  Files modified: ${filesModified.size}`);

    if (todos.length > 0) {
      lines.push(`  Open todos: ${todos.slice(0, 3).join('; ')}${todos.length > 3 ? ` (+${todos.length - 3} more)` : ''}`);
    }
  }

  return lines.join('\n');
}

function formatCommitsSummary(commits: GitHubCommit[], withLinks = true): string {
  const byRepo: Record<string, GitHubCommit[]> = {};
  for (const commit of commits) {
    if (!byRepo[commit.repo]) byRepo[commit.repo] = [];
    byRepo[commit.repo].push(commit);
  }

  const lines: string[] = [];
  for (const [repo, repoCommits] of Object.entries(byRepo)) {
    lines.push(`\n**${repo}:**`);
    for (const commit of repoCommits.slice(0, 5)) {
      if (withLinks) {
        const link = commitLinkWithMessage(repo, commit.sha, commit.message);
        lines.push(`  - ${link} (+${commit.additions}/-${commit.deletions})`);
      } else {
        lines.push(
          `  - ${commit.sha.substring(0, 7)}: ${commit.message} (+${commit.additions}/-${commit.deletions})`
        );
      }
    }
    if (repoCommits.length > 5) {
      lines.push(`  ... and ${repoCommits.length - 5} more commits`);
    }
  }

  return lines.join('\n');
}

function formatPRsSummary(prs: GitHubPR[], withLinks = true): string {
  if (prs.length === 0) return 'No open PRs';

  const lines: string[] = [];
  for (const pr of prs) {
    const draft = pr.isDraft ? ' [DRAFT]' : '';
    const comments = pr.reviewComments > 0 ? ` (${pr.reviewComments} comments)` : '';
    if (withLinks) {
      const link = prLinkWithTitle(pr.repo, pr.number, pr.title);
      lines.push(`- ${link}${draft}${comments}`);
    } else {
      lines.push(`- ${pr.repo}#${pr.number}: ${pr.title}${draft}${comments}`);
    }
  }

  return lines.join('\n');
}

function formatStaleBranchesSummary(branches: string[], repos: string[], withLinks = true): string {
  if (branches.length === 0) return '';

  const lines: string[] = ['\n**Stale branches (>14 days):**'];

  // Try to associate branches with repos based on common patterns
  // For now, just list them. In a more sophisticated version, we'd track repo with branch
  for (const branch of branches.slice(0, 5)) {
    if (withLinks && repos.length > 0) {
      // Use first repo as default - this is a simplification
      const link = branchCompareLink(repos[0], branch);
      lines.push(`- ${link}`);
    } else {
      lines.push(`- ${branch}`);
    }
  }

  if (branches.length > 5) {
    lines.push(`... and ${branches.length - 5} more stale branches`);
  }

  return lines.join('\n');
}

function formatPostMergeCommentsSummary(comments: PostMergeComment[]): string {
  if (comments.length === 0) return 'No post-merge comments found';

  const lines: string[] = [];

  // Group by PR
  const byPR = new Map<string, PostMergeComment[]>();
  for (const comment of comments) {
    const key = `${comment.repo}#${comment.prNumber}`;
    if (!byPR.has(key)) {
      byPR.set(key, []);
    }
    byPR.get(key)!.push(comment);
  }

  for (const [prKey, prComments] of byPR) {
    const first = prComments[0];
    const mergedDate = first.mergedAt.toLocaleDateString();
    lines.push(`\n**${prKey}: ${first.prTitle}** (merged ${mergedDate})`);

    for (const comment of prComments.slice(0, 5)) {
      const timeAfterMerge = Math.round(
        (comment.createdAt.getTime() - comment.mergedAt.getTime()) / (1000 * 60 * 60)
      );
      const timeLabel = timeAfterMerge < 24
        ? `${timeAfterMerge}h after merge`
        : `${Math.round(timeAfterMerge / 24)}d after merge`;

      const truncatedBody = comment.body.length > 150
        ? comment.body.substring(0, 150) + '...'
        : comment.body;

      const location = comment.isReviewComment && comment.path
        ? ` on \`${comment.path}${comment.line ? `:${comment.line}` : ''}\``
        : '';

      lines.push(`  - **@${comment.author}**${location} (${timeLabel}):`);
      lines.push(`    "${truncatedBody}"`);
      lines.push(`    [View comment](${comment.url})`);
    }

    if (prComments.length > 5) {
      lines.push(`  ... and ${prComments.length - 5} more comments`);
    }
  }

  return lines.join('\n');
}

export async function generateProjectContinuityCard(
  client: Anthropic,
  signals: ExtractedSignals,
  config: Config,
  systemPrompt: string = BASE_SYSTEM_PROMPT
): Promise<ArticleCard | null> {
  const sessions = signals.claudeCode.recentSessions;
  if (sessions.length === 0) return null;

  // Use grouped summary for overview, detailed for recent sessions
  const groupedSummary = formatGroupedSessionsSummary(sessions);
  const recentSessionDetails = sessions
    .slice(0, 3)
    .map(formatSessionSummary)
    .join('\n\n---\n\n');

  const openTodos = signals.claudeCode.openTodos;
  const todosText =
    openTodos.length > 0
      ? `\n\nOpen todos across sessions:\n${openTodos.map((t) => `- [${t.status}] ${t.content}`).join('\n')}`
      : '';

  const prompt = `Based on these recent Claude Code sessions, generate a "Project Continuity" briefing card.

Project Overview (grouped by parent project, including worktrees):
${groupedSummary}

Recent Session Details:
${recentSessionDetails}
${todosText}

Generate a briefing that:
1. Identifies the main project(s) worked on (note: worktrees are branches of the same project)
2. Summarizes what was accomplished across all worktrees
3. Notes any unfinished work or open todos
4. Suggests concrete next steps

Keep it concise (2-4 short paragraphs or bullet lists). Focus on actionable information.
Output only the briefing content in markdown format, no preamble.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
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
  config: Config,
  systemPrompt: string = BASE_SYSTEM_PROMPT
): Promise<ArticleCard | null> {
  const { commits, pullRequests, staleBranches } = signals.github;

  if (commits.length === 0 && pullRequests.length === 0) return null;

  // Get list of repos for link generation
  const repos = [...new Set(commits.map((c) => c.repo))];

  const commitsSummary = formatCommitsSummary(commits, true);
  const prsSummary = formatPRsSummary(pullRequests, true);
  const staleText = formatStaleBranchesSummary(staleBranches, repos, true);

  const prompt = `Based on this GitHub activity, generate a "Code Review" briefing card.

Note: The commits and PRs include markdown links - preserve these links in your output where relevant.

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
    system: systemPrompt,
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
  config: Config,
  systemPrompt: string = BASE_SYSTEM_PROMPT
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
    system: systemPrompt,
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
  config: Config,
  systemPrompt: string = BASE_SYSTEM_PROMPT
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

Generate a PRESCRIPTIVE briefing that provides SPECIFIC, ACTIONABLE recommendations:

1. Identify ONE specific actionable recommendation based on the patterns observed
2. If same files are edited repeatedly (high churn), suggest: "Consider refactoring [filename] to reduce edit frequency"
3. If debugging patterns are frequent, suggest: "Add tests for [area] to catch issues earlier"
4. If work is scattered across many projects, suggest: "Focus today on completing work in [most active project]"
5. Based on peak hours, suggest optimal time blocks: "Schedule deep work between [peak hours]"

IMPORTANT:
- Be prescriptive, not just observational
- Every insight MUST lead to a specific "try this today" action
- End with a concrete, single-sentence recommendation the developer can act on immediately
- Do NOT just describe what happened - tell them what to DO about it

Keep it brief (2-3 short paragraphs). Focus on one or two key insights with clear actions.
Output only the briefing content in markdown format, no preamble.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
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

export async function generatePostMergeFeedbackCard(
  client: Anthropic,
  comments: PostMergeComment[],
  config: Config,
  systemPrompt: string = BASE_SYSTEM_PROMPT
): Promise<ArticleCard | null> {
  if (comments.length === 0) return null;

  const commentsSummary = formatPostMergeCommentsSummary(comments);

  const prompt = `Based on these post-merge PR comments (comments that were added AFTER the PR was already merged), generate a "Post-Merge Feedback" briefing card.

Post-merge comments require attention because:
1. The code is already in production/main branch
2. Feedback might indicate bugs, security issues, or improvements needed
3. Follow-up work may be required

Post-merge comments found:
${commentsSummary}

Generate a briefing that:
1. Highlights the most important feedback that needs attention
2. Groups related feedback by PR or theme
3. Notes any comments that suggest bugs or critical issues
4. Suggests follow-up actions (e.g., create issue, hotfix, address in next PR)

Keep it concise and actionable. Focus on what needs immediate attention vs. what can wait.
Output only the briefing content in markdown format, no preamble.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') return null;

  const lines = content.text.split('\n');
  let title = 'Post-Merge Feedback';
  let body = content.text;

  if (lines[0].startsWith('#')) {
    title = lines[0].replace(/^#+\s*/, '');
    body = lines.slice(1).join('\n').trim();
  }

  return {
    type: 'post_merge_feedback',
    title,
    content: body,
    priority: 1, // High priority - post-merge feedback needs attention
    metadata: {
      commentCount: comments.length,
      prCount: new Set(comments.map((c) => `${c.repo}#${c.prNumber}`)).size,
    },
  };
}

export async function generateBriefing(
  config: Config,
  signals: ExtractedSignals,
  options: { allCards?: boolean } = {}
): Promise<Briefing> {
  const { allCards = false } = options;
  const apiKey = config.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Anthropic API key not found. Set ANTHROPIC_API_KEY env var or add to config.'
    );
  }

  const client = new Anthropic({ apiKey });
  const dataDir = config.data_dir || `${process.env.HOME}/.cpulse`;

  // Load memory context from active project paths
  const projectPaths = signals.claudeCode.recentSessions
    .map((s) => s.projectPath || s.project)
    .filter(Boolean) as string[];
  const memoryContext = loadMemoryContext(projectPaths);

  // Determine primary project for memory lookup
  const primaryProject = signals.claudeCode.activeProjects[0] || undefined;

  // Build system prompt with memory context
  const systemPrompt = buildSystemPrompt(memoryContext, primaryProject);

  // Analyze patterns and extract questions from sessions
  const patterns = analyzePatterns(signals.claudeCode.recentSessions);
  const questions = extractAllQuestions(signals.claudeCode.recentSessions);

  // Generate cards in parallel
  const cardPromises: Promise<ArticleCard | null>[] = [];

  // Project Continuity card (from Claude Code sessions)
  if (config.sources.claude_code.enabled && (allCards || shouldIncludeCardType(dataDir, 'project_continuity'))) {
    cardPromises.push(generateProjectContinuityCard(client, signals, config, systemPrompt));
  }

  // Code Review card (from GitHub activity)
  if (config.sources.github.enabled && (allCards || shouldIncludeCardType(dataDir, 'code_review'))) {
    cardPromises.push(generateCodeReviewCard(client, signals, config, systemPrompt));
  }

  // Open Questions card (from session analysis)
  if (config.sources.claude_code.enabled && (allCards || shouldIncludeCardType(dataDir, 'open_questions'))) {
    cardPromises.push(generateOpenQuestionsCard(client, questions, config, systemPrompt));
  }

  // Patterns card (from session analysis)
  if (config.sources.claude_code.enabled && (allCards || shouldIncludeCardType(dataDir, 'patterns'))) {
    cardPromises.push(generatePatternsCard(client, patterns, config, systemPrompt));
  }

  // Post-Merge Feedback card (from GitHub post-merge comments)
  if (config.sources.github.enabled && (allCards || shouldIncludeCardType(dataDir, 'post_merge_feedback'))) {
    cardPromises.push(generatePostMergeFeedbackCard(client, signals.github.postMergeComments, config, systemPrompt));
  }

  const cardResults = await Promise.all(cardPromises);
  const cards = cardResults.filter((c): c is ArticleCard => c !== null);

  // Sort by config order (enabled_cards key order), then by priority as fallback
  const enabledCards = config.preferences?.enabled_cards || {};
  const cardOrder = Object.keys(enabledCards).filter(key => enabledCards[key]);
  cards.sort((a, b) => {
    const aIndex = cardOrder.indexOf(a.type);
    const bIndex = cardOrder.indexOf(b.type);
    // If both in config, use config order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // If only one in config, it comes first
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    // Neither in config, fall back to priority
    return a.priority - b.priority;
  });

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

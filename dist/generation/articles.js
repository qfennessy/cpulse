import Anthropic from '@anthropic-ai/sdk';
import { analyzePatterns, formatPatternSummary, extractAllQuestions, formatQuestionsForBriefing, shouldIncludeCardType, } from '../intelligence/index.js';
import { commitLinkWithMessage, prLinkWithTitle, branchCompareLink, } from '../presentation/index.js';
import { getParentProject, formatProjectWithWorktrees, groupByParentProject, } from '../sources/worktree.js';
import { loadMemoryContext, formatMemoryForPrompt, } from '../memory/index.js';
import { detectTechStack, formatTechStack } from '../intelligence/stack-detector.js';
import { analyzePRChallenges, formatChallengeAnalysis, hasChallengeData } from '../intelligence/pr-analyzer.js';
import { detectCostPatterns, formatCostInsights, hasCostData } from '../intelligence/cost-patterns.js';
import { getTrends, formatTrendsForPrompt, buildTrendQueries } from '../intelligence/web-trends.js';
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
function buildSystemPrompt(memoryContext, primaryProject) {
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

/**
 * Get the days of the week when a card type should appear (for weekly rotation).
 * Returns null for daily cards, or array of day numbers (0=Sun, 1=Mon, etc.)
 */
function getWeeklyRotationDays(cardType) {
    const rotations = {
        challenge_insights: [1, 2],  // Mon, Tue
        tech_advisory: [3, 4],       // Wed, Thu
        cost_optimization: [5],      // Fri
    };
    return rotations[cardType] || null;
}

/**
 * Check if a card type should be generated based on user config, rotation, and feedback.
 * @param {object} options - Options object
 * @param {boolean} options.allCards - If true, bypass weekly rotation check
 */
function shouldGenerateCard(config, dataDir, cardType, options = {}) {
    const { allCards = false } = options;

    // Check user config - explicit disable
    const enabledCards = config.preferences?.enabled_cards || {};
    if (enabledCards[cardType] === false) {
        return false;
    }

    // Check weekly rotation for advisory cards (skip if allCards is true)
    if (!allCards) {
        const rotationDays = getWeeklyRotationDays(cardType);
        if (rotationDays) {
            const today = new Date().getDay();
            if (!rotationDays.includes(today)) {
                return false;
            }
        }
    }

    // Feedback-based exclusion (existing logic)
    return shouldIncludeCardType(dataDir, cardType);
}
function formatSessionSummary(session) {
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
            const truncated = msg.content.length > 200
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
function formatGroupedSessionsSummary(sessions) {
    const groups = groupByParentProject(sessions);
    const lines = [];
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
        const filesModified = new Set();
        const todos = [];
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
function formatCommitsSummary(commits, withLinks = true) {
    const byRepo = {};
    for (const commit of commits) {
        if (!byRepo[commit.repo])
            byRepo[commit.repo] = [];
        byRepo[commit.repo].push(commit);
    }
    const lines = [];
    for (const [repo, repoCommits] of Object.entries(byRepo)) {
        lines.push(`\n**${repo}:**`);
        for (const commit of repoCommits.slice(0, 5)) {
            if (withLinks) {
                const link = commitLinkWithMessage(repo, commit.sha, commit.message);
                lines.push(`  - ${link} (+${commit.additions}/-${commit.deletions})`);
            }
            else {
                lines.push(`  - ${commit.sha.substring(0, 7)}: ${commit.message} (+${commit.additions}/-${commit.deletions})`);
            }
        }
        if (repoCommits.length > 5) {
            lines.push(`  ... and ${repoCommits.length - 5} more commits`);
        }
    }
    return lines.join('\n');
}
function formatPRsSummary(prs, withLinks = true) {
    if (prs.length === 0)
        return 'No open PRs';
    const lines = [];
    for (const pr of prs) {
        const draft = pr.isDraft ? ' [DRAFT]' : '';
        const comments = pr.reviewComments > 0 ? ` (${pr.reviewComments} comments)` : '';
        if (withLinks) {
            const link = prLinkWithTitle(pr.repo, pr.number, pr.title);
            lines.push(`- ${link}${draft}${comments}`);
        }
        else {
            lines.push(`- ${pr.repo}#${pr.number}: ${pr.title}${draft}${comments}`);
        }
    }
    return lines.join('\n');
}
function formatStaleBranchesSummary(branches, repos, withLinks = true) {
    if (branches.length === 0)
        return '';
    const lines = ['\n**Stale branches (>14 days):**'];
    // Try to associate branches with repos based on common patterns
    // For now, just list them. In a more sophisticated version, we'd track repo with branch
    for (const branch of branches.slice(0, 5)) {
        if (withLinks && repos.length > 0) {
            // Use first repo as default - this is a simplification
            const link = branchCompareLink(repos[0], branch);
            lines.push(`- ${link}`);
        }
        else {
            lines.push(`- ${branch}`);
        }
    }
    if (branches.length > 5) {
        lines.push(`... and ${branches.length - 5} more stale branches`);
    }
    return lines.join('\n');
}
function formatPostMergeCommentsSummary(comments) {
    if (comments.length === 0)
        return 'No post-merge comments found';
    const lines = [];
    // Group by PR
    const byPR = new Map();
    for (const comment of comments) {
        const key = `${comment.repo}#${comment.prNumber}`;
        if (!byPR.has(key)) {
            byPR.set(key, []);
        }
        byPR.get(key).push(comment);
    }
    for (const [prKey, prComments] of byPR) {
        const first = prComments[0];
        const mergedDate = first.mergedAt.toLocaleDateString();
        lines.push(`\n**${prKey}: ${first.prTitle}** (merged ${mergedDate})`);
        for (const comment of prComments.slice(0, 5)) {
            const timeAfterMerge = Math.round((comment.createdAt.getTime() - comment.mergedAt.getTime()) / (1000 * 60 * 60));
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
export async function generateProjectContinuityCard(client, signals, config, systemPrompt = BASE_SYSTEM_PROMPT) {
    const sessions = signals.claudeCode.recentSessions;
    if (sessions.length === 0)
        return null;
    // Use grouped summary for overview, detailed for recent sessions
    const groupedSummary = formatGroupedSessionsSummary(sessions);
    const recentSessionDetails = sessions
        .slice(0, 3)
        .map(formatSessionSummary)
        .join('\n\n---\n\n');
    const openTodos = signals.claudeCode.openTodos;
    const todosText = openTodos.length > 0
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
    if (!content || content.type !== 'text')
        return null;
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
export async function generateCodeReviewCard(client, signals, config, systemPrompt = BASE_SYSTEM_PROMPT) {
    const { commits, pullRequests, staleBranches } = signals.github;
    if (commits.length === 0 && pullRequests.length === 0)
        return null;
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
    if (!content || content.type !== 'text')
        return null;
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
export async function generateOpenQuestionsCard(client, questions, config, systemPrompt = BASE_SYSTEM_PROMPT) {
    if (questions.length === 0)
        return null;
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
    if (!content || content.type !== 'text')
        return null;
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
export async function generatePatternsCard(client, patterns, config, systemPrompt = BASE_SYSTEM_PROMPT) {
    // Only generate if we have meaningful patterns
    if (patterns.activeProjects.length === 0 &&
        patterns.frequentFiles.length === 0 &&
        patterns.recurringTopics.length === 0) {
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
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
    });
    const content = response.content[0];
    if (!content || content.type !== 'text')
        return null;
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
export async function generatePostMergeFeedbackCard(client, comments, config, systemPrompt = BASE_SYSTEM_PROMPT) {
    if (comments.length === 0)
        return null;
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
    if (!content || content.type !== 'text')
        return null;
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

export async function generateTechAdvisoryCard(client, stack, trends, config, systemPrompt = BASE_SYSTEM_PROMPT) {
    // Need a detected stack to provide relevant advice
    if (stack.languages.length === 0 && stack.frameworks.length === 0) {
        return null;
    }

    const stackSummary = formatTechStack(stack);
    const trendsSummary = formatTrendsForPrompt(trends.trends, stack);
    const searchQueries = buildTrendQueries(stack);

    const prompt = `Based on this tech stack and recent trends, generate a "Tech Advisory" briefing card.

**Detected Tech Stack:**
${stackSummary}

**Recent Trends & Best Practices:**
${trendsSummary}

**Search Queries for Latest Info (if web search available):**
${searchQueries.join('\n')}

Generate an advisory card that:
1. Focuses on ONE specific, actionable tip relevant to their stack
2. Includes a production-ready code example they can use today
3. Explains WHY this matters (performance, security, DX, cost)
4. Is written like a senior engineer sharing a tip, not a tutorial

Style: Concise, direct, technically accurate. Include working code.
Do NOT be generic - make it specific to their exact stack.

Output only the briefing content in markdown format, no preamble.`;

    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (!content || content.type !== 'text') return null;

    const lines = content.text.split('\n');
    let title = 'Tech Advisory';
    let body = content.text;
    if (lines[0].startsWith('#')) {
        title = lines[0].replace(/^#+\s*/, '');
        body = lines.slice(1).join('\n').trim();
    }

    return {
        type: 'tech_advisory',
        title,
        content: body,
        priority: 3,
        metadata: {
            stack: stack.languages.concat(stack.frameworks),
            trendsSource: trends.source,
        },
    };
}

export async function generateChallengeInsightsCard(client, analysis, config, systemPrompt = BASE_SYSTEM_PROMPT) {
    // Need enough data to provide meaningful insights
    if (!hasChallengeData(analysis)) {
        return null;
    }

    const analysisSummary = formatChallengeAnalysis(analysis);

    const prompt = `Based on this analysis of PR review patterns and errors, generate a "Challenge Insights" briefing card.

**Analysis of Recent PRs and Sessions:**
${analysisSummary}

Generate a briefing that:
1. Identifies the TOP 1-2 recurring patterns causing issues
2. Provides specific, preventive measures
3. Includes a "before/after" code example showing the fix
4. Suggests a PR checklist item to prevent future occurrences

Style: Direct and specific. This is about preventing recurring issues, not lecturing.
Focus on quick wins that take <10 minutes to implement.

Output only the briefing content in markdown format, no preamble.`;

    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (!content || content.type !== 'text') return null;

    const lines = content.text.split('\n');
    let title = 'Challenge Insights';
    let body = content.text;
    if (lines[0].startsWith('#')) {
        title = lines[0].replace(/^#+\s*/, '');
        body = lines.slice(1).join('\n').trim();
    }

    return {
        type: 'challenge_insights',
        title,
        content: body,
        priority: 2,
        metadata: {
            patternCount: analysis.patterns.length,
            errorCount: analysis.errorPatterns.length,
            analyzedPRs: analysis.analyzedPRs,
        },
    };
}

export async function generateCostOptimizationCard(client, insights, stack, config, systemPrompt = BASE_SYSTEM_PROMPT) {
    // Need GCP stack or detected patterns to provide relevant advice
    if (!hasCostData(insights, stack)) {
        return null;
    }

    const insightsSummary = formatCostInsights(insights, stack);

    const prompt = `Based on this GCP usage analysis, generate a "Cost Optimization" briefing card.

**Cloud Stack & Detected Patterns:**
${insightsSummary}

Generate a briefing that:
1. Focuses on ONE specific cost optimization opportunity
2. Estimates potential savings (minor/moderate/significant impact)
3. Provides a "before/after" code example with implementation guidance
4. Notes any trade-offs to consider

Focus on quick wins - changes that take <1 hour but reduce costs.
Be specific to their stack (GCP, Firestore, Cloud Run).

Output only the briefing content in markdown format, no preamble.`;

    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (!content || content.type !== 'text') return null;

    const lines = content.text.split('\n');
    let title = 'Cost Optimization';
    let body = content.text;
    if (lines[0].startsWith('#')) {
        title = lines[0].replace(/^#+\s*/, '');
        body = lines.slice(1).join('\n').trim();
    }

    return {
        type: 'cost_optimization',
        title,
        content: body,
        priority: 4,
        metadata: {
            cloudProvider: stack.cloudProvider,
            insightCount: insights.length,
        },
    };
}

export async function generateBriefing(config, signals, options = {}) {
    const { allCards = false } = options;
    const apiKey = config.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('Anthropic API key not found. Set ANTHROPIC_API_KEY env var or add to config.');
    }
    const client = new Anthropic({ apiKey });
    const dataDir = config.data_dir || `${process.env.HOME}/.cpulse`;
    // Load memory context from active project paths
    const projectPaths = signals.claudeCode.recentSessions.map((s) => s.projectPath || s.project).filter(Boolean);
    const memoryContext = loadMemoryContext(projectPaths);
    // Determine primary project for memory lookup
    const primaryProject = signals.claudeCode.activeProjects[0] || undefined;
    // Build system prompt with memory context
    const systemPrompt = buildSystemPrompt(memoryContext, primaryProject);
    // Analyze patterns and extract questions from sessions
    const patterns = analyzePatterns(signals.claudeCode.recentSessions);
    const questions = extractAllQuestions(signals.claudeCode.recentSessions);

    // Detect tech stack for advisory cards
    const techStack = detectTechStack(projectPaths);
    const trends = getTrends(techStack);

    // Analyze PR challenges for insights card
    const challengeAnalysis = analyzePRChallenges(
        signals.github.postMergeComments,
        signals.claudeCode.recentSessions
    );

    // Detect cost optimization patterns
    const costInsights = detectCostPatterns(techStack, signals.claudeCode.recentSessions);

    // Generate cards in parallel
    const cardPromises = [];
    const cardOpts = { allCards };

    // Project Continuity card (from Claude Code sessions)
    if (config.sources.claude_code.enabled && shouldGenerateCard(config, dataDir, 'project_continuity', cardOpts)) {
        cardPromises.push(generateProjectContinuityCard(client, signals, config, systemPrompt));
    }
    // Code Review card (from GitHub activity)
    if (config.sources.github.enabled && shouldGenerateCard(config, dataDir, 'code_review', cardOpts)) {
        cardPromises.push(generateCodeReviewCard(client, signals, config, systemPrompt));
    }
    // Open Questions card (from session analysis)
    if (config.sources.claude_code.enabled && shouldGenerateCard(config, dataDir, 'open_questions', cardOpts)) {
        cardPromises.push(generateOpenQuestionsCard(client, questions, config, systemPrompt));
    }
    // Patterns card (from session analysis)
    if (config.sources.claude_code.enabled && shouldGenerateCard(config, dataDir, 'patterns', cardOpts)) {
        cardPromises.push(generatePatternsCard(client, patterns, config, systemPrompt));
    }
    // Post-Merge Feedback card (from GitHub post-merge comments)
    if (config.sources.github.enabled && shouldGenerateCard(config, dataDir, 'post_merge_feedback', cardOpts)) {
        cardPromises.push(generatePostMergeFeedbackCard(client, signals.github.postMergeComments, config, systemPrompt));
    }
    // Tech Advisory card (Wed/Thu - stack-aware architectural advice)
    if (shouldGenerateCard(config, dataDir, 'tech_advisory', cardOpts)) {
        cardPromises.push(generateTechAdvisoryCard(client, techStack, trends, config, systemPrompt));
    }
    // Challenge Insights card (Mon/Tue - PR pattern analysis)
    if (shouldGenerateCard(config, dataDir, 'challenge_insights', cardOpts)) {
        cardPromises.push(generateChallengeInsightsCard(client, challengeAnalysis, config, systemPrompt));
    }
    // Cost Optimization card (Fri - GCP cost tips)
    if (shouldGenerateCard(config, dataDir, 'cost_optimization', cardOpts)) {
        cardPromises.push(generateCostOptimizationCard(client, costInsights, techStack, config, systemPrompt));
    }
    const cardResults = await Promise.all(cardPromises);
    const cards = cardResults.filter((c) => c !== null);
    // Sort by priority
    cards.sort((a, b) => a.priority - b.priority);
    // Limit to max_cards
    const limitedCards = cards.slice(0, config.preferences.max_cards);
    const briefing = {
        id: `briefing-${Date.now()}`,
        date: new Date(),
        cards: limitedCards,
        generatedAt: new Date(),
    };
    return briefing;
}
//# sourceMappingURL=articles.js.map
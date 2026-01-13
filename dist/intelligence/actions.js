/**
 * Action item extraction from signals.
 * Transforms enriched data into prioritized, actionable items.
 */
/**
 * Generate a GitHub PR URL.
 */
function getPRUrl(repo, number) {
    return `https://github.com/${repo}/pull/${number}`;
}
/**
 * Extract prioritized action items from all signal sources.
 * Priority order:
 * 1. Critical post-merge comments (code already in production)
 * 2. Blockers (preventing progress)
 * 3. Review requests (blocking others, sorted by age)
 * 4. Recurring todos (appeared in 2+ sessions)
 * 5. Open questions requiring follow-up
 */
export function extractActionItems(signals) {
    const items = [];
    // 1. Critical post-merge comments (highest priority - code is in production)
    const criticalComments = signals.github.postMergeComments
        .filter(c => c.severity === 'critical')
        .slice(0, 3);
    for (const comment of criticalComments) {
        items.push({
            id: `pmc-critical-${comment.id}`,
            content: `Address critical feedback on ${comment.repo}#${comment.prNumber}: ${comment.prTitle}`,
            category: 'post_merge',
            priority: 1,
            source: {
                type: 'comment',
                ref: String(comment.id),
                project: comment.repo,
            },
            estimatedEffort: 'medium',
            deepLink: comment.url,
            context: comment.severityReason || 'Critical issue in production code',
        });
    }
    // 2. Blockers (preventing progress)
    const blockers = signals.claudeCode.blockers || [];
    for (const blocker of blockers.slice(0, 3)) {
        items.push({
            id: `blocker-${blocker.sessionId}-${blocker.detectedAt.getTime()}`,
            content: blocker.blockedBy
                ? `Unblock: ${blocker.blockedBy}`
                : `Follow up: waiting on ${blocker.waitingOn}`,
            category: 'blocker',
            priority: 2,
            source: {
                type: 'session',
                ref: blocker.sessionId,
                project: blocker.project,
            },
            estimatedEffort: 'medium',
            context: blocker.description.substring(0, 100),
        });
    }
    // 3. Review requests awaiting your review (you're blocking others)
    const reviewRequests = signals.github.pullRequests
        .filter(pr => pr.isReviewRequested)
        .sort((a, b) => (b.reviewAgeInDays || 0) - (a.reviewAgeInDays || 0));
    for (const pr of reviewRequests.slice(0, 3)) {
        const waitingDays = pr.reviewAgeInDays || pr.ageInDays || 0;
        items.push({
            id: `review-${pr.repo}-${pr.number}`,
            content: `Review ${pr.repo}#${pr.number}: ${pr.title}`,
            category: 'pr_review',
            priority: waitingDays > 3 ? 2 : 3,
            source: {
                type: 'pr',
                ref: String(pr.number),
                project: pr.repo,
            },
            estimatedEffort: 'small',
            deepLink: getPRUrl(pr.repo, pr.number),
            context: waitingDays > 0 ? `Waiting ${waitingDays} day${waitingDays !== 1 ? 's' : ''} for your review` : undefined,
        });
    }
    // 4. Recurring todos (indicates important unfinished work)
    const recurringTodos = signals.claudeCode.openTodos
        .filter(t => (t.occurrenceCount || 1) > 1)
        .slice(0, 3);
    for (const todo of recurringTodos) {
        items.push({
            id: `todo-recurring-${todo.content.substring(0, 30).replace(/\s+/g, '-')}`,
            content: todo.content,
            category: 'todo',
            priority: 4,
            source: {
                type: 'session',
                ref: todo.sessionId || '',
                project: todo.project,
            },
            estimatedEffort: 'small',
            deepLink: todo.projectPath ? `cd ${todo.projectPath}` : undefined,
            context: `Appeared ${todo.occurrenceCount} times across sessions`,
        });
    }
    // 5. Post-merge questions (need response)
    const questionComments = signals.github.postMergeComments
        .filter(c => c.severity === 'question')
        .slice(0, 2);
    for (const comment of questionComments) {
        items.push({
            id: `pmc-question-${comment.id}`,
            content: `Reply to question on ${comment.repo}#${comment.prNumber}`,
            category: 'question',
            priority: 5,
            source: {
                type: 'comment',
                ref: String(comment.id),
                project: comment.repo,
            },
            estimatedEffort: 'trivial',
            deepLink: comment.url,
            context: comment.body.substring(0, 80) + (comment.body.length > 80 ? '...' : ''),
        });
    }
    // Sort by priority
    items.sort((a, b) => a.priority - b.priority);
    // Mark first item as "Start Here"
    if (items.length > 0) {
        items[0].isStartHere = true;
    }
    return items;
}
/**
 * Extract quick wins - small tasks that can be done in < 15 minutes.
 */
export function extractQuickWins(signals) {
    const quickWins = [];
    // Small, non-complex todos
    const smallTodos = signals.claudeCode.openTodos
        .filter(t => {
        const content = t.content.toLowerCase();
        // Skip complex tasks
        if (content.includes('refactor') || content.includes('rewrite'))
            return false;
        if (content.includes('implement') || content.includes('create'))
            return false;
        // Prefer short, specific todos
        return t.content.length < 100;
    })
        .slice(0, 5);
    for (const todo of smallTodos) {
        // Detect trivial tasks by keywords
        const content = todo.content.toLowerCase();
        const isTrivial = content.includes('typo') ||
            content.includes('rename') ||
            content.includes('update comment') ||
            content.includes('remove unused') ||
            content.includes('fix lint') ||
            content.includes('add import');
        quickWins.push({
            id: `qw-todo-${todo.content.substring(0, 30).replace(/\s+/g, '-')}`,
            content: todo.content,
            category: 'quick_win',
            priority: 10,
            source: {
                type: 'session',
                ref: todo.sessionId || '',
                project: todo.project,
            },
            estimatedEffort: isTrivial ? 'trivial' : 'small',
            deepLink: todo.relatedFiles?.[0] ? `code ${todo.relatedFiles[0]}` : undefined,
        });
    }
    // Post-merge suggestions (easy to address)
    const suggestions = signals.github.postMergeComments
        .filter(c => c.severity === 'suggestion')
        .slice(0, 3);
    for (const comment of suggestions) {
        quickWins.push({
            id: `qw-suggestion-${comment.id}`,
            content: `Address suggestion: ${comment.body.substring(0, 60)}${comment.body.length > 60 ? '...' : ''}`,
            category: 'quick_win',
            priority: 11,
            source: {
                type: 'comment',
                ref: String(comment.id),
                project: comment.repo,
            },
            estimatedEffort: 'small',
            deepLink: comment.url,
        });
    }
    // Small PRs that are your own (quick to address comments)
    const smallOwnPRs = signals.github.pullRequests
        .filter(pr => !pr.isReviewRequested && pr.reviewComments > 0 && pr.reviewComments < 5)
        .slice(0, 2);
    for (const pr of smallOwnPRs) {
        quickWins.push({
            id: `qw-pr-${pr.repo}-${pr.number}`,
            content: `Address ${pr.reviewComments} comment${pr.reviewComments !== 1 ? 's' : ''} on your PR #${pr.number}`,
            category: 'quick_win',
            priority: 12,
            source: {
                type: 'pr',
                ref: String(pr.number),
                project: pr.repo,
            },
            estimatedEffort: 'small',
            deepLink: getPRUrl(pr.repo, pr.number),
        });
    }
    return quickWins;
}
/**
 * Format action items for display in the closing narrative.
 */
export function formatActionItemsForClosing(actionItems, quickWins) {
    const sections = [];
    // Start Here - single most important action
    const startHere = actionItems.find(a => a.isStartHere);
    if (startHere) {
        sections.push('**Start Here:**');
        sections.push(`→ ${startHere.content}`);
        if (startHere.deepLink) {
            // Format as clickable if it's a URL, otherwise as code
            if (startHere.deepLink.startsWith('http')) {
                sections.push(`  [Open in browser](${startHere.deepLink})`);
            }
            else {
                sections.push(`  \`${startHere.deepLink}\``);
            }
        }
        if (startHere.context) {
            sections.push(`  _${startHere.context}_`);
        }
        sections.push('');
    }
    // Priority actions (excluding the start here item)
    const priorities = actionItems.filter(a => !a.isStartHere).slice(0, 4);
    if (priorities.length > 0) {
        sections.push('**Priority Actions:**');
        for (let i = 0; i < priorities.length; i++) {
            const item = priorities[i];
            let line = `${i + 1}. ${item.content}`;
            if (item.deepLink?.startsWith('http')) {
                line += ` ([link](${item.deepLink}))`;
            }
            sections.push(line);
        }
        sections.push('');
    }
    // Quick wins
    if (quickWins.length > 0) {
        const topQuickWins = quickWins.slice(0, 3);
        sections.push('**Quick Wins (< 15 min):**');
        for (const item of topQuickWins) {
            sections.push(`- ${item.content}`);
        }
        sections.push('');
    }
    if (sections.length === 0) {
        return "That's your briefing. Have a productive session.";
    }
    sections.push("---\nThat's your briefing. Let's build something great.");
    return sections.join('\n');
}
//# sourceMappingURL=actions.js.map
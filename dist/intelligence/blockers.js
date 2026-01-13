/**
 * Blocker detection from Claude Code sessions.
 * Identifies when work is blocked or waiting on external dependencies.
 */
// Patterns that indicate blocked work
const BLOCKER_PATTERNS = [
    // Explicit blocking statements
    { pattern: /blocked by (?<match>.+?)(?:\.|,|$)/i, type: 'blockedBy' },
    { pattern: /blocking on (?<match>.+?)(?:\.|,|$)/i, type: 'blockedBy' },
    { pattern: /stuck on (?<match>.+?)(?:\.|,|$)/i, type: 'blockedBy' },
    { pattern: /can'?t proceed (?:until|without) (?<match>.+?)(?:\.|,|$)/i, type: 'blockedBy' },
    // Waiting patterns
    { pattern: /waiting (?:on|for) (?<match>.+?)(?:\.|,|$)/i, type: 'waitingOn' },
    { pattern: /depends on (?<match>.+?)(?:\.|,|$)/i, type: 'waitingOn' },
    { pattern: /need(?:s|ing)? (?<match>.+?) (?:to continue|before|first)/i, type: 'waitingOn' },
    { pattern: /pending (?<match>.+?) (?:review|approval|response)/i, type: 'waitingOn' },
    // External dependency patterns
    { pattern: /waiting for (?<match>(?:api|team|review|approval|merge).+?)(?:\.|,|$)/i, type: 'waitingOn' },
    { pattern: /(?<match>pr #?\d+) (?:needs|requires|is blocking)/i, type: 'blockedBy' },
];
/**
 * Extract blockers from a single session's messages.
 */
function extractSessionBlockers(session) {
    const blockers = [];
    for (const message of session.messages) {
        // Only check user messages (they express what's blocking them)
        if (message.role !== 'user')
            continue;
        // Skip very short messages
        if (message.content.length < 20)
            continue;
        for (const { pattern, type } of BLOCKER_PATTERNS) {
            const match = message.content.match(pattern);
            if (match?.groups?.match) {
                const matchedText = match.groups.match.trim();
                // Skip if the match is too short or generic
                if (matchedText.length < 3 || matchedText.length > 100)
                    continue;
                const blocker = {
                    description: message.content.substring(0, 200),
                    project: session.project,
                    sessionId: session.id,
                    detectedAt: message.timestamp,
                };
                if (type === 'blockedBy') {
                    blocker.blockedBy = matchedText;
                }
                else {
                    blocker.waitingOn = matchedText;
                }
                blockers.push(blocker);
                break; // One blocker per message to avoid duplicates
            }
        }
    }
    return blockers;
}
/**
 * Extract all blockers from multiple sessions.
 * Deduplicates similar blockers across sessions.
 */
export function extractBlockers(sessions) {
    const allBlockers = [];
    for (const session of sessions) {
        const sessionBlockers = extractSessionBlockers(session);
        allBlockers.push(...sessionBlockers);
    }
    // Sort by detection time, most recent first
    allBlockers.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
    // Deduplicate by similar description (first 50 chars)
    const seen = new Set();
    return allBlockers.filter(blocker => {
        const key = blocker.description.substring(0, 50).toLowerCase();
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
/**
 * Group blockers by what's blocking them.
 */
export function groupBlockersBySource(blockers) {
    const grouped = new Map();
    for (const blocker of blockers) {
        const key = blocker.blockedBy || blocker.waitingOn || 'unknown';
        const existing = grouped.get(key);
        if (existing) {
            existing.push(blocker);
        }
        else {
            grouped.set(key, [blocker]);
        }
    }
    return grouped;
}
/**
 * Format blockers for inclusion in briefings.
 */
export function formatBlockersForBriefing(blockers) {
    if (blockers.length === 0) {
        return 'No blockers detected.';
    }
    const lines = [];
    const grouped = groupBlockersBySource(blockers);
    for (const [source, sourceBlockers] of grouped) {
        const label = sourceBlockers[0].blockedBy ? 'Blocked by' : 'Waiting on';
        lines.push(`**${label}: ${source}**`);
        for (const blocker of sourceBlockers.slice(0, 3)) {
            const truncatedDesc = blocker.description.length > 100
                ? blocker.description.substring(0, 100) + '...'
                : blocker.description;
            lines.push(`- ${blocker.project}: ${truncatedDesc}`);
        }
        if (sourceBlockers.length > 3) {
            lines.push(`  _...and ${sourceBlockers.length - 3} more_`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=blockers.js.map
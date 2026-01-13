/**
 * GitHub link generation utilities.
 * Creates clickable markdown links to PRs, commits, files, branches, etc.
 */
/**
 * Parse a repo string like "owner/repo" into components.
 */
export function parseRepoString(repoString) {
    const parts = repoString.split('/');
    if (parts.length !== 2) {
        return null;
    }
    return { owner: parts[0], repo: parts[1] };
}
/**
 * Generate a GitHub PR link.
 * @example prLink("owner/repo", 123) -> "[#123](https://github.com/owner/repo/pull/123)"
 */
export function prLink(repo, prNumber) {
    const url = `https://github.com/${repo}/pull/${prNumber}`;
    return `[#${prNumber}](${url})`;
}
/**
 * Generate a GitHub PR link with title.
 * @example prLinkWithTitle("owner/repo", 123, "Fix auth bug") -> "[#123: Fix auth bug](https://...)"
 */
export function prLinkWithTitle(repo, prNumber, title) {
    const url = `https://github.com/${repo}/pull/${prNumber}`;
    const truncatedTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;
    return `[#${prNumber}: ${truncatedTitle}](${url})`;
}
/**
 * Generate a GitHub commit link.
 * @example commitLink("owner/repo", "abc1234") -> "[abc1234](https://github.com/owner/repo/commit/abc1234)"
 */
export function commitLink(repo, sha) {
    const shortSha = sha.substring(0, 7);
    const url = `https://github.com/${repo}/commit/${sha}`;
    return `[\`${shortSha}\`](${url})`;
}
/**
 * Generate a GitHub commit link with message.
 * @example commitLinkWithMessage("owner/repo", "abc1234", "Fix bug") -> "[`abc1234` Fix bug](https://...)"
 */
export function commitLinkWithMessage(repo, sha, message) {
    const shortSha = sha.substring(0, 7);
    const url = `https://github.com/${repo}/commit/${sha}`;
    // Get first line of commit message
    const firstLine = message.split('\n')[0];
    const truncated = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
    return `[\`${shortSha}\` ${truncated}](${url})`;
}
/**
 * Generate a GitHub file link.
 * @example fileLink("owner/repo", "src/auth.ts") -> "[src/auth.ts](https://github.com/owner/repo/blob/main/src/auth.ts)"
 */
export function fileLink(repo, filePath, branch = 'main') {
    const url = `https://github.com/${repo}/blob/${branch}/${filePath}`;
    return `[${filePath}](${url})`;
}
/**
 * Generate a GitHub file link with line number.
 * @example fileLinkWithLine("owner/repo", "src/auth.ts", 42) -> "[src/auth.ts:42](https://...#L42)"
 */
export function fileLinkWithLine(repo, filePath, lineNumber, branch = 'main') {
    const url = `https://github.com/${repo}/blob/${branch}/${filePath}#L${lineNumber}`;
    return `[${filePath}:${lineNumber}](${url})`;
}
/**
 * Generate a GitHub file link with line range.
 * @example fileLinkWithRange("owner/repo", "src/auth.ts", 42, 50) -> "[src/auth.ts:42-50](https://...#L42-L50)"
 */
export function fileLinkWithRange(repo, filePath, startLine, endLine, branch = 'main') {
    const url = `https://github.com/${repo}/blob/${branch}/${filePath}#L${startLine}-L${endLine}`;
    return `[${filePath}:${startLine}-${endLine}](${url})`;
}
/**
 * Generate a GitHub branch compare link.
 * @example branchCompareLink("owner/repo", "feature-x") -> "[feature-x](https://github.com/owner/repo/compare/main...feature-x)"
 */
export function branchCompareLink(repo, branch, baseBranch = 'main') {
    const url = `https://github.com/${repo}/compare/${baseBranch}...${branch}`;
    return `[${branch}](${url})`;
}
/**
 * Generate a GitHub branch link.
 * @example branchLink("owner/repo", "feature-x") -> "[feature-x](https://github.com/owner/repo/tree/feature-x)"
 */
export function branchLink(repo, branch) {
    const url = `https://github.com/${repo}/tree/${branch}`;
    return `[${branch}](${url})`;
}
/**
 * Generate a GitHub issue link.
 * @example issueLink("owner/repo", 42) -> "[#42](https://github.com/owner/repo/issues/42)"
 */
export function issueLink(repo, issueNumber) {
    const url = `https://github.com/${repo}/issues/${issueNumber}`;
    return `[#${issueNumber}](${url})`;
}
/**
 * Generate a GitHub repo link.
 * @example repoLink("owner/repo") -> "[owner/repo](https://github.com/owner/repo)"
 */
export function repoLink(repo) {
    const url = `https://github.com/${repo}`;
    return `[${repo}](${url})`;
}
/**
 * Auto-detect and linkify GitHub references in text.
 * Converts patterns like #123, abc1234, owner/repo#123 into clickable links.
 */
export function linkifyGitHubReferences(text, defaultRepo) {
    let result = text;
    // Pattern: owner/repo#123 -> PR or issue link
    result = result.replace(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)#(\d+)/g, (_, repo, num) => `[${repo}#${num}](https://github.com/${repo}/pull/${num})`);
    // Pattern: #123 (with default repo) -> PR or issue link
    if (defaultRepo) {
        result = result.replace(/(?<![a-zA-Z0-9_/])#(\d+)(?![a-zA-Z0-9])/g, (_, num) => `[#${num}](https://github.com/${defaultRepo}/pull/${num})`);
    }
    // Pattern: full SHA (40 chars) -> commit link
    if (defaultRepo) {
        result = result.replace(/(?<![a-zA-Z0-9])([a-f0-9]{40})(?![a-zA-Z0-9])/g, (_, sha) => `[\`${sha.substring(0, 7)}\`](https://github.com/${defaultRepo}/commit/${sha})`);
    }
    return result;
}
/**
 * Format a list of PRs with links.
 */
export function formatPRList(prs) {
    return prs
        .map((pr) => {
        const link = prLinkWithTitle(pr.repo, pr.number, pr.title);
        const badges = [];
        if (pr.isDraft)
            badges.push('DRAFT');
        if (pr.reviewComments && pr.reviewComments > 0) {
            badges.push(`${pr.reviewComments} comments`);
        }
        const badgeStr = badges.length > 0 ? ` [${badges.join(', ')}]` : '';
        return `- ${link}${badgeStr}`;
    })
        .join('\n');
}
/**
 * Format a list of commits with links.
 */
export function formatCommitList(commits) {
    return commits
        .map((c) => {
        const link = commitLinkWithMessage(c.repo, c.sha, c.message);
        const stats = c.additions !== undefined && c.deletions !== undefined
            ? ` (+${c.additions}/-${c.deletions})`
            : '';
        return `- ${link}${stats}`;
    })
        .join('\n');
}
/**
 * Format a list of stale branches with compare links.
 */
export function formatStaleBranchList(branches) {
    return branches
        .map((b) => {
        const link = branchCompareLink(b.repo, b.branch);
        const age = b.daysSinceUpdate ? ` (${b.daysSinceUpdate} days old)` : '';
        return `- ${link}${age}`;
    })
        .join('\n');
}
//# sourceMappingURL=links.js.map
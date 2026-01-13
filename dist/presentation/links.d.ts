/**
 * GitHub link generation utilities.
 * Creates clickable markdown links to PRs, commits, files, branches, etc.
 */
export interface GitHubRepo {
    owner: string;
    repo: string;
}
/**
 * Parse a repo string like "owner/repo" into components.
 */
export declare function parseRepoString(repoString: string): GitHubRepo | null;
/**
 * Generate a GitHub PR link.
 * @example prLink("owner/repo", 123) -> "[#123](https://github.com/owner/repo/pull/123)"
 */
export declare function prLink(repo: string, prNumber: number): string;
/**
 * Generate a GitHub PR link with title.
 * @example prLinkWithTitle("owner/repo", 123, "Fix auth bug") -> "[#123: Fix auth bug](https://...)"
 */
export declare function prLinkWithTitle(repo: string, prNumber: number, title: string): string;
/**
 * Generate a GitHub commit link.
 * @example commitLink("owner/repo", "abc1234") -> "[abc1234](https://github.com/owner/repo/commit/abc1234)"
 */
export declare function commitLink(repo: string, sha: string): string;
/**
 * Generate a GitHub commit link with message.
 * @example commitLinkWithMessage("owner/repo", "abc1234", "Fix bug") -> "[`abc1234` Fix bug](https://...)"
 */
export declare function commitLinkWithMessage(repo: string, sha: string, message: string): string;
/**
 * Generate a GitHub file link.
 * @example fileLink("owner/repo", "src/auth.ts") -> "[src/auth.ts](https://github.com/owner/repo/blob/main/src/auth.ts)"
 */
export declare function fileLink(repo: string, filePath: string, branch?: string): string;
/**
 * Generate a GitHub file link with line number.
 * @example fileLinkWithLine("owner/repo", "src/auth.ts", 42) -> "[src/auth.ts:42](https://...#L42)"
 */
export declare function fileLinkWithLine(repo: string, filePath: string, lineNumber: number, branch?: string): string;
/**
 * Generate a GitHub file link with line range.
 * @example fileLinkWithRange("owner/repo", "src/auth.ts", 42, 50) -> "[src/auth.ts:42-50](https://...#L42-L50)"
 */
export declare function fileLinkWithRange(repo: string, filePath: string, startLine: number, endLine: number, branch?: string): string;
/**
 * Generate a GitHub branch compare link.
 * @example branchCompareLink("owner/repo", "feature-x") -> "[feature-x](https://github.com/owner/repo/compare/main...feature-x)"
 */
export declare function branchCompareLink(repo: string, branch: string, baseBranch?: string): string;
/**
 * Generate a GitHub branch link.
 * @example branchLink("owner/repo", "feature-x") -> "[feature-x](https://github.com/owner/repo/tree/feature-x)"
 */
export declare function branchLink(repo: string, branch: string): string;
/**
 * Generate a GitHub issue link.
 * @example issueLink("owner/repo", 42) -> "[#42](https://github.com/owner/repo/issues/42)"
 */
export declare function issueLink(repo: string, issueNumber: number): string;
/**
 * Generate a GitHub repo link.
 * @example repoLink("owner/repo") -> "[owner/repo](https://github.com/owner/repo)"
 */
export declare function repoLink(repo: string): string;
/**
 * Auto-detect and linkify GitHub references in text.
 * Converts patterns like #123, abc1234, owner/repo#123 into clickable links.
 */
export declare function linkifyGitHubReferences(text: string, defaultRepo?: string): string;
/**
 * Format a list of PRs with links.
 */
export declare function formatPRList(prs: Array<{
    repo: string;
    number: number;
    title: string;
    isDraft?: boolean;
    reviewComments?: number;
}>): string;
/**
 * Format a list of commits with links.
 */
export declare function formatCommitList(commits: Array<{
    repo: string;
    sha: string;
    message: string;
    additions?: number;
    deletions?: number;
}>): string;
/**
 * Format a list of stale branches with compare links.
 */
export declare function formatStaleBranchList(branches: Array<{
    repo: string;
    branch: string;
    daysSinceUpdate?: number;
}>): string;
//# sourceMappingURL=links.d.ts.map
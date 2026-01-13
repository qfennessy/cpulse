import { Octokit } from 'octokit';
import type { GitHubActivity, GitHubCommit, GitHubPR, GitHubSourceConfig, PostMergeComment } from '../types/index.js';
export declare function createGitHubClient(config: GitHubSourceConfig): Promise<Octokit>;
export declare function getRecentCommits(octokit: Octokit, config: GitHubSourceConfig, hoursBack?: number): Promise<GitHubCommit[]>;
export declare function getOpenPullRequests(octokit: Octokit, config: GitHubSourceConfig): Promise<GitHubPR[]>;
export declare function getStaleBranches(octokit: Octokit, config: GitHubSourceConfig, daysStale?: number): Promise<string[]>;
/**
 * Get comments on recently merged PRs that were created after the PR was merged.
 * These are "post-merge feedback" comments that might need attention.
 */
export declare function getPostMergeComments(octokit: Octokit, config: GitHubSourceConfig, daysBack?: number): Promise<PostMergeComment[]>;
export declare function getGitHubActivity(config: GitHubSourceConfig, hoursBack?: number): Promise<GitHubActivity>;
//# sourceMappingURL=github.d.ts.map
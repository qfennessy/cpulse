import { Octokit } from 'octokit';
import type {
  GitHubActivity,
  GitHubCommit,
  GitHubPR,
  GitHubSourceConfig,
  PostMergeComment,
} from '../types/index.js';

/**
 * Calculate PR age and urgency level.
 * Urgency is based on how long the PR has been open and comment activity.
 */
function calculatePRUrgency(pr: GitHubPR): void {
  const now = new Date();
  pr.ageInDays = Math.floor(
    (now.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate urgency based on age and activity
  if (pr.ageInDays > 14 || pr.reviewComments > 5) {
    pr.urgency = 'critical';
  } else if (pr.ageInDays > 7 || pr.reviewComments > 2) {
    pr.urgency = 'high';
  } else if (pr.ageInDays > 3) {
    pr.urgency = 'medium';
  } else {
    pr.urgency = 'low';
  }

  // If this is a review request, calculate how long review has been pending
  if (pr.isReviewRequested) {
    // Use updatedAt as proxy for when review was requested
    // (more accurate would require additional API calls)
    pr.reviewAgeInDays = Math.floor(
      (now.getTime() - pr.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
  }
}

/**
 * Classify post-merge comment severity based on content analysis.
 */
function classifyCommentSeverity(body: string): {
  severity: 'critical' | 'suggestion' | 'question' | 'info';
  severityReason: string;
  requiresFollowUp: boolean;
  suggestedAction?: string;
} {
  const bodyLower = body.toLowerCase();

  // Critical: Security, bugs, breaking changes
  const criticalPatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /security|vulnerability|exploit|injection|xss|csrf/i, label: 'security' },
    { pattern: /\bbug\b|broken|crash|fail(?:s|ed|ing)?|exception/i, label: 'bug' },
    { pattern: /breaking change|regression|reverted/i, label: 'breaking change' },
    { pattern: /urgent|asap|critical|blocker/i, label: 'urgent' },
  ];

  for (const { pattern, label } of criticalPatterns) {
    if (pattern.test(body)) {
      return {
        severity: 'critical',
        severityReason: `Contains ${label} indicator`,
        requiresFollowUp: true,
        suggestedAction: 'Create hotfix or issue immediately',
      };
    }
  }

  // Question: Needs response
  if (body.includes('?') && body.length < 500) {
    const startsWithQuestion = /^(why|how|what|when|where|could|should|would|can|is|are|do|does)/im.test(body);
    if (startsWithQuestion || body.split('?').length > 1) {
      return {
        severity: 'question',
        severityReason: 'Contains question requiring response',
        requiresFollowUp: true,
        suggestedAction: 'Reply to comment',
      };
    }
  }

  // Suggestion: Improvement ideas
  const suggestionPatterns = [
    /suggest|consider|might want|could also|alternative/i,
    /nit:?|minor:?|style:?|formatting/i,
    /future|later|follow-up|next time/i,
    /\bimo\b|\bfyi\b|for your information/i,
  ];

  for (const pattern of suggestionPatterns) {
    if (pattern.test(body)) {
      return {
        severity: 'suggestion',
        severityReason: 'Contains improvement suggestion',
        requiresFollowUp: false,
        suggestedAction: 'Add to backlog for consideration',
      };
    }
  }

  // Default: Info
  return {
    severity: 'info',
    severityReason: 'General feedback',
    requiresFollowUp: false,
  };
}

export async function createGitHubClient(
  config: GitHubSourceConfig
): Promise<Octokit> {
  const token = config.token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      'GitHub token not found. Set GITHUB_PERSONAL_ACCESS_TOKEN env var or add token to config.'
    );
  }

  return new Octokit({ auth: token });
}

export async function getRecentCommits(
  octokit: Octokit,
  config: GitHubSourceConfig,
  hoursBack: number = 168
): Promise<GitHubCommit[]> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const commits: GitHubCommit[] = [];

  // Get repos to check
  let repos = config.repos;

  if (!repos || repos.length === 0) {
    // Fetch all repos the user has access to
    const { data: userRepos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'pushed',
      per_page: 50,
      visibility: config.include_private ? 'all' : 'public',
    });
    repos = userRepos.map((r: { full_name: string }) => r.full_name);
  }

  for (const repoFullName of repos) {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) continue;

    try {
      const { data: repoCommits } = await octokit.rest.repos.listCommits({
        owner,
        repo,
        since,
        per_page: 20,
      });

      for (const commit of repoCommits) {
        // Get detailed commit info for stats
        let filesChanged = 0;
        let additions = 0;
        let deletions = 0;

        try {
          const { data: detail } = await octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: commit.sha,
          });
          filesChanged = detail.files?.length || 0;
          additions = detail.stats?.additions || 0;
          deletions = detail.stats?.deletions || 0;
        } catch {
          // Skip detailed stats on error
        }

        commits.push({
          sha: commit.sha.substring(0, 7),
          message: commit.commit.message.split('\n')[0], // First line only
          author: commit.commit.author?.name || 'unknown',
          date: new Date(commit.commit.author?.date || Date.now()),
          repo: repoFullName,
          filesChanged,
          additions,
          deletions,
        });
      }
    } catch {
      // Skip repos we can't access
    }
  }

  // Sort by date, most recent first
  commits.sort((a, b) => b.date.getTime() - a.date.getTime());

  return commits;
}

export async function getOpenPullRequests(
  octokit: Octokit,
  config: GitHubSourceConfig
): Promise<GitHubPR[]> {
  const pullRequests: GitHubPR[] = [];

  // Get repos to check
  let repos = config.repos;

  if (!repos || repos.length === 0) {
    const { data: userRepos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'pushed',
      per_page: 50,
      visibility: config.include_private ? 'all' : 'public',
    });
    repos = userRepos.map((r: { full_name: string }) => r.full_name);
  }

  // Also get PRs where user is requested reviewer
  // Using octokit.request directly to avoid deprecation warning on the wrapper method
  try {
    const { data: reviewRequests } = await octokit.request('GET /search/issues', {
      q: 'is:pr is:open review-requested:@me',
      per_page: 20,
    });

    for (const pr of reviewRequests.items) {
      const repoFullName = pr.repository_url.split('/').slice(-2).join('/');
      const ghPR: GitHubPR = {
        number: pr.number,
        title: pr.title,
        state: 'open',
        repo: repoFullName,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        reviewComments: pr.comments,
        isDraft: pr.draft || false,
        isReviewRequested: true,
      };
      calculatePRUrgency(ghPR);
      pullRequests.push(ghPR);
    }
  } catch {
    // Search might fail without proper permissions
  }

  // Get user's own PRs
  try {
    const { data: myPRs } = await octokit.request('GET /search/issues', {
      q: 'is:pr is:open author:@me',
      per_page: 20,
    });

    for (const pr of myPRs.items) {
      const repoFullName = pr.repository_url.split('/').slice(-2).join('/');

      // Skip if already added (check both PR number AND repo to avoid false matches)
      if (pullRequests.some((p) => p.number === pr.number && p.repo === repoFullName)) continue;
      const ghPR: GitHubPR = {
        number: pr.number,
        title: pr.title,
        state: 'open',
        repo: repoFullName,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        reviewComments: pr.comments,
        isDraft: pr.draft || false,
        isReviewRequested: false,
      };
      calculatePRUrgency(ghPR);
      pullRequests.push(ghPR);
    }
  } catch {
    // Search might fail
  }

  return pullRequests;
}

export async function getStaleBranches(
  octokit: Octokit,
  config: GitHubSourceConfig,
  daysStale: number = 14
): Promise<string[]> {
  const staleBranches: string[] = [];
  const staleDate = new Date(Date.now() - daysStale * 24 * 60 * 60 * 1000);

  let repos = config.repos;

  if (!repos || repos.length === 0) {
    const { data: userRepos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'pushed',
      per_page: 20,
      visibility: config.include_private ? 'all' : 'public',
    });
    repos = userRepos.map((r: { full_name: string }) => r.full_name);
  }

  for (const repoFullName of repos.slice(0, 10)) {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) continue;

    try {
      const { data: branches } = await octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 50,
      });

      for (const branch of branches) {
        // Skip default branches
        if (
          branch.name === 'main' ||
          branch.name === 'master' ||
          branch.name === 'develop'
        ) {
          continue;
        }

        try {
          const { data: branchDetail } = await octokit.rest.repos.getBranch({
            owner,
            repo,
            branch: branch.name,
          });

          const lastCommitDate = new Date(
            branchDetail.commit.commit.author?.date || Date.now()
          );

          if (lastCommitDate < staleDate) {
            staleBranches.push(`${repoFullName}:${branch.name}`);
          }
        } catch {
          // Skip branches we can't access
        }
      }
    } catch {
      // Skip repos we can't access
    }
  }

  return staleBranches.slice(0, 20);
}

/**
 * Get comments on recently merged PRs that were created after the PR was merged.
 * These are "post-merge feedback" comments that might need attention.
 */
export async function getPostMergeComments(
  octokit: Octokit,
  config: GitHubSourceConfig,
  daysBack: number = 14
): Promise<PostMergeComment[]> {
  const postMergeComments: PostMergeComment[] = [];
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  let repos = config.repos;

  if (!repos || repos.length === 0) {
    const { data: userRepos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'pushed',
      per_page: 20,
      visibility: config.include_private ? 'all' : 'public',
    });
    repos = userRepos.map((r: { full_name: string }) => r.full_name);
  }

  for (const repoFullName of repos.slice(0, 10)) {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) continue;

    try {
      // Get recently merged PRs
      const { data: mergedPRs } = await octokit.rest.pulls.list({
        owner,
        repo,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: 20,
      });

      for (const pr of mergedPRs) {
        // Skip if not merged or merged too long ago
        if (!pr.merged_at) continue;
        const mergedAt = new Date(pr.merged_at);
        if (mergedAt < since) continue;

        // Get review comments (inline code comments)
        try {
          const { data: reviewComments } = await octokit.rest.pulls.listReviewComments({
            owner,
            repo,
            pull_number: pr.number,
            per_page: 50,
          });

          for (const comment of reviewComments) {
            const commentDate = new Date(comment.created_at);
            // Only include comments created AFTER the PR was merged
            if (commentDate > mergedAt) {
              const severity = classifyCommentSeverity(comment.body || '');
              postMergeComments.push({
                id: comment.id,
                prNumber: pr.number,
                prTitle: pr.title,
                repo: repoFullName,
                author: comment.user?.login || 'unknown',
                body: comment.body || '',
                createdAt: commentDate,
                mergedAt,
                url: comment.html_url,
                isReviewComment: true,
                path: comment.path,
                line: comment.line || comment.original_line,
                ...severity,
              });
            }
          }
        } catch {
          // Skip on error
        }

        // Get issue comments (general PR comments)
        try {
          const { data: issueComments } = await octokit.rest.issues.listComments({
            owner,
            repo,
            issue_number: pr.number,
            per_page: 50,
          });

          for (const comment of issueComments) {
            const commentDate = new Date(comment.created_at);
            // Only include comments created AFTER the PR was merged
            if (commentDate > mergedAt) {
              const severity = classifyCommentSeverity(comment.body || '');
              postMergeComments.push({
                id: comment.id,
                prNumber: pr.number,
                prTitle: pr.title,
                repo: repoFullName,
                author: comment.user?.login || 'unknown',
                body: comment.body || '',
                createdAt: commentDate,
                mergedAt,
                url: comment.html_url,
                isReviewComment: false,
                ...severity,
              });
            }
          }
        } catch {
          // Skip on error
        }
      }
    } catch {
      // Skip repos we can't access
    }
  }

  // Sort by date, most recent first
  postMergeComments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return postMergeComments;
}

export async function getGitHubActivity(
  config: GitHubSourceConfig,
  hoursBack: number = 168
): Promise<GitHubActivity> {
  if (!config.enabled) {
    return { commits: [], pullRequests: [], staleBranches: [], postMergeComments: [] };
  }

  const octokit = await createGitHubClient(config);

  const [commits, pullRequests, staleBranches, postMergeComments] = await Promise.all([
    getRecentCommits(octokit, config, hoursBack),
    getOpenPullRequests(octokit, config),
    getStaleBranches(octokit, config),
    getPostMergeComments(octokit, config),
  ]);

  return { commits, pullRequests, staleBranches, postMergeComments };
}

import { Octokit } from 'octokit';
import type {
  GitHubActivity,
  GitHubCommit,
  GitHubPR,
  GitHubSourceConfig,
} from '../types/index.js';

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
  hoursBack: number = 24
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
      pullRequests.push({
        number: pr.number,
        title: pr.title,
        state: 'open',
        repo: repoFullName,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        reviewComments: pr.comments,
        isDraft: pr.draft || false,
      });
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
      pullRequests.push({
        number: pr.number,
        title: pr.title,
        state: 'open',
        repo: repoFullName,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        reviewComments: pr.comments,
        isDraft: pr.draft || false,
      });
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

export async function getGitHubActivity(
  config: GitHubSourceConfig,
  hoursBack: number = 24
): Promise<GitHubActivity> {
  if (!config.enabled) {
    return { commits: [], pullRequests: [], staleBranches: [] };
  }

  const octokit = await createGitHubClient(config);

  const [commits, pullRequests, staleBranches] = await Promise.all([
    getRecentCommits(octokit, config, hoursBack),
    getOpenPullRequests(octokit, config),
    getStaleBranches(octokit, config),
  ]);

  return { commits, pullRequests, staleBranches };
}

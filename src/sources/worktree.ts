import { execSync } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';

export interface WorktreeInfo {
  path: string;
  branch: string;
  isMain: boolean;
  parentProject?: string;
}

export interface ProjectGroup {
  mainProject: string;
  mainPath: string;
  worktrees: WorktreeInfo[];
  totalSessions: number;
}

/**
 * Detect if a directory is a git worktree (vs main repo).
 * Worktrees have a .git FILE (not directory) pointing to the main repo.
 */
export function isWorktree(projectPath: string): boolean {
  const gitPath = join(projectPath, '.git');

  if (!existsSync(gitPath)) {
    return false;
  }

  try {
    const stat = statSync(gitPath);
    // Worktrees have a .git file, main repos have a .git directory
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Get the main repository path for a worktree.
 * Parses the .git file which contains: gitdir: /path/to/main/.git/worktrees/name
 */
export function getMainRepoPath(worktreePath: string): string | null {
  const gitPath = join(worktreePath, '.git');

  if (!existsSync(gitPath)) {
    return null;
  }

  try {
    const stat = statSync(gitPath);

    if (stat.isDirectory()) {
      // This is the main repo itself
      return worktreePath;
    }

    // Parse the .git file
    const content = readFileSync(gitPath, 'utf-8').trim();
    const match = content.match(/^gitdir:\s*(.+)$/);

    if (!match) {
      return null;
    }

    const gitdir = match[1];
    // gitdir is like: /path/to/main/.git/worktrees/branch-name
    // We need to extract /path/to/main
    const worktreesIndex = gitdir.indexOf('/.git/worktrees/');

    if (worktreesIndex === -1) {
      return null;
    }

    return gitdir.substring(0, worktreesIndex);
  } catch {
    return null;
  }
}

/**
 * Get worktree info using git worktree list command.
 * Returns all worktrees for a given project.
 */
export function getWorktreeList(projectPath: string): WorktreeInfo[] {
  try {
    // First, find the main repo path
    const mainPath = getMainRepoPath(projectPath) || projectPath;

    const output = execSync('git worktree list --porcelain', {
      cwd: mainPath,
      encoding: 'utf-8',
      timeout: 5000,
    });

    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as WorktreeInfo);
        }
        current = { path: line.substring(9) };
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7).replace('refs/heads/', '');
      } else if (line === 'bare') {
        // Skip bare repos
        current = {};
      }
    }

    if (current.path) {
      worktrees.push(current as WorktreeInfo);
    }

    // Mark main vs worktrees
    for (const wt of worktrees) {
      wt.isMain = wt.path === mainPath;
      if (!wt.isMain) {
        wt.parentProject = basename(mainPath);
      }
    }

    return worktrees;
  } catch {
    return [];
  }
}

/**
 * Extract the likely parent project name from a worktree path.
 * Uses naming convention heuristics as fallback.
 *
 * Examples:
 * - cocos-story-gemini-live -> cocos-story
 * - cocos-story-claude-refactor-place-parsing-AuAUX -> cocos-story
 * - my-project-feature-branch -> my-project
 */
export function inferParentProjectFromName(projectName: string): string {
  // Common worktree naming patterns:
  // 1. project-name-feature-description
  // 2. project-name-claude-* (Claude Code auto-generated)
  // 3. project-name-branch-suffix

  // Try to detect Claude Code generated worktree names
  // Pattern: base-claude-description-hash
  const claudeMatch = projectName.match(/^(.+?)-claude-/);
  if (claudeMatch) {
    return claudeMatch[1];
  }

  // Try to find common suffixes that indicate a worktree
  const worktreeSuffixes = [
    '-feature-',
    '-fix-',
    '-bugfix-',
    '-hotfix-',
    '-release-',
    '-refactor-',
    '-test-',
    '-wip-',
    '-temp-',
    '-branch-',
  ];

  for (const suffix of worktreeSuffixes) {
    const idx = projectName.indexOf(suffix);
    if (idx > 0) {
      return projectName.substring(0, idx);
    }
  }

  // Check for random hash suffix (5+ chars at end after hyphen)
  const hashMatch = projectName.match(/^(.+)-[a-zA-Z0-9]{5,}$/);
  if (hashMatch) {
    // Recursively try to find parent from remaining name
    const remaining = hashMatch[1];
    if (remaining.includes('-')) {
      return inferParentProjectFromName(remaining);
    }
  }

  // No pattern matched, return original
  return projectName;
}

/**
 * Determine the parent project for a given project path.
 * Uses git worktree detection first, falls back to naming heuristics.
 */
export function getParentProject(projectPath: string, projectName: string): string {
  // First try git-based detection
  const mainPath = getMainRepoPath(projectPath);

  if (mainPath && mainPath !== projectPath) {
    return basename(mainPath);
  }

  // Fall back to naming heuristics
  const inferred = inferParentProjectFromName(projectName);

  // Only use inferred name if it's different and shorter
  if (inferred !== projectName && inferred.length < projectName.length) {
    return inferred;
  }

  return projectName;
}

/**
 * Group sessions by their parent project, aggregating worktrees.
 */
export function groupByParentProject<T extends { project: string; projectPath: string }>(
  items: T[]
): Map<string, { items: T[]; worktrees: Set<string> }> {
  const groups = new Map<string, { items: T[]; worktrees: Set<string> }>();

  for (const item of items) {
    const parent = getParentProject(item.projectPath, item.project);

    const existing = groups.get(parent);
    if (existing) {
      existing.items.push(item);
      existing.worktrees.add(item.project);
    } else {
      groups.set(parent, {
        items: [item],
        worktrees: new Set([item.project]),
      });
    }
  }

  return groups;
}

/**
 * Format project name with worktree indicator.
 */
export function formatProjectWithWorktrees(
  parentProject: string,
  worktrees: Set<string>
): string {
  const worktreeCount = worktrees.size;

  if (worktreeCount <= 1) {
    return parentProject;
  }

  return `${parentProject} (${worktreeCount} worktrees)`;
}

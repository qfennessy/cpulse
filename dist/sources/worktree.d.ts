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
export declare function isWorktree(projectPath: string): boolean;
/**
 * Get the main repository path for a worktree.
 * Parses the .git file which contains: gitdir: /path/to/main/.git/worktrees/name
 */
export declare function getMainRepoPath(worktreePath: string): string | null;
/**
 * Get worktree info using git worktree list command.
 * Returns all worktrees for a given project.
 */
export declare function getWorktreeList(projectPath: string): WorktreeInfo[];
/**
 * Extract the likely parent project name from a worktree path.
 * Uses naming convention heuristics as fallback.
 *
 * Examples:
 * - cocos-story-gemini-live -> cocos-story
 * - cocos-story-claude-refactor-place-parsing-AuAUX -> cocos-story
 * - my-project-feature-branch -> my-project
 */
export declare function inferParentProjectFromName(projectName: string): string;
/**
 * Determine the parent project for a given project path.
 * Uses git worktree detection first, falls back to naming heuristics.
 */
export declare function getParentProject(projectPath: string, projectName: string): string;
/**
 * Group sessions by their parent project, aggregating worktrees.
 */
export declare function groupByParentProject<T extends {
    project: string;
    projectPath: string;
}>(items: T[]): Map<string, {
    items: T[];
    worktrees: Set<string>;
}>;
/**
 * Format project name with worktree indicator.
 */
export declare function formatProjectWithWorktrees(parentProject: string, worktrees: Set<string>): string;
//# sourceMappingURL=worktree.d.ts.map
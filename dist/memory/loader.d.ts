/**
 * Memory file loader for project context.
 * Loads and parses memory.md files for context-aware briefings.
 *
 * Created: 2026-01-13
 */
export interface ProjectMemory {
    projectName: string;
    projectPath: string;
    gitRoot: string | null;
    content: string;
    sections: MemorySection[];
    lastModified: Date;
}
export interface MemorySection {
    title: string;
    content: string;
    level: number;
}
export interface MemoryContext {
    global: ProjectMemory | null;
    projects: Map<string, ProjectMemory>;
}
/**
 * Load a memory file from a path.
 */
export declare function loadMemoryFile(filePath: string, projectName: string, gitRoot?: string | null): ProjectMemory | null;
/**
 * Load global memory from ~/.cpulse/memory.md
 */
export declare function loadGlobalMemory(): ProjectMemory | null;
/**
 * Find memory.md in a project directory or its docs folder.
 */
export declare function findProjectMemory(projectPath: string): string | null;
/**
 * Get the git root directory for a path.
 */
export declare function getGitRoot(path: string): string | null;
/**
 * Extract project name from path.
 */
export declare function extractProjectName(projectPath: string): string;
/**
 * Load memory for a specific project path.
 */
export declare function loadProjectMemory(projectPath: string): ProjectMemory | null;
/**
 * Load all memory context (global + project-specific).
 * Map is keyed by full path (git root or project path) to avoid collisions
 * when multiple projects share the same directory name.
 */
export declare function loadMemoryContext(projectPaths: string[]): MemoryContext;
/**
 * Format memory context for inclusion in LLM prompts.
 */
export declare function formatMemoryForPrompt(context: MemoryContext, projectIdentifier?: string): string;
/**
 * Extract relevant sections from memory based on keywords.
 */
export declare function extractRelevantSections(memory: ProjectMemory, keywords: string[]): MemorySection[];
/**
 * Get a summary of loaded memory for display.
 */
export declare function getMemorySummary(context: MemoryContext): string;
//# sourceMappingURL=loader.d.ts.map
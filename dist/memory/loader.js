/**
 * Memory file loader for project context.
 * Loads and parses memory.md files for context-aware briefings.
 *
 * Created: 2026-01-13
 */
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
const MEMORY_FILENAME = 'memory.md';
const GLOBAL_MEMORY_PATH = `${process.env.HOME}/.cpulse/${MEMORY_FILENAME}`;
/**
 * Parse markdown content into sections.
 */
function parseMemorySections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    let currentContent = [];
    for (const line of lines) {
        const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
        if (headerMatch) {
            // Save previous section
            if (currentSection) {
                currentSection.content = currentContent.join('\n').trim();
                sections.push(currentSection);
            }
            // Start new section
            currentSection = {
                title: headerMatch[2],
                content: '',
                level: headerMatch[1].length,
            };
            currentContent = [];
        }
        else if (currentSection) {
            currentContent.push(line);
        }
    }
    // Save last section
    if (currentSection) {
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection);
    }
    return sections;
}
/**
 * Load a memory file from a path.
 */
export function loadMemoryFile(filePath, projectName, gitRoot = null) {
    if (!existsSync(filePath)) {
        return null;
    }
    try {
        const content = readFileSync(filePath, 'utf-8');
        const stats = statSync(filePath);
        return {
            projectName,
            projectPath: dirname(filePath),
            gitRoot,
            content,
            sections: parseMemorySections(content),
            lastModified: stats.mtime,
        };
    }
    catch {
        return null;
    }
}
/**
 * Load global memory from ~/.cpulse/memory.md
 */
export function loadGlobalMemory() {
    return loadMemoryFile(GLOBAL_MEMORY_PATH, 'global');
}
/**
 * Find memory.md in a project directory or its docs folder.
 */
export function findProjectMemory(projectPath) {
    // Check docs/memory.md first (preferred location)
    const docsPath = join(projectPath, 'docs', MEMORY_FILENAME);
    if (existsSync(docsPath)) {
        return docsPath;
    }
    // Check root memory.md
    const rootPath = join(projectPath, MEMORY_FILENAME);
    if (existsSync(rootPath)) {
        return rootPath;
    }
    return null;
}
/**
 * Get the git root directory for a path.
 */
export function getGitRoot(path) {
    try {
        const result = execSync('git rev-parse --show-toplevel', {
            cwd: path,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.trim();
    }
    catch {
        return null;
    }
}
/**
 * Extract project name from path.
 */
export function extractProjectName(projectPath) {
    const parts = projectPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'unknown';
}
/**
 * Load memory for a specific project path.
 */
export function loadProjectMemory(projectPath) {
    // Try to find git root first
    const gitRoot = getGitRoot(projectPath);
    const searchPath = gitRoot || projectPath;
    const memoryPath = findProjectMemory(searchPath);
    if (!memoryPath) {
        return null;
    }
    const projectName = extractProjectName(searchPath);
    return loadMemoryFile(memoryPath, projectName, gitRoot);
}
/**
 * Load all memory context (global + project-specific).
 * Map is keyed by full path (git root or project path) to avoid collisions
 * when multiple projects share the same directory name.
 */
export function loadMemoryContext(projectPaths) {
    const context = {
        global: loadGlobalMemory(),
        projects: new Map(),
    };
    // Deduplicate and store by full path to avoid collisions
    const seenRoots = new Set();
    for (const path of projectPaths) {
        const gitRoot = getGitRoot(path);
        const key = gitRoot || path;
        if (seenRoots.has(key)) {
            continue;
        }
        seenRoots.add(key);
        const memory = loadProjectMemory(path);
        if (memory) {
            // Use full path as key to avoid collision when dirs share same name
            context.projects.set(key, memory);
        }
    }
    return context;
}
/**
 * Find memory by project identifier (name or path).
 * Searches by exact path match, git root match, or project name match.
 */
function findMemoryByProject(context, projectIdentifier) {
    // Direct path match
    if (context.projects.has(projectIdentifier)) {
        return context.projects.get(projectIdentifier);
    }
    // Search by project name or path ending
    for (const [_key, memory] of context.projects) {
        // Match by project name
        if (memory.projectName === projectIdentifier) {
            return memory;
        }
        // Match by git root ending (e.g., "cpulse" matches "/Users/q/src/cpulse")
        if (memory.gitRoot?.endsWith(`/${projectIdentifier}`)) {
            return memory;
        }
        // Match by project path ending
        if (memory.projectPath.endsWith(`/${projectIdentifier}`)) {
            return memory;
        }
    }
    return null;
}
/**
 * Format memory context for inclusion in LLM prompts.
 */
export function formatMemoryForPrompt(context, projectIdentifier) {
    const parts = [];
    // Add global memory if present
    if (context.global) {
        parts.push('=== Global Context ===');
        parts.push(context.global.content);
        parts.push('');
    }
    // Add project-specific memory
    if (projectIdentifier) {
        const projectMemory = findMemoryByProject(context, projectIdentifier);
        if (projectMemory) {
            parts.push(`=== ${projectMemory.projectName} Project Context ===`);
            parts.push(projectMemory.content);
            parts.push('');
        }
        else if (context.projects.size > 0) {
            // Fallback: include all if no match found
            for (const [_key, memory] of context.projects) {
                parts.push(`=== ${memory.projectName} Project Context ===`);
                parts.push(memory.content);
                parts.push('');
            }
        }
    }
    else if (context.projects.size > 0) {
        // Include all project memories if no specific project requested
        for (const [_key, memory] of context.projects) {
            parts.push(`=== ${memory.projectName} Project Context ===`);
            parts.push(memory.content);
            parts.push('');
        }
    }
    return parts.join('\n');
}
/**
 * Extract relevant sections from memory based on keywords.
 */
export function extractRelevantSections(memory, keywords) {
    const keywordsLower = keywords.map((k) => k.toLowerCase());
    return memory.sections.filter((section) => {
        const titleLower = section.title.toLowerCase();
        const contentLower = section.content.toLowerCase();
        return keywordsLower.some((kw) => titleLower.includes(kw) || contentLower.includes(kw));
    });
}
/**
 * Get a summary of loaded memory for display.
 */
export function getMemorySummary(context) {
    const lines = [];
    if (context.global) {
        lines.push(`Global memory: ${context.global.sections.length} sections`);
    }
    else {
        lines.push('Global memory: not found');
    }
    if (context.projects.size > 0) {
        lines.push(`Project memories: ${context.projects.size}`);
        for (const [_path, memory] of context.projects) {
            lines.push(`  - ${memory.projectName}: ${memory.sections.length} sections`);
        }
    }
    else {
        lines.push('Project memories: none found');
    }
    return lines.join('\n');
}
//# sourceMappingURL=loader.js.map
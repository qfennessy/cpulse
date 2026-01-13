/**
 * Memory file loader for project context.
 * Loads and parses memory.md files for context-aware briefings.
 *
 * Created: 2026-01-13
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

export interface ProjectMemory {
  projectName: string;
  projectPath: string;
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

const MEMORY_FILENAME = 'memory.md';
const GLOBAL_MEMORY_PATH = `${process.env.HOME}/.cpulse/${MEMORY_FILENAME}`;

/**
 * Parse markdown content into sections.
 */
function parseMemorySections(content: string): MemorySection[] {
  const sections: MemorySection[] = [];
  const lines = content.split('\n');

  let currentSection: MemorySection | null = null;
  let currentContent: string[] = [];

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
    } else if (currentSection) {
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
export function loadMemoryFile(filePath: string, projectName: string): ProjectMemory | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const stats = require('fs').statSync(filePath);

    return {
      projectName,
      projectPath: dirname(filePath),
      content,
      sections: parseMemorySections(content),
      lastModified: stats.mtime,
    };
  } catch {
    return null;
  }
}

/**
 * Load global memory from ~/.cpulse/memory.md
 */
export function loadGlobalMemory(): ProjectMemory | null {
  return loadMemoryFile(GLOBAL_MEMORY_PATH, 'global');
}

/**
 * Find memory.md in a project directory or its docs folder.
 */
export function findProjectMemory(projectPath: string): string | null {
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
export function getGitRoot(path: string): string | null {
  try {
    const result = execSync('git rev-parse --show-toplevel', {
      cwd: path,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Extract project name from path.
 */
export function extractProjectName(projectPath: string): string {
  const parts = projectPath.split('/');
  return parts[parts.length - 1] || 'unknown';
}

/**
 * Load memory for a specific project path.
 */
export function loadProjectMemory(projectPath: string): ProjectMemory | null {
  // Try to find git root first
  const gitRoot = getGitRoot(projectPath);
  const searchPath = gitRoot || projectPath;

  const memoryPath = findProjectMemory(searchPath);
  if (!memoryPath) {
    return null;
  }

  const projectName = extractProjectName(searchPath);
  return loadMemoryFile(memoryPath, projectName);
}

/**
 * Load all memory context (global + project-specific).
 */
export function loadMemoryContext(projectPaths: string[]): MemoryContext {
  const context: MemoryContext = {
    global: loadGlobalMemory(),
    projects: new Map(),
  };

  // Deduplicate project paths by git root
  const seenRoots = new Set<string>();

  for (const path of projectPaths) {
    const gitRoot = getGitRoot(path);
    const key = gitRoot || path;

    if (seenRoots.has(key)) {
      continue;
    }
    seenRoots.add(key);

    const memory = loadProjectMemory(path);
    if (memory) {
      context.projects.set(memory.projectName, memory);
    }
  }

  return context;
}

/**
 * Format memory context for inclusion in LLM prompts.
 */
export function formatMemoryForPrompt(context: MemoryContext, projectName?: string): string {
  const parts: string[] = [];

  // Add global memory if present
  if (context.global) {
    parts.push('=== Global Context ===');
    parts.push(context.global.content);
    parts.push('');
  }

  // Add project-specific memory
  if (projectName && context.projects.has(projectName)) {
    const projectMemory = context.projects.get(projectName)!;
    parts.push(`=== ${projectName} Project Context ===`);
    parts.push(projectMemory.content);
    parts.push('');
  } else if (context.projects.size > 0) {
    // Include all project memories if no specific project requested
    for (const [name, memory] of context.projects) {
      parts.push(`=== ${name} Project Context ===`);
      parts.push(memory.content);
      parts.push('');
    }
  }

  return parts.join('\n');
}

/**
 * Extract relevant sections from memory based on keywords.
 */
export function extractRelevantSections(
  memory: ProjectMemory,
  keywords: string[]
): MemorySection[] {
  const keywordsLower = keywords.map((k) => k.toLowerCase());

  return memory.sections.filter((section) => {
    const titleLower = section.title.toLowerCase();
    const contentLower = section.content.toLowerCase();

    return keywordsLower.some(
      (kw) => titleLower.includes(kw) || contentLower.includes(kw)
    );
  });
}

/**
 * Get a summary of loaded memory for display.
 */
export function getMemorySummary(context: MemoryContext): string {
  const lines: string[] = [];

  if (context.global) {
    lines.push(`Global memory: ${context.global.sections.length} sections`);
  } else {
    lines.push('Global memory: not found');
  }

  if (context.projects.size > 0) {
    lines.push(`Project memories: ${context.projects.size}`);
    for (const [name, memory] of context.projects) {
      lines.push(`  - ${name}: ${memory.sections.length} sections`);
    }
  } else {
    lines.push('Project memories: none found');
  }

  return lines.join('\n');
}

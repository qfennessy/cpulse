/**
 * Memory module exports.
 *
 * Created: 2026-01-13
 */

export {
  loadGlobalMemory,
  loadProjectMemory,
  loadMemoryContext,
  loadMemoryFile,
  findProjectMemory,
  formatMemoryForPrompt,
  extractRelevantSections,
  getMemorySummary,
  getGitRoot,
  extractProjectName,
  type ProjectMemory,
  type MemorySection,
  type MemoryContext,
} from './loader.js';

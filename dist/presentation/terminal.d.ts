/**
 * Terminal ANSI formatting for CLI preview output.
 *
 * Created: 2026-01-13
 */
import type { ArticleCard } from '../types/index.js';
/**
 * Convert markdown text to ANSI-formatted terminal output.
 */
export declare function markdownToAnsi(text: string): string;
/**
 * Render a single card for terminal output.
 */
export declare function renderCardTerminal(card: ArticleCard): string;
/**
 * Render complete briefing for terminal output.
 */
export declare function renderBriefingTerminal(cards: ArticleCard[], opening: string, closing: string, cardTransitions: Map<number, string>): string;
/**
 * Simple markdown-to-ANSI formatter for basic preview.
 */
export declare function formatMarkdownForTerminal(markdown: string): string;
//# sourceMappingURL=terminal.d.ts.map